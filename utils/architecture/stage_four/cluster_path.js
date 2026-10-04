"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const espree = require("espree");
const { RECORD_KIND, StageFourClusterLedger, recordStage, stageDirectories } = require("./cluster_ledger");
const { StageFourEsmTargetProjector } = require("./esm_target_projector");
const { ActivationShimRenderer } = require("../../build/compat_runtime/activation_shim");
const { ActivationRetirementProjection, MigratedSourcePlaceholder, RetiredActivationPlaceholder } =
  require("../../build/compat_runtime/activation_retirement");
const { CanonicalActivationIdentity, CumulativeRuntimeContractValidator } =
  require("../../build/compat_runtime/cumulative_runtime_contract");
const { CumulativeRuntimeLoadSlot } = require("../../build/compat_runtime/cumulative_runtime_load_slot");
const { CanonicalBridgeIdentity } = require("../../build/legacy_bridge_build_config");
const { MigrationBridgeRegistryValidator } = require("../guards/contracts/guard_artifact_repository");
const { ManifestEntryFactory } = require("../migration/manifest_entry_factory");
const { CurrentAreaResolver } = require("../migration/current_area_resolver");
const { LegacyScriptOrderReader } = require("../migration/legacy_script_order_reader");
const { StageThreeRuntimeScriptAliasResolver } = require("../migration/stage_three_runtime_script_alias_resolver");
const { ArchitectureGuardSnapshotBuilder } = require("../guards/corpus/architecture_guard_snapshot_builder");
const { ArchitectureGuardEngine } = require("../guards/architecture_guard_engine");

const PATHS = Object.freeze({
  manifest: "architecture/migration/module_migration_manifest.json",
  policy: "architecture/module_architecture.json",
  contract: "architecture/migration/stage_3_compatibility_runtime.json",
  registry: "architecture/guards/migration_bridge_registry.json",
  packageContract: "architecture/build/package_contract.json",
  index: "index.html",
  debtRegistry: "architecture/guards/known_debt_registry.json",
});
// A bridge lives until its classic consumer migrates: the consumer boundary names that stage.
const REMOVAL_BY_CONSUMER_BOUNDARY = Object.freeze({
  "game-config-raw": "stage-4", "game-config": "stage-4", "game-application-ports": "stage-4",
  "game-application": "stage-4", platform: "stage-4", "game-presentation": "stage-5",
  "bootstrap-production": "stage-5", "entrypoint-game": "stage-5", dev: "stage-6",
  "bootstrap-development": "stage-6", "entrypoint-dev": "stage-6",
});
const ACTIVATION_REASON = "Preserve the exact observed classic surface for unmigrated consumers.";
const VERIFY_CHECKS = Object.freeze([
  "utils/architecture/architecture-guard-corpus-check.js",
  "utils/architecture/migration-manifest-integrity-check.js",
  "utils/architecture/package-contract-check.js",
  "utils/architecture/stage-3-runtime-load-order-check.js",
  "utils/architecture/domain-boundary-check.js",
  "utils/architecture/stage-4-cluster-records-check.js",
]);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const canonical = (value) => `${JSON.stringify(value, null, 2)}\n`;
const byId = (left, right) => left.id.localeCompare(right.id);
const latestStage = (stages) => [...stages].sort().at(-1);

