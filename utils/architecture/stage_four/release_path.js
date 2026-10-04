"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreePatchReleaseTransition } = require("../domain_batches/stage_three_patch_release_transition");
const { StageFourClusterLedger } = require("./cluster_ledger");

const RELEASE_DIRECTORY = "architecture/migration/stage_4/releases";
const RELEASE_KIND = "cyber-fishing-stage-4-release";
const RELEASE_NAME = /^(\d{3})_[a-z0-9-]+\.json$/u;
const VERSION = /^\d+\.\d+\.\d+$/u;
const FILES = Object.freeze({ changelog: "CHANGELOG.md", index: "index.html", lock: "package-lock.json",
  package: "package.json", source: "src/config/project_version.js" });
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

// Stage 4 milestone release (owner decision 0.3 step 4; two uses: M1 0.25.0 and M2 0.25.x). The record
// architecture/migration/stage_4/releases/NNN_slug.json holds the hand input (versions, title, 1-3 CHANGELOG
// lines, version notes, optional changelogTrimFrom) and receives `output` (exact edits, before/after hashes,
// milestone metrics). The version lives in project_version.js, package.json, package-lock.json and the index
// query; the Stage 3 execution state keeps the last Stage 3 release (history, never rewritten).
class StageFourRelease {
  constructor(root) {
    this.root = path.resolve(root);
  }

  read(file) { return fs.readFileSync(path.join(this.root, file), "utf8"); }

