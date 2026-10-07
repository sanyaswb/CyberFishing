"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { NativeDevelopmentArchive } = require("./native_development_archive");
const { CanonicalBridgeIdentity } = require("../../build/legacy_bridge_build_config");
const { CanonicalActivationIdentity } = require("../../build/compat_runtime/cumulative_runtime_contract");

const PREPARATION = "architecture/migration/stage_6/preparations/005_native-development-cutover-and-compatibility-retirement.json";
const DECISION = "architecture/migration/stage_6/stage6_spec.md";

// An exact removal successor, never a new exception or a relaxed classic-runtime whitelist.
class NativeDevelopmentRetirement {
  static validateRecord(record) {
    assert(record.kind === "cyber-fishing-stage-6-preparation" && record.id === "005" &&
      record.postClosureCleanup?.decision === DECISION && record.postClosureCleanup.phase === "native-development-cutover" &&
      record.postClosureCleanup.closureTag === "stage5-closed" &&
      record.postClosureCleanup.archiveTag === "stage6-classic-runtime-archive" &&
      /^[0-9a-f]{40}$/u.test(record.postClosureCleanup.archiveCommit), "cleanup exact Stage 6 recovery and decision");
    const removed = new Set();
    assert.equal(record.removedModules.length,444,"cleanup exact final classic and Stage 2 wrapper inventory");
    for (const item of record.removedModules) {
      assert(/^src\/.+\.js$/u.test(item.path) && !item.path.includes("..") && !removed.has(item.path) &&
        /^[0-9a-f]{64}$/u.test(item.before) && /^[0-9a-f]{40}$/u.test(item.gitBlob) &&
        item.manifest.currentPath === item.path,"cleanup module identity and raw recovery");
      removed.add(item.path);
    }
    assert.equal(record.removedBridges.length,50,"cleanup exact last bridges");
    assert.equal(record.removedActivations.length,26,"cleanup exact last activations");
    assert.equal(record.removedDebtRecords.length,19,"cleanup exact last debts");
    assert.equal(record.removedGlobalProviders.length,852,"cleanup exact frozen provider baseline");
    assert.equal(record.removedLegacySlots.length,420,"cleanup exact remaining logical slots");
    for (const bridge of record.removedBridges) assert(bridge.id === CanonicalBridgeIdentity.id(bridge) && removed.has(bridge.source),"cleanup bridge exact holder");
    for (const activation of record.removedActivations) assert(activation.id === CanonicalActivationIdentity.id(activation) &&
      (removed.has(activation.sourceProvider) || record.stageTwoProviderSuccessors?.some(item =>
        item.outputPath === activation.sourceProvider && item.targetModule === activation.targetModule &&
        removed.has(item.wrapperPath) && item.globalProviders.some(surface => surface.symbol === activation.legacySymbol))) &&
      record.removedBridges.some(bridge=>bridge.target === activation.targetModule &&
        bridge.globalProviders.some(surface=>surface.symbol === activation.legacySymbol)),"cleanup activation exact holder");
    assert.deepEqual(record.resolvedDebts,record.removedDebtRecords.map(item=>item.id),"cleanup exact resolved debts");
    assert(record.removedDebtRecords.every(item=>removed.has(item.source)),"cleanup debt owner");
    const earlier = record.alreadyRetiredProviderFacts || [];
    assert.equal(earlier.length,22,"cleanup prior provider provenance");
    assert(record.removedGlobalProviders.every(provider=>removed.has(provider.currentPath) || earlier.some(item=>
      JSON.stringify(item.provider) === JSON.stringify(provider) && /^(?:stage-2\.[1-4]-.+|stage-5\.preparation-031)$/u.test(item.retiredBy))),
      "cleanup provider loses its exact current or already retired owner");
    assert.equal(new Set(record.nativeReplacements.map(item=>item.source)).size,100,"cleanup exact canonical replacements");
    assert(record.nativeReplacements.every(item=>removed.has(item.source) && item.reason && item.targets.length &&
      item.targets.every(target=>/^src\/.+\.js$/u.test(target)&&!removed.has(target))),"cleanup native replacement ownership");
    assert.equal(record.legacySlotSplits.before.length,13,"cleanup exact reviewed splits");
    assert.deepEqual(record.legacySlotSplits.after,[],"cleanup no remaining classic split");
  }

  // Modules removed after stage6-closed by a recorded post-closure cleanup (exact bytes in its recovery archive).
  static laterRemovedTargets(projectRoot) {
    const directory=path.join(projectRoot,"architecture/migration/stage_6/preparations");
    return new Set(fs.readdirSync(directory).filter(name=>name.endsWith(".json"))
      .map(name=>JSON.parse(fs.readFileSync(path.join(directory,name),"utf8")))
      .filter(item=>item.postClosureCleanup?.phase === "post-closure-cleanup").flatMap(item=>item.removedModules.map(module=>module.path)));
  }