function resolveImportSource({ provider, symbol, consumer, memberTargets, entries, registry, candidate = null,
  readSource = file => fs.readFileSync(file, "utf8") }) {
  const member = memberTargets.get(provider?.currentPath);
  if (member) return member;
  if (provider?.currentPath.startsWith("src/engine/compat/stage_2/")) {
    const bridges = registry.bridges.filter(item => item.source === consumer && item.bridge === provider.currentPath &&
      item.globalProviders.some(surface => surface.symbol === symbol));
    assert.equal(bridges.length, 1, `${consumer}: ${symbol} needs one exact registered Stage 2 bridge`);
    const target = entries.get(bridges[0].target);
    assert(target && ["esm", "verified"].includes(target.architecture.migrationStatus), "Stage 2 target is not ESM");
    return target.currentPath;
  }
  if (provider?.architecture.roles.includes("compatibility-bridge")) {
    const target = provider.architecture.targetPath;
    if (candidate && candidate !== target && entries.get(target)?.architecture.targetBoundary === "game-config-raw") {
      const facade = entries.get(candidate);
      assert(facade?.architecture.targetBoundary === "game-config" &&
        facade.architecture.migrationStatus === "verified" && facade.architecture.targetPath === candidate,
      "config facade must be a verified GameConfig module");
      const tree = espree.parse(readSource(candidate), { ecmaVersion: "latest", sourceType: "module" });
      const [input, output] = tree.body;
      const binding = input?.specifiers?.[0], declaration = output?.declaration?.declarations?.[0];
      assert(tree.body.length === 2 && input.type === "ImportDeclaration" && input.specifiers.length === 1 &&
        binding.type === "ImportSpecifier" && binding.imported.name === symbol &&
        typeof input.source.value === "string" && input.source.value.startsWith(".") && input.source.value.endsWith(".js") &&
        path.posix.normalize(path.posix.join(path.posix.dirname(candidate), input.source.value)) === target &&
        output.type === "ExportNamedDeclaration" && !output.source && output.declaration?.type === "VariableDeclaration" &&
        output.declaration.kind === "const" && output.declaration.declarations.length === 1 &&
        declaration.id.type === "Identifier" && declaration.id.name === symbol && declaration.init?.type === "Identifier" &&
        declaration.init.name === binding.local.name,
      "config facade must preserve the exact imported object with no logic, allocation or additional export");
      return candidate;
    }
    return target;
  }
  if (provider && ["esm", "verified"].includes(provider.architecture.migrationStatus) &&
      provider.architecture.targetPath === provider.currentPath) return provider.currentPath;
  return null;
}

