"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreePatchReleaseTransition } = require("../domain_batches/stage_three_patch_release_transition");
const { LEDGER_STAGES, StageFourClusterLedger } = require("./cluster_ledger");
const { EsmDependencyObserver } = require("../guards/observation/esm_dependency_observer");
const { NativeDevelopmentRetirement } = require("../stage_six/native_development_retirement");

const RELEASE_DIRECTORY = "architecture/migration/stage_4/releases";
const RELEASE_KIND = "cyber-fishing-stage-4-release";
const RELEASE_NAME = /^(\d{3})_[a-z0-9-]+\.json$/u;
const VERSION = /^\d+\.\d+\.\d+$/u;
const FILES = Object.freeze({ changelog: "CHANGELOG.md", index: "index.html", lock: "package-lock.json",
  package: "package.json", source: "src/config/project_version.js" });
const releaseDirectory = stage => { assert(LEDGER_STAGES.includes(stage), "unsupported release stage");
  return `architecture/migration/stage_${stage}/releases`; };
const releaseKind = stage => `cyber-fishing-stage-${stage}-release`;
const releaseFiles = (stage = 4) => { releaseDirectory(stage); return stage === 4 ? FILES :
  Object.freeze({...FILES, dev:"dev.html", source:"src/game/presentation/version/project_version.js"}); };
// The versioned page query a stage release rewrites: classic version script, native production entry (Stage 5+)
// and native DEV entry (Stage 6).
const pageVersionQuery = (stage, dev) => stage >= 6 && dev ? "src/entrypoints/dev.entry.js" :
  stage >= 5 && !dev ? "src/entrypoints/game.entry.js" : "src/config/project_version.js";