  // Every native successor exists, unless a later Stage 6 post-closure cleanup removed it with exact recovery bytes.
  static validateReplacementTargets(record, isPresent, laterRemoved = new Set()) {
    for (const item of record.nativeReplacements) for (const target of item.targets)
      assert(isPresent(target) !== laterRemoved.has(target),"cleanup native successor is missing: " + target);
  }

  static archive(projectRoot, record) {
    return new NativeDevelopmentArchive(projectRoot, record);
  }

  static read(projectRoot) {
    if (!fs.existsSync(path.join(projectRoot,"architecture/migration/stage_3_compatibility_runtime.json"))) return null;
    const read=file=>fs.readFileSync(path.join(projectRoot,file));
    const json=file=>JSON.parse(read(file));
    const contract=json("architecture/migration/stage_3_compatibility_runtime.json");
    if (contract.nativeRetirement === undefined) return null;
    assert.deepEqual(contract.nativeRetirement,{stage:6,decision:DECISION,preparation:PREPARATION,
      productionEntrypoint:"src/entrypoints/game.entry.js",developmentEntrypoint:"src/entrypoints/dev.entry.js"},"cleanup unreviewed native retirement");
    const record=json(PREPARATION);
    this.validateRecord(record);
    const providers=json("architecture/migration/stage_2_approved_batches.json").batches
      .flatMap(batch=>batch.bridgeStrategy?.bridges || []);
    assert.deepEqual(record.stageTwoProviderSuccessors,providers.filter(item=>record.removedActivations.some(activation=>
      activation.sourceProvider===item.outputPath)),"cleanup exact frozen Stage 2 output ownership");
    const archive=this.archive(projectRoot,record).verifyIdentity();
    const archived = file => {
      assert(record.historicalMetadata.some(item=>item.path===file),"cleanup missing metadata recovery: " + file);
      return archive.json(file);
    };
    const original=archived("architecture/migration/stage_3_compatibility_runtime.json");
    assert.deepEqual(record.removedActivations,original.activationPositions,"cleanup exact archived activations");
    assert.deepEqual(record.removedInertModules,original.inertModules,"cleanup exact archived inert records");
    assert.deepEqual(record.removedSideEffectReviews,original.sideEffectReviews,"cleanup exact archived side effects");
    assert.deepEqual(contract.transport,original.transport,"cleanup historical transport metadata stays immutable");
    assert.deepEqual(contract.retiredActivations,original.retiredActivations,"cleanup historical activation provenance stays immutable");
    assert.deepEqual(record.removedBridges,archived("architecture/guards/migration_bridge_registry.json").bridges,"cleanup exact archived bridges");
    assert.deepEqual(record.removedDebtRecords,archived("architecture/guards/known_debt_registry.json").debts,"cleanup exact archived debts");
    assert.deepEqual(record.removedGlobalProviders,archived("architecture/guards/global_provider_baseline.json").providers,"cleanup exact archived provider baseline");
    assert.deepEqual(record.legacySlotSplits.before,archived("architecture/migration/legacy_slot_splits.json").splits,"cleanup exact archived split registry");
    for (const field of ["activationPositions","inertModules","sideEffectReviews"]) assert.deepEqual(contract[field],[],"cleanup active runtime records remain");
    assert.deepEqual(json("architecture/guards/migration_bridge_registry.json").bridges,[],"cleanup active bridges remain");
    assert.deepEqual(json("architecture/guards/known_debt_registry.json").debts,[],"cleanup active debts remain");
    assert.deepEqual(json("architecture/guards/global_provider_baseline.json").providers,[],"cleanup active provider baseline remains");
    const manifest=json("architecture/migration/module_migration_manifest.json");
    const entries=new Map(manifest.modules.map(item=>[item.currentPath,item]));
    for (const item of record.removedModules) assert(!entries.has(item.path) && !fs.existsSync(path.join(projectRoot,item.path)),"cleanup classic source still exists: " + item.path);
    this.validateReplacementTargets(record,target=>entries.has(target) && fs.existsSync(path.join(projectRoot,target)),
      this.laterRemovedTargets(projectRoot));
    const inventory=json("architecture/migration/stage_6/stage6_module_inventory.json");
    for (const item of inventory.migrationModules) assert(record.nativeReplacements.some(replacement=>replacement.source === item.source &&
      replacement.targets.length === 1 && replacement.targets[0] === item.target),"cleanup lost exact Stage 6 mapping: " + item.source);
    return record;
  }
}

module.exports={NativeDevelopmentRetirement,PREPARATION,DECISION};