class StageFourWorkspace {
  constructor(root) { this.root = root; }
  path(file) { return path.join(this.root, file); }
  exists(file) { return fs.existsSync(this.path(file)); }
  text(file) { return fs.readFileSync(this.path(file), "utf8"); }
  // Files the cluster path rewrites must already be canonical, so a rewrite changes only the planned facts.
  json(file, { strict = true } = {}) {
    const text = this.text(file);
    const value = JSON.parse(text);
    if (strict && canonical(value) !== text) throw new Error(`${file} is not canonical JSON`);
    return value;
  }
  write(file, text) {
    fs.mkdirSync(path.dirname(this.path(file)), { recursive: true });
    fs.writeFileSync(this.path(file), text);
  }
  hash(file) { return this.exists(file) ? sha256(fs.readFileSync(this.path(file))) : null; }
  node(script, args = []) {
    const result = childProcess.spawnSync(process.execPath, [script, ...args], { cwd: this.root, encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024 });
    return { status: result.status, stdout: result.stdout || "", stderr: result.stderr || "" };
  }
  git(args) {
    const result = childProcess.spawnSync("git", args, { cwd: this.root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
    return result.stdout;
  }
}

// Dry run (step 1): every fact apply will write, derived from the Manifest, the runtime contract, the
// bridge registry and index.html. Any fact the cluster record does not declare fails here.
class StageFourClusterPlan {
  constructor(workspace, record) {
    this.workspace = workspace;
    this.record = record;
    // Stage-qualified identities: owner, activation floor and bridge stage come from the record kind.
    this.stage = recordStage(record);
    this.owner = `stage-${this.stage}.cluster-${record.id}-${record.slug}`;
  }

  build() {
    const { workspace, record } = this;
    assert(!record.deferred, `cluster ${record.id} is deferred to ${record.deferred?.stage}`);
    // Tier evidence is declared before apply: A needs a hot-loop or save round-trip command, B an API parity one.
    const kinds = new Set((record.evidenceCommands || []).map((item) => item.kind));
    const required = { A: ["hot-loop", "save-round-trip"], B: ["api-parity"] }[record.tier] || [];
    assert(required.length === 0 || required.some((kind) => kinds.has(kind)),
      `tier ${record.tier} needs an evidenceCommands entry of kind ${required.join(" or ")}`);
    const manifest = workspace.json(PATHS.manifest);
    const contract = workspace.json(PATHS.contract);
    const registry = workspace.json(PATHS.registry);
    const legacyDocument = path.basename(LegacyScriptOrderReader.sourcePath(path.dirname(workspace.path(PATHS.index)),
      workspace.json(PATHS.policy, { strict: false })));
    const entries = new Map(manifest.modules.map((entry) => [entry.currentPath, entry]));
    const members = new Map(record.modules.map((module) => [module.currentPath, module]));
    const memberTargets = new Map(record.modules.map((module) => [module.currentPath, module.targetPath]));
    const projector = new StageFourEsmTargetProjector();
    const targets = record.modules.map((module) => {
      const entry = entries.get(module.currentPath);
      assert(entry, `${module.currentPath}: no Manifest entry`);
      assert.equal(entry.architecture.targetBoundary, record.boundary, `${module.currentPath}: boundary differs`);
      assert.equal(entry.architecture.targetPath, module.targetPath, `${module.currentPath}: targetPath differs`);
      assert(!entries.has(module.targetPath) && !workspace.exists(module.targetPath), `${module.targetPath} exists`);
      // A Manifest blocker is resolved only by a written review in the record (framework Q9: reclassify with evidence).
      assert.deepEqual([...entry.analysis.blockers.items].sort(),
        (module.reviewedBlockers || []).map((item) => item.blocker).sort(), `${module.currentPath}: blockers need reviewedBlockers`);
      assert((module.reviewedBlockers || []).every((item) => item.reason), `${module.currentPath}: reviewed blocker without reason`);
      this.#assertImports(module, entry, entries, memberTargets, registry);
      const projected = projector.project({ source: workspace.text(module.currentPath), currentPath: module.currentPath,
        targetPath: module.targetPath, boundary: record.boundary, exports: module.exports, imports: module.imports || [],
        allowedGlobals: module.allowedGlobals || [] });
      // Classic providers: the declaration's mechanism plus the property of each moved exposure statement.
      assert.deepEqual(entry.observed.providers.items.map((item) => `${item.symbol}:${item.mechanism}`).sort(),
        [...projected.providerMechanisms,
          ...projected.exposures.map((item) => `${item.symbol}:${item.mechanism}`)].sort(), `${module.currentPath}: providers differ`);
      const needsReview = projected.evaluation.classification === "needs-review";
      assert.equal(Boolean(module.sideEffectReview), needsReview,
        `${module.targetPath}: sideEffectReview ${needsReview ? "is required" : "must be absent"} ` +
        `(${JSON.stringify(projected.evaluation.observations)})`);
      return { ...projected, module, entry, roles: entry.architecture.roles,
        review: needsReview ? { decision: "approved-compatible", evidenceFingerprint: projected.evaluation.evidenceFingerprint,
          module: module.targetPath, owner: this.owner, reason: module.sideEffectReview } : null };
    });
    const consumers = this.#consumers(manifest, members);
    const activations = [];
    const inert = [];
    const bridgesAdded = [];
    for (const target of targets) {
      const { currentPath, targetPath } = target.module;
      const slot = target.entry.observed.legacyLoadOrder;
      const own = consumers.filter((item) => item.provider === currentPath);
      for (const symbol of target.module.exports) {
        const readers = own.filter((item) => item.symbols.includes(symbol));
        if (readers.length === 0) continue;
        const identity = { exportName: symbol, legacyScriptIndex: slot, legacySymbol: symbol,
          shimFile: `activations/${String(slot).padStart(3, "0")}_${symbol.toLowerCase()}.js`,
          sourceProvider: currentPath, targetModule: targetPath };
        activations.push({ ...identity, id: CanonicalActivationIdentity.id(identity), owner: this.owner,
          reason: ACTIVATION_REASON, removalStage: latestStage([`stage-${this.stage}`, ...readers.map((item) => item.removalStage)]) });
      }
      if (!activations.some((item) => item.sourceProvider === currentPath)) {
        inert.push({ owner: this.owner, sourceProvider: currentPath, targetModule: targetPath });
      }
      for (const reader of own) {
        const symbols = reader.symbols.filter((symbol) => target.module.exports.includes(symbol)).sort();
        const identity = { bridge: currentPath, owner: this.owner, source: reader.consumer, target: targetPath };
        bridgesAdded.push({ id: CanonicalBridgeIdentity.id(identity), ...identity,
          reason: `Preserve the exact ${symbols.join(", ")} consumer until its legacy symbol is removed.`,
          introducedStage: `stage-${this.stage}`, removalStage: latestStage([`stage-${this.stage}`, reader.removalStage]),
          globalProviders: symbols.map((symbol) => ({ symbol, mechanism: "global-this-property" })) });
      }
    }
    const bridgesRetired = registry.bridges.filter((bridge) => members.has(bridge.source)).map((bridge) => bridge.id).sort();
    // An earlier activation whose last bridge retires here has no classic reader left: it retires too.
    const remaining = registry.bridges.filter((bridge) => !bridgesRetired.includes(bridge.id));
    const retiredActivations = contract.activationPositions.filter((activation) => !remaining.some((bridge) =>
      bridge.target === activation.targetModule && bridge.globalProviders.some((item) =>
        item.symbol === activation.legacySymbol && item.mechanism === "global-this-property")))
      .sort(byId);
    // Stage 2 source providers are generated IIFEs; their registered ESM wrappers contain the original
    // exposure assignment. Wrapper validation proves that surface separately, so it is not a reader.
    const retiredWrappers = registry.bridges.filter(bridge => retiredActivations.some(activation =>
      activation.sourceProvider.startsWith("dist/legacy-bridges/") && bridge.target === activation.targetModule &&
      bridge.globalProviders.some(surface => surface.symbol === activation.legacySymbol)))
      .map(bridge => ({file:bridge.bridge,activationIds:retiredActivations.filter(activation =>
        activation.targetModule === bridge.target).map(activation => activation.id)}));
    const retiredStageTwoWrappers = [...new Map(retiredWrappers.map(wrapper => [wrapper.file,wrapper])).values()];
    const retiringSources = new Map([...members, ...retiredActivations.map((item) => [item.sourceProvider, null]),
      ...retiredStageTwoWrappers.map(wrapper => [wrapper.file,null])]);
    assert.deepEqual(this.#propertyReaders(retiredActivations.map((item) => item.legacySymbol), retiringSources), [],
      "a retiring activation still has property readers outside the migrating consumers and shims");
    const load = CumulativeRuntimeLoadSlot.read({ html: workspace.text(legacyDocument),
      aliases: new StageThreeRuntimeScriptAliasResolver().resolve(contract),
      runtimePath: contract.output.directory + contract.output.runtimeFile });
    const early = activations.filter((item) => item.legacyScriptIndex < load.slot ||
      (item.legacyScriptIndex === load.slot && !load.precedesWholeSlot));
    assert.deepEqual(early.map((item) => item.id), [],
      `activations before the runtime tag (slot ${load.slot}): ${early.map((item) => item.shimFile).join(", ")}`);
    // An exposed property without an activation disappears: nothing may read it as a property.
    const dropped = targets.flatMap((target) => target.exposures.map((item) => item.symbol))
      .filter((symbol) => !activations.some((item) => item.legacySymbol === symbol));
    assert.deepEqual(this.#propertyReaders(dropped, members), [], "a dropped exposure still has property readers");
    const propertyReaders = this.#propertyReaders(activations.map((item) => item.legacySymbol), members);
    assert.deepEqual(propertyReaders.map((item) => `${item.file}:${item.symbol}`),
      (record.reviewedPropertyReaders || []).map((item) => `${item.file}:${item.symbol}`).sort(),
      "global property readers that wake up when an activation exposes the symbol must be reviewed");
    return { owner: this.owner, stage: this.stage, legacyDocument, targets, consumers, activations: activations.sort(byId), inert, retiredActivations, retiredStageTwoWrappers,
      bridgesAdded: bridgesAdded.sort(byId), bridgesRetired, runtimeSlot: load.slot, propertyReaders,
      importEdges: targets.flatMap((target) => (target.module.imports || []).map((item) =>
        `${target.module.targetPath}->${item.from}`)) };
  }

  // Every confirmed dependency symbol is imported from its ESM target (a member or an already migrated
  // module): an ESM target never reads a classic global.
  #assertImports(module, entry, entries, memberTargets, registry) {
    const dependencies = entry.analysis.dependencies;
    assert.deepEqual([...dependencies.unresolved, ...dependencies.ambiguous], [],
      `${module.currentPath}: unresolved or ambiguous dependencies`);
    const expected = dependencies.items.flatMap((item) => {
      const provider = entries.get(item.target);
      return item.symbols.map((symbol) => {
        const from = resolveImportSource({ provider, symbol, consumer: module.currentPath, memberTargets, entries, registry,
          candidate: module.imports?.find(item => item.symbol === symbol)?.from, readSource: file => this.workspace.text(file) });
        assert(from, `${module.currentPath}: dependency ${item.target} is still classic (migrate it first)`);
        return `${symbol}<-${from}`;
      });
    }).sort();
    assert.deepEqual((module.imports || []).map((item) => `${item.symbol}<-${item.from}`).sort(), expected,
      `${module.currentPath}: imports must equal the confirmed dependencies`);
  }

  #consumers(manifest, members) {
    const result = [];
    for (const entry of manifest.modules) {
      if (members.has(entry.currentPath)) continue;
      for (const item of entry.analysis?.dependencies?.items || []) {
        if (!members.has(item.target)) continue;
        const removalStage = REMOVAL_BY_CONSUMER_BOUNDARY[entry.architecture.targetBoundary];
        assert(removalStage, `${entry.currentPath}: no removal stage for ${entry.architecture.targetBoundary}`);
        result.push({ consumer: entry.currentPath, provider: item.target, symbols: [...item.symbols].sort(),
          boundary: entry.architecture.targetBoundary, removalStage });
      }
    }
    return result.sort((left, right) => `${left.provider}\u0000${left.consumer}`
      .localeCompare(`${right.provider}\u0000${right.consumer}`));
  }

  // A `globalThis.X` / `window.X` read of a global-lexical provider is always undefined today; an activation
  // makes it defined, so such dead fallbacks must be removed first or reviewed explicitly.
  #propertyReaders(symbols, members) {
    if (symbols.length === 0) return [];
    const pattern = new RegExp(`\\b(?:globalThis|window|self)\\s*(?:\\.\\s*(${symbols.join("|")})\\b|` +
      `\\[\\s*["'](${symbols.join("|")})["']\\s*\\])`, "gu");
    const result = [];
    const walk = (directory) => {
      for (const item of fs.readdirSync(this.workspace.path(directory), { withFileTypes: true })) {
        const file = `${directory}/${item.name}`;
        if (item.isDirectory()) walk(file);
        else if (file.endsWith(".js") && !members.has(file)) {
          for (const match of this.workspace.text(file).matchAll(pattern)) {
            result.push({ file, symbol: match[1] || match[2] });
          }
        }
      }
    };
    walk("src");
    const unique = new Map(result.map((item) => [`${item.file}:${item.symbol}`, item]));
    return [...unique.values()].sort((left, right) => `${left.file}:${left.symbol}`.localeCompare(`${right.file}:${right.symbol}`));
  }
}