  static records(root) {
    const directory = path.join(root, RELEASE_DIRECTORY);
    if (!fs.existsSync(directory)) return [];
    const stageThree = JSON.parse(fs.readFileSync(path.join(root,
      "architecture/migration/stage_3_execution_state.json"), "utf8")).releaseVersion;
    const records = fs.readdirSync(directory).filter((name) => name.endsWith(".json")).sort().map((name, index) => {
      const match = RELEASE_NAME.exec(name);
      assert(match && Number(match[1]) === index + 1, `Stage 4 release record name is not canonical: ${name}`);
      const record = JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
      assert(record.schemaVersion === 1 && record.kind === RELEASE_KIND && record.id === match[1], `${name}: identity`);
      return Object.freeze({ ...record, file: `${RELEASE_DIRECTORY}/${name}` });
    });
    records.forEach((record, index) => {
      StageFourRelease.validateInput(record);
      assert.equal(record.fromRelease, index ? records[index - 1].toRelease : stageThree, `${record.file}: fromRelease`);
      assert(index === records.length - 1 || record.output, `${record.file}: only the last release may be pending`);
    });
    return records;
  }

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
    if (literal.test(read(FILES.source))) return FILES.source;
    const prepared = "src/config/project_version_catalog.js";
    if (literal.test(read(prepared))) return prepared;
    return "src/game/presentation/version/project_version.js";
  }

  // Version pins of a tree; all of them must agree.
  static currentVersion(read, policy = null) {
    const packageJson = JSON.parse(read(FILES.package));
    const lock = JSON.parse(read(FILES.lock));
    const source = /^(?:export )?const CURRENT_PROJECT_VERSION = "([^"]+)";(?=\r?$)/mu.exec(read(StageFourRelease.versionSource(read)))?.[1];
    const legacySource = policy === null ? FILES.index : policy.migrationManifest?.legacyLoadOrder?.source;
    assert(["index.html", "dev.html"].includes(legacySource), "Unreviewed legacy version source");
    const queries = [...read(legacySource).matchAll(/src\/config\/project_version\.js\?v=([0-9.]+)"/gu)].map((m) => m[1]);
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
    const changelog = texts.get(FILES.changelog);
    const eol = eolOf(changelog);
    const header = `${CHANGELOG_HEADER}${eol}${eol}`;
    const changelogEdits = [{ from: header, to: header + StageFourRelease.changelogEntry(record, eol), count: 1 }];
    if (record.changelogTrimFrom) {
      const trimmed = StageThreePatchReleaseTransition.trimmedChangelog(changelog, record.changelogTrimFrom,
        record.fromRelease);
      const lastLine = trimmed.slice(trimmed.lastIndexOf("\n", trimmed.length - 2) + 1);
      changelogEdits.push({ from: lastLine + changelog.slice(trimmed.length), to: lastLine, count: 1 });
    }
    const source = texts.get(FILES.source);
    // Each statement keeps its own line endings (the file mixes CRLF and LF).
    const statement = (pattern, index) => {
      const from = pattern.exec(source)?.[0];
      return { from, to: StageFourRelease.sourceBlock(record, eolOf(from || ""))[index], count: 1 };
    };
    return new Map([
      [FILES.changelog, changelogEdits],
      [FILES.index, [{ from: `src/config/project_version.js?v=${record.fromRelease}"`,
        to: `src/config/project_version.js?v=${record.toRelease}"`, count: 1 }]],
      [FILES.lock, [{ from: `"version": "${record.fromRelease}"`, to: `"version": "${record.toRelease}"`, count: 2 }]],
      [FILES.package, [{ from: `"version": "${record.fromRelease}"`, to: `"version": "${record.toRelease}"`, count: 1 }]],
      [FILES.source, SOURCE_STATEMENTS.map(statement).filter((edit) => edit.from !== edit.to)],
    ]);
  }

  // A release changes only the version fields, the index query, the version statements and the new
  // CHANGELOG entry (plus the declared trim); everything else stays byte-identical.
  static validateDelta(record, file, before, after) {
    if (file === FILES.package || file === FILES.lock) {
      const old = JSON.parse(before);
      const next = JSON.parse(after);
      assert(old.version === record.fromRelease && next.version === record.toRelease, `${file}: version`);
      next.version = old.version;
      if (file === FILES.lock) {
        assert(old.packages[""].version === record.fromRelease && next.packages[""].version === record.toRelease);
        next.packages[""].version = old.packages[""].version;
      }
      assert.deepEqual(next, old, `${file}: release changed more than the version`);
      assert.equal(after.replace(`"version": "${record.toRelease}"`, `"version": "${record.fromRelease}"`)
        .replace(`"version": "${record.toRelease}"`, `"version": "${record.fromRelease}"`), before, `${file}: bytes`);
    } else if (file === FILES.index) {
      assert.equal(replace(after, `project_version.js?v=${record.toRelease}"`, `project_version.js?v=${record.fromRelease}"`,
        1), before, "index.html: release changed more than the version query");
    } else if (file === FILES.changelog) {
      const eol = eolOf(before);
      const header = `${CHANGELOG_HEADER}${eol}${eol}`;
      assert(before.startsWith(header) && before.includes(`## v${record.fromRelease} - `), "CHANGELOG source entry");
      const kept = StageThreePatchReleaseTransition.trimmedChangelog(before, record.changelogTrimFrom, record.fromRelease);
      assert.equal(after, header + StageFourRelease.changelogEntry(record, eol) + kept.slice(header.length),
        "Historical changelog changed");
    } else if (file === FILES.source) {
      const blank = (text) => SOURCE_STATEMENTS.reduce((value, pattern) => {
        assert.equal(value.match(new RegExp(pattern.source, "gmu"))?.length, 1, `${file}: version statement`);
        return value.replace(pattern, "<release>");
      }, text);
      assert.equal(blank(after), blank(before), `${file}: release changed more than the version statements`);
      const notes = SOURCE_STATEMENTS[3];
      assert.equal(eolOf(notes.exec(after)[0]), eolOf(notes.exec(before)[0]), `${file}: notes line endings changed`);
      assert(after.includes(StageFourRelease.sourceBlock(record, eolOf(after))[0]), `${file}: version`);
    } else {
      throw new Error(`Not a release file: ${file}`);
    }
  }

  plan(record) {
    StageFourRelease.validateInput(record);
    assert.equal(record.output, null, `${record.file}: release already applied`);
    assert.equal(StageFourRelease.currentVersion((file) => this.read(file)), record.fromRelease, "current version");
    const texts = new Map(Object.values(FILES).map((file) => [file, this.read(file)]));
    const files = [...this.edits(record, texts)].map(([file, edits]) => {
      const before = texts.get(file);
      const after = edits.reduce((text, edit) => replace(text, edit.from, edit.to, edit.count), before);
      StageFourRelease.validateDelta(record, file, before, after);
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
      assert.equal(StageFourRelease.currentVersion((file) => this.read(file)), record.toRelease);
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

  // Milestone report (working rule 6): lines, classic scripts, activations and bridges with their retirement path.
  metrics() {
    const json = (file) => JSON.parse(this.read(file));
    const tracked = childProcess.execFileSync("git", ["ls-files", "src", "utils", "architecture"],
      { cwd: this.root, encoding: "utf8" }).split("\n").filter((file) => /\.(js|json)$/u.test(file));
    const lines = { src: 0, utils: 0, architecture: 0 };
    for (const file of tracked) {
      if (!fs.existsSync(path.join(this.root, file))) continue;
      lines[file.split("/")[0]] += this.read(file).split("\n").length - 1;
    }
    const count = (items, key) => items.reduce((sum, item) => ({ ...sum, [key(item)]: (sum[key(item)] || 0) + 1 }), {});
    const contract = json("architecture/migration/stage_3_compatibility_runtime.json");
    const bridges = json("architecture/guards/migration_bridge_registry.json").bridges;
    const ledger = StageFourClusterLedger.read(this.root);
    const pending = ledger.records.filter((record) => record.output === null && !record.deferred);
    const clusterOf = (source) => pending.find((record) => record.modules.some((item) => item.currentPath === source))?.id;
    const holders = (activation) => bridges.filter((bridge) => bridge.target === activation.targetModule &&
      bridge.globalProviders.some((surface) => surface.symbol === activation.legacySymbol));
    const stageFourBridges = bridges.filter((bridge) => bridge.removalStage === "stage-4");
    const path4 = count(stageFourBridges, (bridge) => clusterOf(bridge.source) || "unplanned");
    const activations4 = contract.activationPositions.filter((item) => item.removalStage === "stage-4");
    const retireInStageFour = activations4.filter((item) => holders(item).every((bridge) => clusterOf(bridge.source)));
    return {
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
      stageFourRetirementPath: {
        bridgesByPendingCluster: path4,
        activationsRetiringWithPendingClusters: retireInStageFour.length,
        activationsHeldBeyondPendingClusters: activations4.length - retireInStageFour.length,
      },
    };
  }
}

module.exports = { FILES, RELEASE_DIRECTORY, RELEASE_KIND, StageFourRelease };