const CHANGELOG_HEADER = "# CyberFishing changelog";
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const canonical = (value) => `${JSON.stringify(value, null, 2)}\n`;
const replace = StageThreePatchReleaseTransition.replace;
const eolOf = (text) => (text.includes("\r\n") ? "\r\n" : "\n");
// The project_version.js statements a release rewrites; everything else in the file is preserved byte-exact.
// Each statement ends before the line break (CRLF or LF).
const SOURCE_STATEMENTS = Object.freeze([/^const CURRENT_PROJECT_VERSION = "[^"]*";(?=\r?$)/mu,
  /^ {2}codename: "[^"]*",(?=\r?$)/mu, /^ {2}updatedAt: "[^"]*",(?=\r?$)/mu,
  /^ {2}notes: Object\.freeze\(\[\r?\n(?: {4}"[^"\r\n]*",\r?\n)+ {2}\]\),(?=\r?$)/mu]);

// Stage-qualified milestone release; Stage 4 is the frozen default, Stage 5 uses the reviewed native topology. The record
// architecture/migration/stage_4/releases/NNN_slug.json holds the hand input (versions, title, 1-3 CHANGELOG
// lines, version notes, optional changelogTrimFrom) and receives `output` (exact edits, before/after hashes,
// milestone metrics). The version lives in project_version.js, package.json, package-lock.json and the index
// query; the Stage 3 execution state keeps the last Stage 3 release (history, never rewritten).
class StageFourRelease {
  constructor(root, stage = 4) {
    releaseDirectory(stage);
    this.root = path.resolve(root); this.stage = stage; this.files = releaseFiles(stage);
  }

  read(file) { return fs.readFileSync(path.join(this.root, file), "utf8"); }

  static records(root, stage = 4) {
    const relative = releaseDirectory(stage);
    const directory = path.join(root, relative);
    if (!fs.existsSync(directory)) return [];
    const previousRelease = stage === 4 ? JSON.parse(fs.readFileSync(path.join(root,
      "architecture/migration/stage_3_execution_state.json"), "utf8")).releaseVersion :
      StageFourRelease.records(root, stage - 1).filter(record => record.output).at(-1)?.toRelease;
    assert(previousRelease, `Stage ${stage} release needs the historical Stage ${stage - 1} release`);
    const records = fs.readdirSync(directory).filter((name) => name.endsWith(".json")).sort().map((name, index) => {
      const match = RELEASE_NAME.exec(name);
      assert(match && Number(match[1]) === index + 1, `Stage ${stage} release record name is not canonical: ${name}`);
      const record = JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
      assert(record.schemaVersion === 1 && record.kind === releaseKind(stage) && record.id === match[1], `${name}: identity`);
      return Object.freeze({ ...record, file: `${relative}/${name}` });
    });
    records.forEach((record, index) => {
      StageFourRelease.validateInput(record);
      assert.equal(record.fromRelease, index ? records[index - 1].toRelease : previousRelease, `${record.file}: fromRelease`);
      assert(index === records.length - 1 || record.output, `${record.file}: only the last release may be pending`);
    });
    return records;
  }

  static cumulativeRecords(root) { return LEDGER_STAGES.flatMap(stage => StageFourRelease.records(root,stage)); }

  static validateInput(record) {
    assert(/^M\d$/u.test(record.milestone) && VERSION.test(record.fromRelease) && VERSION.test(record.toRelease));
    const [from, to] = [record.fromRelease, record.toRelease].map((value) => value.split(".").map(Number));
    assert(to[0] > from[0] || (to[0] === from[0] && (to[1] > from[1] || (to[1] === from[1] && to[2] > from[2]))),
      "toRelease must be newer than fromRelease");
    for (const text of [record.title, record.codename, record.updatedAt, ...record.notes, ...record.changelog]) {
      assert(typeof text === "string" && text.length > 0 && !/["\r\n]/u.test(text), "release text must be one plain line");
    }
    assert(record.changelog.length >= 1 && record.changelog.length <= 3, "CHANGELOG entry needs 1-3 lines");
    assert(record.notes.length >= 1 && record.notes.length <= 4, "version notes need 1-4 lines");
    assert(/^[a-z0-9-]+$/u.test(record.codename) && /^\d{4}-\d{2}-\d{2}$/u.test(record.updatedAt));
    assert(record.versionDecision, "release record needs its version decision");
  }

  // Reviewed representations of the unchanged logical version source anchor (Stage 5).
  static versionSource(read) {
    const literal = /^(?:export )?const CURRENT_PROJECT_VERSION = "([^"]+)";(?=\r?$)/mu;
    for (const file of [FILES.source,"src/config/project_version_catalog.js","src/game/presentation/version/project_version.js"]) {
      try { if (literal.test(read(file))) return file; }
      catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    throw new Error("Canonical project version source is missing");
  }

  // Version pins of a tree; all of them must agree.
  static currentVersion(read, policy = null) {
    const packageJson = JSON.parse(read(FILES.package));
    const lock = JSON.parse(read(FILES.lock));
    const source = /^(?:export )?const CURRENT_PROJECT_VERSION = "([^"]+)";(?=\r?$)/mu.exec(read(StageFourRelease.versionSource(read)))?.[1];
    const legacySource = policy === null ? FILES.index : policy.migrationManifest?.legacyLoadOrder?.source;
    assert(["index.html", "dev.html"].includes(legacySource), "Unreviewed legacy version source");
    const classicQueries = [...read(legacySource).matchAll(/src\/config\/project_version\.js\?v=([0-9.]+)"/gu)].map((m) => m[1]);
    // Stage 6 native DEV: the DEV page pins its single module entry instead of the classic version script, never both.
    const devEntryQueries = legacySource === "dev.html"
      ? [...read(legacySource).matchAll(/src\/entrypoints\/dev\.entry\.js\?v=([0-9.]+)"/gu)].map(m => m[1]) : [];
    assert(classicQueries.length === 0 || devEntryQueries.length === 0, "DEV page mixes classic and native version pins");
    const queries = [...classicQueries, ...devEntryQueries];
    const nativeQueries = legacySource === "dev.html"
      ? [...read(FILES.index).matchAll(/src\/entrypoints\/game\.entry\.js\?v=([0-9.]+)"/gu)].map(m => m[1]) : [];
    assert(legacySource !== "dev.html" || nativeQueries.length === 1, "native production version query must occur exactly once");
    const versions = [packageJson.version, lock.version, lock.packages[""].version, source, ...queries, ...nativeQueries];
    assert(queries.length === 1 && versions.every((value) => value === versions[0]),
      `version pins disagree: ${versions.join(", ")}`);
    return versions[0];
  }

  static changelogEntry(record, eol) {
    return [`## v${record.toRelease} - ${record.title}`, "", "### Changed", "",
      ...record.changelog.map((line) => `- ${line}`), "", ""].join(eol);
  }

  static sourceBlock(record, eol) {
    return [`const CURRENT_PROJECT_VERSION = "${record.toRelease}";`, `  codename: "${record.codename}",`,
      `  updatedAt: "${record.updatedAt}",`,
      [`  notes: Object.freeze([`, ...record.notes.map((note) => `    "${note}",`), "  ]),"].join(eol)];
  }

  // The exact edits of each version file (applied in order, each with an exact occurrence count).
  edits(record, texts) {
    const files = this.files;
    const changelog = texts.get(files.changelog);
    const eol = eolOf(changelog);
    const header = `${CHANGELOG_HEADER}${eol}${eol}`;
    const changelogEdits = [{ from: header, to: header + StageFourRelease.changelogEntry(record, eol), count: 1 }];
    if (record.changelogTrimFrom) {
      const trimmed = StageThreePatchReleaseTransition.trimmedChangelog(changelog, record.changelogTrimFrom,
        record.fromRelease);
      const lastLine = trimmed.slice(trimmed.lastIndexOf("\n", trimmed.length - 2) + 1);
      changelogEdits.push({ from: lastLine + changelog.slice(trimmed.length), to: lastLine, count: 1 });
    }
    const source = texts.get(files.source);
    const native = this.stage >= 5;
    // Each statement keeps its own line endings (the file mixes CRLF and LF).
    const statement = (pattern, index) => {
      const qualified = index === 0 && native ? /^export const CURRENT_PROJECT_VERSION = "[^"\r\n]*";(?=\r?$)/mu : pattern;
      const from = qualified.exec(source)?.[0];
      return { from, to: (index === 0 && native ? "export " : "") + StageFourRelease.sourceBlock(record, eolOf(from || ""))[index], count: 1 };
    };
    const indexQuery = pageVersionQuery(this.stage, false), devQuery = pageVersionQuery(this.stage, true);
    return new Map([
      [files.changelog, changelogEdits],
      [files.index, [{ from: `${indexQuery}?v=${record.fromRelease}"`, to: `${indexQuery}?v=${record.toRelease}"`, count: 1 }]],
      ...(native ? [[files.dev, [{ from: `${devQuery}?v=${record.fromRelease}"`,
        to: `${devQuery}?v=${record.toRelease}"`, count: 1 }]]] : []),
      [files.lock, [{ from: `"version": "${record.fromRelease}"`, to: `"version": "${record.toRelease}"`, count: 2 }]],
      [files.package, [{ from: `"version": "${record.fromRelease}"`, to: `"version": "${record.toRelease}"`, count: 1 }]],
      [files.source, SOURCE_STATEMENTS.map(statement).filter((edit) => edit.from !== edit.to)],
    ]);
  }

  // A release changes only the version fields, the index query, the version statements and the new
  // CHANGELOG entry (plus the declared trim); everything else stays byte-identical.
  static validateDelta(record, file, before, after, stage = 4) {
    const files = releaseFiles(stage);
    if (file === files.package || file === files.lock) {
      const old = JSON.parse(before);
      const next = JSON.parse(after);
      assert(old.version === record.fromRelease && next.version === record.toRelease, `${file}: version`);
      next.version = old.version;
      if (file === files.lock) {
        assert(old.packages[""].version === record.fromRelease && next.packages[""].version === record.toRelease);
        next.packages[""].version = old.packages[""].version;
      }
      assert.deepEqual(next, old, `${file}: release changed more than the version`);
      assert.equal(after.replace(`"version": "${record.toRelease}"`, `"version": "${record.fromRelease}"`)
        .replace(`"version": "${record.toRelease}"`, `"version": "${record.fromRelease}"`), before, `${file}: bytes`);
    } else if (file === files.index || file === files.dev) {
      const query = pageVersionQuery(stage, file === files.dev);
      assert.equal(replace(after, `${query}?v=${record.toRelease}"`, `${query}?v=${record.fromRelease}"`,
        1), before, `${file}: release changed more than the version query`);
    } else if (file === files.changelog) {
      const eol = eolOf(before);
      const header = `${CHANGELOG_HEADER}${eol}${eol}`;
      assert(before.startsWith(header) && before.includes(`## v${record.fromRelease} - `), "CHANGELOG source entry");
      const kept = StageThreePatchReleaseTransition.trimmedChangelog(before, record.changelogTrimFrom, record.fromRelease);
      assert.equal(after, header + StageFourRelease.changelogEntry(record, eol) + kept.slice(header.length),
        "Historical changelog changed");
    } else if (file === files.source) {
      const patterns = SOURCE_STATEMENTS.map((pattern,index) => stage >= 5 && index === 0 ?
        /^export const CURRENT_PROJECT_VERSION = "[^"\r\n]*";(?=\r?$)/mu : pattern);
      const blank = (text) => patterns.reduce((value, pattern) => {
        assert.equal(value.match(new RegExp(pattern.source, "gmu"))?.length, 1, `${file}: version statement`);
        return value.replace(pattern, "<release>");
      }, text);
      assert.equal(blank(after), blank(before), `${file}: release changed more than the version statements`);
      const notes = SOURCE_STATEMENTS[3];
      assert.equal(eolOf(notes.exec(after)[0]), eolOf(notes.exec(before)[0]), `${file}: notes line endings changed`);
      assert(after.includes((stage >= 5 ? "export " : "") + StageFourRelease.sourceBlock(record, eolOf(after))[0]), `${file}: version`);
    } else {
      throw new Error(`Not a release file: ${file}`);
    }
  }

  plan(record) {
    StageFourRelease.validateInput(record);
    assert.equal(record.kind,releaseKind(this.stage), "release stage identity");
    const selected = StageFourRelease.records(this.root,this.stage).find(item => item.file === record.file);
    assert(selected && JSON.stringify({...record,file:undefined}) === JSON.stringify({...selected,file:undefined}), "release differs from reviewed input");
    const policy = this.stage >= 5 ? JSON.parse(this.read("architecture/module_architecture.json")) : null;
    assert(this.stage < 5 || (policy.migrationManifest.browserStartup?.decision ===
      "architecture/migration/stage_5/native_production_owner_decision.md" &&
      policy.migrationManifest.legacyLoadOrder.source === "dev.html"), `Stage ${this.stage} release needs reviewed native topology`);
    // Stage 6 releases only the exact native DEV retirement (both pages one module entry, zero compatibility records).
    assert(this.stage !== 6 || NativeDevelopmentRetirement.read(this.root) !== null, "Stage 6 release needs exact native DEV retirement");
    assert.equal(record.output, null, `${record.file}: release already applied`);
    assert.equal(StageFourRelease.currentVersion((file) => this.read(file),policy), record.fromRelease, "current version");
    assert(this.stage < 5 || StageFourRelease.versionSource(file => this.read(file)) === this.files.source, `Stage ${this.stage} canonical version source`);
    const texts = new Map(Object.values(this.files).map((file) => [file, this.read(file)]));
    const files = [...this.edits(record, texts)].map(([file, edits]) => {
      const before = texts.get(file);
      const after = edits.reduce((text, edit) => replace(text, edit.from, edit.to, edit.count), before);
      StageFourRelease.validateDelta(record, file, before, after,this.stage);
      return { path: file, before: sha256(before), after: sha256(after), edits, text: after };
    });
    return { files, metrics: this.metrics() };
  }

  apply(recordFile) {
    const record = { ...JSON.parse(this.read(recordFile)), file: recordFile };
    const { files } = this.plan(record);
    const originals = new Map([[recordFile, this.read(recordFile)], ...files.map((file) => [file.path, this.read(file.path)])]);
    try {
      for (const file of files) fs.writeFileSync(path.join(this.root, file.path), file.text);
      assert.equal(StageFourRelease.currentVersion((file) => this.read(file), this.stage >= 5 ?
        JSON.parse(this.read("architecture/module_architecture.json")) : null), record.toRelease);
      const { file, ...input } = record;
      const output = { status: "applied", tag: `v${record.toRelease}`,
        files: files.map(({ text, ...item }) => item), metrics: this.metrics() };
      fs.writeFileSync(path.join(this.root, recordFile), canonical({ ...input, output }));
      return output;
    } catch (error) {
      for (const [file, text] of originals) fs.writeFileSync(path.join(this.root, file), text);
      throw error;
    }
  }

  // Annotated local tag of an applied, committed release (tags are never pushed by this tool).
  tag(recordFile) {
    const git = (...args) => childProcess.execFileSync("git", args, { cwd: this.root, encoding: "utf8" });
    const record = JSON.parse(this.read(recordFile));
    assert.equal(record.output?.status, "applied", "release is not applied");
    assert.equal(git("status", "--porcelain"), "", "working tree must be clean");
    assert.equal(git("show", `HEAD:${recordFile}`).replace(/\r\n/gu, "\n"), this.read(recordFile).replace(/\r\n/gu, "\n"),
      "applied release record is not committed");
    assert.equal(git("tag", "--list", record.output.tag), "", `tag ${record.output.tag} exists`);
    git("tag", "-a", record.output.tag, "-m", [`CyberFishing ${record.output.tag} - ${record.title}`, "",
      ...record.changelog.map((line) => `- ${line}`)].join("\n"));
    return record.output.tag;
  }

  // Reuse the guard observer for the authored production import closure; no second graph catalog.
  nativeGraph(entry = "src/entrypoints/game.entry.js") {
    const observer = new EsmDependencyObserver({projectRoot:this.root});
    const development = entry === "src/entrypoints/dev.entry.js";
    const queue = [entry], seen = new Set(), edges = [];
    while (queue.length) {
      const source = queue.pop(); if (seen.has(source)) continue; seen.add(source);
      assert(!source.includes("/compat/") && (development || !["/dev/","/bootstrap/development/"].some(part => source.includes(part))),
        development ? "native DEV reaches compatibility" : "production reaches DEV or compatibility");
      const result = observer.observeFile(source);
      assert(result.status === "verified" && result.hasEsmSyntax, "production module is not verified ESM");
      for (const edge of result.observations) {
        assert(edge.resolutionStatus === "confirmed-project", "production import is unresolved or external");
        edges.push(edge); queue.push(edge.resolvedTarget);
      }
    }
    if (development) return {entry,modules:seen.size,importEdges:edges.length,compatibility:0,unresolved:0,
      dev:[...seen].filter(file => file.startsWith("src/dev/")).length,
      developmentBootstrap:[...seen].filter(file => file.startsWith("src/bootstrap/development/")).length};
    return {entry:"src/entrypoints/game.entry.js",modules:seen.size,importEdges:edges.length,devOrCompatibility:0,unresolved:0};
  }

  // Milestone report (working rule 6): lines, classic scripts, activations and bridges with their retirement path.
  metrics() {
    const json = (file) => JSON.parse(this.read(file));
    const tracked = [...new Set(childProcess.execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "src", "utils", "architecture"],
      { cwd: this.root, encoding: "utf8" }).split("\n").filter((file) => /\.(js|json)$/u.test(file)))];
    const lines = { src: 0, utils: 0, architecture: 0 };
    for (const file of tracked) {
      if (!fs.existsSync(path.join(this.root, file))) continue;
      lines[file.split("/")[0]] += this.read(file).split("\n").length - 1;
    }
    const count = (items, key) => items.reduce((sum, item) => ({ ...sum, [key(item)]: (sum[key(item)] || 0) + 1 }), {});
    const contract = json("architecture/migration/stage_3_compatibility_runtime.json");
    const bridges = json("architecture/guards/migration_bridge_registry.json").bridges;
    const ledger = StageFourClusterLedger.read(this.root,this.stage);
    const pending = ledger.records.filter((record) => record.output === null && !record.deferred);
    const clusterOf = (source) => pending.find((record) => record.modules.some((item) => item.currentPath === source))?.id;
    const holders = (activation) => bridges.filter((bridge) => bridge.target === activation.targetModule &&
      bridge.globalProviders.some((surface) => surface.symbol === activation.legacySymbol));
    const stageFourBridges = bridges.filter((bridge) => bridge.removalStage === "stage-4");
    const path4 = count(stageFourBridges, (bridge) => clusterOf(bridge.source) || "unplanned");
    const activations4 = contract.activationPositions.filter((item) => item.removalStage === "stage-4");
    const retireInStageFour = activations4.filter((item) => holders(item).every((bridge) => clusterOf(bridge.source)));
    return {
      ...(this.stage === 6 ? {stage:6, nativeProduction:this.nativeGraph(), nativeDevelopment:this.nativeGraph("src/entrypoints/dev.entry.js"),
        classicScriptTagsByPage:{index:(this.read(FILES.index).match(/<script\b(?![^>]*type="module")[^>]*src=/gu) || []).length,
          dev:(this.read(this.files.dev).match(/<script\b(?![^>]*type="module")[^>]*src=/gu) || []).length},
        files:count(tracked.filter(file => fs.existsSync(path.join(this.root,file))),file => file.split("/")[0])} : {}),
      ...(this.stage === 5 ? {stage:5, nativeProduction:this.nativeGraph(),
        classicDevScriptTags:(this.read(this.files.dev).match(/<script src="src\//gu) || []).length,
        files:count(tracked.filter(file => fs.existsSync(path.join(this.root,file))),file => file.split("/")[0]),
        deferredNativeProduction:ledger.records.filter(record => record.deferred).map(record => ({id:record.id,
          status:record.nativeProduction?.status || "deferred",reason:record.deferred.reason || record.deferred}))} : {}),
      lines,
      classicScriptTags: (this.read(FILES.index).match(/<script src="src\//gu) || []).length,
      clusters: { applied: ledger.applied.length, pending: pending.map((record) => record.id),
        deferred: ledger.records.filter((record) => record.deferred).map((record) => record.id) },
      activations: { active: contract.activationPositions.length,
        byRemovalStage: count(contract.activationPositions, (item) => item.removalStage),
        retired: contract.retiredActivations.length, inert: (contract.inertModules || []).length },
      bridges: { total: bridges.length, byRemovalStage: count(bridges, (bridge) => bridge.removalStage) },
      knownDebts: json("architecture/guards/known_debt_registry.json").debts.length,
      globalProviders: json("architecture/guards/global_provider_baseline.json").providers.length,
      ...(this.stage === 4 ? {stageFourRetirementPath: {
        bridgesByPendingCluster: path4,
        activationsRetiringWithPendingClusters: retireInStageFour.length,
        activationsHeldBeyondPendingClusters: activations4.length - retireInStageFour.length,
      }} : this.stage === 5 ? {stageFiveRetirementPath:{nativeDevelopmentStage:"stage-6",transport:contract.transport.removalStage,
        condition:contract.transport.lifecycle.removalCondition}} : {nativeRetirement:contract.nativeRetirement}),
    };
  }
}

module.exports = { FILES, RELEASE_DIRECTORY, RELEASE_KIND, StageFourRelease, releaseDirectory, releaseFiles, releaseKind };