// Step 2: writes the planned facts, refreshes Manifest observations, rebuilds the runtime and records the
// before/after hashes. Rollback is `git revert` of the cluster commit, so touched files must be clean.
class StageFourClusterApply {
  constructor(workspace, recordFile) {
    this.workspace = workspace;
    this.recordFile = recordFile;
  }

  run() {
    const { workspace } = this;
    const record = workspace.json(this.recordFile);
    assert.equal(record.output, null, "cluster record is already applied");
    const plan = new StageFourClusterPlan(workspace, record).build();
    const touched = [...new Set([...Object.values(PATHS).filter((file) => file !== PATHS.policy).map(file => file === PATHS.index ? plan.legacyDocument : file),
      ...plan.targets.flatMap((target) => [target.module.currentPath, target.module.targetPath]),
      ...plan.retiredActivations.map((item) => item.sourceProvider), ...plan.retiredStageTwoWrappers.map(item => item.file)])].sort();
    const dirty = workspace.git(["status", "--porcelain", "--", ...touched]).trim();
    // Exception: the Manifest may differ from HEAD only by the classification of this cluster's own modules, when it
    // cannot land earlier without a guard failure (018: a consumer bridge that retires only on apply).
    const reclassifiesOnly = dirty === `M ${PATHS.manifest}` && StageFourClusterApply.onlyReclassifies(
      JSON.parse(workspace.git(["show", `HEAD:${PATHS.manifest}`])), workspace.json(PATHS.manifest), record);
    assert(dirty === "" || reclassifiesOnly, `touched files must be committed before apply:\n${dirty}`);
    const before = new Map(touched.map((file) => [file, workspace.hash(file)]));
    const gameCycleBefore = this.#gameCycle("before", record.id, recordStage(record));
    // Every write is computed first; a failure after the first write restores the exact original bytes.
    const contract = workspace.json(PATHS.contract);
    const shim = new ActivationShimRenderer();
    const writes = new Map();
    let index = workspace.text(plan.legacyDocument);
    for (const target of plan.targets) {
      const { currentPath, targetPath, exports } = target.module;
      writes.set(targetPath, target.targetSource);
      const activations = plan.activations.filter((item) => item.sourceProvider === currentPath);
      writes.set(currentPath, activations.length > 0
        ? activations.map((item) => shim.render(item, contract.transport.symbol)).join("")
        : new MigratedSourcePlaceholder().render({ currentPath, targetPath, exports, stage: `Stage ${plan.stage}` }));
      if (activations.length === 0) continue;
      const tag = new RegExp(`<script src="${currentPath.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}(?:\\?[^"]*)?"` +
        `( data-legacy-slot="\\d+")?></script>`, "gu");
      const matches = [...index.matchAll(tag)];
      assert.equal(matches.length, 1, `${currentPath}: expected one classic tag`);
      index = index.replace(tag, activations.map((item) =>
        `<script src="${contract.output.directory}${item.shimFile}"${matches[0][1] || ""}></script>`).join("\n"));
    }
    const retirement = new ActivationRetirementProjection();
    const future = retirement.contract({ ...contract,
      activationPositions: [...contract.activationPositions, ...plan.activations].sort(byId),
      inertModules: [...(contract.inertModules || []), ...plan.inert]
        .sort((left, right) => left.targetModule.localeCompare(right.targetModule)),
      sideEffectReviews: [...contract.sideEffectReviews, ...plan.targets.map((target) => target.review).filter(Boolean)] },
    plan.retiredActivations, plan.owner);
    // A retired source keeps its legacy position: an inert placeholder, or the shims of its still-active activations.
    const shared = ActivationRetirementProjection.sharedSources({ activationPositions: contract.activationPositions },
      plan.retiredActivations);
    for (const { sourceProvider, activations } of RetiredActivationPlaceholder.byProvider(plan.retiredActivations)) {
      writes.set(sourceProvider, shared.has(sourceProvider)
        ? future.activationPositions.filter((item) => item.sourceProvider === sourceProvider)
          .map((item) => shim.render(item, contract.transport.symbol)).join("")
        : new RetiredActivationPlaceholder().renderProvider(future.retiredActivations
          .filter(item => item.activation.sourceProvider === sourceProvider).map(item => item.activation)));
    }
    writes.set(plan.legacyDocument, retirement.index(index, contract.output.directory, plan.retiredActivations, shared));
    for (const wrapper of plan.retiredStageTwoWrappers) writes.set(wrapper.file,
      new RetiredActivationPlaceholder().renderProvider(plan.retiredActivations.filter(item => wrapper.activationIds.includes(item.id))));
    new CumulativeRuntimeContractValidator().validate(future);
    writes.set(PATHS.contract, canonical(future));
    const registry = workspace.json(PATHS.registry);
    const retired = new Set(plan.bridgesRetired);
    const nextRegistry = { ...registry, bridges: [...registry.bridges.filter((bridge) => !retired.has(bridge.id)),
      ...plan.bridgesAdded].sort(byId) };
    new MigrationBridgeRegistryValidator().validate(nextRegistry);
    writes.set(PATHS.registry, canonical(nextRegistry));
    writes.set(PATHS.manifest, canonical(this.#manifest(plan)));
    writes.set(PATHS.packageContract, this.#packageContract(future, plan.stage));
    writes.set(PATHS.debtRegistry, workspace.text(PATHS.debtRegistry));
    const applied = { ...record, output: { status: "applied", owner: plan.owner, runtimeSlot: plan.runtimeSlot,
      targets: plan.targets.map((target) => ({ currentPath: target.module.currentPath, targetPath: target.module.targetPath,
        sourceSha256: target.sourceSha256, targetSha256: target.targetSha256 })),
      activations: plan.activations.map((item) => item.id), inertModules: plan.inert.map((item) => item.targetModule),
      sideEffectReviews: plan.targets.filter((target) => target.review).map((target) => target.module.targetPath),
      activationsRetired: plan.retiredActivations.map((item) => item.id),
      retiredStageTwoWrappers: plan.retiredStageTwoWrappers,
      bridgesAdded: plan.bridgesAdded.map((item) => item.id), bridgesRetired: plan.bridgesRetired,
      importEdges: plan.importEdges, gameCycleBefore, files: [] } };
    writes.set(this.recordFile, canonical(applied));
    const originals = new Map([...writes.keys()].map((file) =>
      [file, workspace.exists(file) ? fs.readFileSync(workspace.path(file)) : null]));
    try {
      for (const [file, text] of writes) workspace.write(file, text);
      for (const [script, label] of [["utils/architecture/persist-migration-observations.js", "observe"],
        ["utils/build/build_stage_3_compat_runtime.js", "runtime build"]]) {
        const result = workspace.node(script);
        assert.equal(result.status, 0, `${label} failed:\n${result.stderr || result.stdout}`);
      }
      const debtRegistry = workspace.json(PATHS.debtRegistry);
      const snapshot = new ArchitectureGuardSnapshotBuilder({projectRoot:workspace.root,
        policy:workspace.json(PATHS.policy,{strict:false}),manifest:workspace.json(PATHS.manifest),
        bridgeRegistry:workspace.json(PATHS.registry),globalBaseline:workspace.json("architecture/guards/global_provider_baseline.json"),
        debtRegistry}).build();
      const report = new ArchitectureGuardEngine({projectRoot:workspace.root}).run(snapshot);
      assert.deepEqual(report.diagnostics.filter(item => item.status === "FAIL" && item.rule !== "stale-known-debt"), [],
        "migration introduced an architecture failure");
      const resolved = debtRegistry.debts.filter(debt => report.diagnostics.some(item =>
        item.rule === "stale-known-debt" && item.message.endsWith(debt.id)));
      assert(resolved.every(debt => plan.targets.some(target => target.module.currentPath === debt.source)),
        "stale debt outside the migrating source requires a separate preparation");
      applied.output.resolvedDebts = resolved.map(debt => debt.id);
      workspace.write(PATHS.debtRegistry, canonical({...debtRegistry,debts:debtRegistry.debts.filter(debt => !resolved.includes(debt))}));
    } catch (error) {
      for (const [file, bytes] of originals) {
        if (bytes === null) fs.rmSync(workspace.path(file), { force: true });
        else fs.writeFileSync(workspace.path(file), bytes);
      }
      throw new Error(`apply restored every written file: ${error.message}`);
    }
    applied.output.files = touched.map((file) => ({ path: file, before: before.get(file), after: workspace.hash(file) }));
    workspace.write(this.recordFile, canonical(applied));
    return { record: applied, plan };
  }

  #manifest(plan) {
    const { workspace } = this;
    const manifest = workspace.json(PATHS.manifest);
    const policy = workspace.json(PATHS.policy, { strict: false });
    const factory = new ManifestEntryFactory({ manifestPolicy: policy.migrationManifest,
      currentAreaResolver: new CurrentAreaResolver({ rootValue: policy.migrationManifest.currentArea.rootValue }) });
    for (const target of plan.targets) {
      const entry = factory.create({ currentPath: target.module.targetPath }, null);
      entry.architecture = { migrationStatus: "verified", roles: [...target.roles],
        targetBoundary: target.entry.architecture.targetBoundary, targetPath: target.module.targetPath, migrationWave: target.entry.architecture.migrationWave };
      entry.analysis.blockers = { status: "verified", items: [] };
      manifest.modules.push(entry);
      manifest.modules.find((item) => item.currentPath === target.module.currentPath).architecture.roles =
        ["compatibility-bridge"];
    }
    manifest.modules.sort((left, right) => (left.currentPath < right.currentPath ? -1 : 1));
    return manifest;
  }

  // The package contract mirrors the live runtime: Stage S.N once this is the Nth applied cluster of stage S.
  #packageContract(contract, stage) {
    const packageContract = this.workspace.json(PATHS.packageContract);
    packageContract.stage.current = `${stage}.${StageFourClusterLedger.read(this.workspace.root, stage).applied.length + 1}`;
    packageContract.stage.cumulativeRuntimeBuild.runtimeInputs = new Set([...[...contract.activationPositions,
      ...(contract.retiredActivations || []).map((item) => item.activation)].map((item) => item.targetModule),
    ...(contract.inertModules || []).map((item) => item.targetModule)]).size;
    packageContract.stage.cumulativeRuntimeBuild.activationInputs = contract.activationPositions.length;
    return canonical(packageContract);
  }

  // True when `current` equals `head` except for the architecture classification of the record's modules.
  static onlyReclassifies(head, current, record) {
    const own = new Set(record.modules.map((module) => module.currentPath));
    const headEntries = new Map(head.modules.map((entry) => [entry.currentPath, entry]));
    const restored = { ...current, modules: current.modules.map((entry) => own.has(entry.currentPath) &&
      headEntries.has(entry.currentPath) ? { ...entry, architecture: headEntries.get(entry.currentPath).architecture } : entry) };
    return canonical(restored) === canonical(head) && canonical(current) !== canonical(head);
  }

  #gameCycle(phase, id, stage = 4) {
    const result = this.workspace.node("utils/game-cycle-check.js");
    assert.equal(result.status, 0, `game-cycle ${phase} failed:\n${result.stderr || result.stdout}`);
    const file = `node_modules/.cache/stage-${stage}-clusters/${id}_game_cycle_${phase}.txt`;
    this.workspace.write(file, result.stdout);
    return { file, sha256: sha256(result.stdout), lines: result.stdout.split("\n").length - 1 };
  }

  gameCycle(phase, id, stage = 4) { return this.#gameCycle(phase, id, stage); }
}

// Step 3: guards and tier evidence on the applied tree (C: guards + identical game-cycle output; B and A add
// the parity / hot-loop commands named by the record). Results are recorded in `verification`.
class StageFourClusterVerify {
  constructor(workspace, recordFile) {
    this.workspace = workspace;
    this.recordFile = recordFile;
  }

  run() {
    const { workspace } = this;
    const record = workspace.json(this.recordFile);
    assert.equal(record.output?.status, "applied", "cluster record is not applied");
    for (const target of record.output.targets) {
      assert.equal(workspace.hash(target.targetPath), target.targetSha256, `${target.targetPath} changed after apply`);
    }
    const manifest = workspace.json(PATHS.manifest);
    for (const target of record.output.targets) {
      const entry = manifest.modules.find((item) => item.currentPath === target.targetPath);
      assert.deepEqual(entry.observed.consumers.items, [], `${target.targetPath} reads classic globals`);
      if (record.boundary !== "platform") assert.deepEqual(entry.observed.environment.browserApis, []);
      assert.deepEqual(entry.analysis.dependencies.unresolved, []);
    }
    const guards = VERIFY_CHECKS.map((check) => {
      const result = workspace.node(check);
      return { check, status: result.status === 0 ? "PASS" : "FAIL",
        summary: (result.status === 0 ? result.stdout : result.stderr || result.stdout).trim().split("\n").at(-1).slice(0, 300) };
    });
    const gameCycleAfter = new StageFourClusterApply(workspace, this.recordFile).gameCycle("after", record.id, recordStage(record));
    const evidence = (record.evidenceCommands || []).map((item) => {
      const result = workspace.node(item.script, item.args || []);
      return { name: item.name, status: result.status === 0 ? "PASS" : "FAIL", sha256: sha256(result.stdout) };
    });
    const verification = { guards, gameCycle: { before: record.output.gameCycleBefore.sha256,
      after: gameCycleAfter.sha256, identical: gameCycleAfter.sha256 === record.output.gameCycleBefore.sha256 },
    evidence };
    workspace.write(this.recordFile, canonical({ ...record, verification }));
    const failed = [...guards, ...evidence].filter((item) => item.status !== "PASS");
    return { verification, passed: failed.length === 0 && verification.gameCycle.identical };
  }
}

function recordFileFor(root, id, stage = 4) {
  const relative = stageDirectories(stage).clusters;
  const directory = path.join(root, relative);
  const name = fs.existsSync(directory) ? fs.readdirSync(directory).find((file) => file.startsWith(`${id}_`)) : null;
  if (!name) throw new Error(`No Stage ${stage} cluster record ${id} in ${relative}`);
  return `${relative}/${name}`;
}

module.exports = { PATHS, RECORD_KIND, REMOVAL_BY_CONSUMER_BOUNDARY, StageFourClusterApply, StageFourClusterPlan,
  StageFourClusterVerify, StageFourWorkspace, recordFileFor, resolveImportSource };
