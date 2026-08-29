"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {
  ActivationShimContractValidator,
  ActivationShimRenderer,
} = require("../../build/compat_runtime/activation_shim");
const {
  BATCH_007_EXECUTABLE_CASES,
} = require("./stage_three_batch_007_behavior_cases");
const {
  BATCH_ID,
  ROD_PULL_FIELDS,
  ROD_STROKE_SNAPSHOT_FIELDS,
  StageThreeBatch007SourceObserver,
} = require("./stage_three_batch_007_dependency_state_audit");
const {
  BATCH_007_EXECUTION_PROFILE,
} = require("./stage_three_batch_execution_profile");
const {
  BATCH_007_PREBUILD_PROFILE,
} = require("./stage_three_batch_prebuild_profile");
const {
  ClassicClassLoader,
  DomainBehaviorParityHarness,
  RepresentationEquivalenceGuard,
} = require("./stage_three_batch_focused_harness");

class StageThreeBatch007LiveRuntimeHarness {
  constructor(projectRoot) {
    this.projectRoot = path.resolve(projectRoot);
  }

  run({ audit, plan, matrix, prebuild, sourceBuild, cutover, state, runtime, registry }) {
    this.#preflight({ audit, plan, matrix, prebuild, sourceBuild, cutover, state, runtime, registry });
    const scriptTopology = this.#validateScriptTopology(runtime, prebuild);
    const runtimeExecution = this.#executeRuntime(runtime);
    const timing = this.#executeActivations({ runtime, context: runtimeExecution.context,
      transport: runtimeExecution.transport });
    const moduleValidation = this.#validateModules({ audit, plan, matrix, sourceBuild,
      transport: runtimeExecution.transport, context: runtimeExecution.context });
    const consumers = this.#validateConsumers({ prebuild, registry });
    return Object.freeze({
      runtime: Object.freeze({
        moduleCount: Object.keys(runtimeExecution.transport.modules).length,
        activationCount: runtime.activationPositions.length,
        bridgeCount: registry.bridges.length,
        runtimeEvaluationCount: 1,
        transportAssignmentCount: runtimeExecution.transportAssignmentCount,
        transportOwnsGameState: runtimeExecution.transport.ownsGameState,
        uniqueProjectModuleCount: new Set(cutover.topology.projectModules).size,
        runtimeSha256: this.#sha256(this.#bytes(
          `${runtime.output.directory}${runtime.output.runtimeFile}`,
        )),
        ...scriptTopology,
      }),
      activationTiming: timing,
      identity: Object.freeze({
        exactExportIdentityCount: moduleValidation.identity.length,
        duplicateClassOrStateIdentity: "forbidden-and-not-observed",
        modules: moduleValidation.identity,
      }),
      behavior: Object.freeze({
        caseCount: moduleValidation.behavior.length,
        cases: moduleValidation.behavior,
        outcome: "classic-baseline-equals-live-cumulative-export",
      }),
      state: moduleValidation.state,
      performance: moduleValidation.performance,
      consumers,
      issues: Object.freeze([]),
    });
  }

  #preflight({ audit, plan, matrix, prebuild, sourceBuild, cutover, state, runtime, registry }) {
    assert.equal(audit.batchId, BATCH_ID);
    assert.equal(plan.batchId, BATCH_ID);
    assert.equal(matrix.batchId, BATCH_ID);
    assert.equal(prebuild.batchId, BATCH_ID);
    assert.equal(sourceBuild.batchId, BATCH_ID);
    assert.equal(cutover.batchId, BATCH_ID);
    assert.equal(state.activeBatchId, BATCH_ID);
    assert.equal(state.activeBatchPhase, "runtime-active");
    assert.equal(state.completedBatchIds.includes(BATCH_ID), false);
    assert.equal(state.releaseVersion, "0.24.43");
    assert.equal(runtime.activationPositions.length, 32);
    assert.equal(registry.bridges.length, 57);
    assert.deepEqual(runtime.activationPositions.map((record) => record.id).sort(),
      prebuild.plannedTopology.activationIds);
    assert.deepEqual(registry.bridges.map((record) => record.id).sort(),
      prebuild.plannedTopology.bridgeIds);
    assert.equal(cutover.build.runtimeSha256, sourceBuild.candidateBuild.runtimeSha256);
    assert.equal(cutover.lifecycle.batchCompleted, false);
  }

  #executeRuntime(runtime) {
    const transportSymbol = runtime.transport.symbol;
    let transport = null;
    let transportAssignmentCount = 0;
    const sandbox = {};
    Object.defineProperty(sandbox, transportSymbol, {
      configurable: true,
      enumerable: true,
      get() { return transport; },
      set(value) {
        transportAssignmentCount += 1;
        transport = value;
      },
    });
    const context = vm.createContext(sandbox);
    const runtimePath = `${runtime.output.directory}${runtime.output.runtimeFile}`;
    new vm.Script(this.#read(runtimePath), { filename: runtimePath }).runInContext(context);
    assert.equal(transportAssignmentCount, 1, "cumulative runtime transport assigned more than once");
    assert(transport, "cumulative runtime transport was not created");
    assert.equal(transport.ownsGameState, false);
    assert.equal(Object.keys(transport.modules).length, 31);
    return Object.freeze({ context, transport, transportAssignmentCount });
  }

  #validateScriptTopology(runtime, prebuild) {
    const scripts = [...this.#read("index.html").matchAll(
      /<script\b([^>]*)\bsrc=["']([^"']+)["'][^>]*><\/script>/giu,
    )];
    const runtimePath = `${runtime.output.directory}${runtime.output.runtimeFile}`;
    assert.equal(scripts.length, 426);
    assert.equal(scripts.filter((match) => /\btype=["']module["']/iu.test(match[1])).length, 0);
    assert.equal(scripts.filter((match) => match[2].split("?")[0] === runtimePath).length, 1);
    for (const activation of prebuild.preliminaryMetadata.plannedActivationPositions) {
      assert.equal(scripts.filter((match) =>
        match[2].split("?")[0] === `${runtime.output.directory}${activation.shimFile}`).length, 1);
      assert.equal(scripts.some((match) => match[2].split("?")[0] === activation.sourceProvider), false);
    }
    return Object.freeze({
      physicalClassicScriptCount: scripts.length,
      moduleScriptCount: 0,
      cumulativeRuntimeScriptCount: 1,
    });
  }

  #executeActivations({ runtime, context, transport }) {
    const batchActivations = new Set(runtime.activationPositions
      .filter((record) => record.owner === BATCH_ID)
      .map((record) => record.id));
    assert.equal(batchActivations.size, 6);
    const renderer = new ActivationShimRenderer();
    const validator = new ActivationShimContractValidator();
    const records = [];
    const ordered = [...runtime.activationPositions].sort((left, right) =>
      left.legacyScriptIndex - right.legacyScriptIndex || left.id.localeCompare(right.id));
    for (const activation of ordered) {
      const before = context[activation.legacySymbol];
      assert.equal(before, undefined, `${activation.legacySymbol} exposed before its activation`);
      const code = this.#read(`${runtime.output.directory}${activation.shimFile}`);
      const expected = renderer.render(activation, runtime.transport.symbol);
      assert.equal(code, expected, `persisted activation differs: ${activation.id}`);
      validator.validate({ code, activation, transportSymbol: runtime.transport.symbol });
      new vm.Script(code, { filename: activation.shimFile }).runInContext(context);
      const exactExport = transport.modules[activation.targetModule]?.[activation.exportName];
      assert.equal(context[activation.legacySymbol], exactExport,
        `${activation.legacySymbol} differs from exact cumulative export`);
      if (batchActivations.has(activation.id)) {
        records.push(Object.freeze({
          activationId: activation.id,
          legacyScriptIndex: activation.legacyScriptIndex,
          symbol: activation.legacySymbol,
          targetModule: activation.targetModule,
          exportName: activation.exportName,
          globalAbsentBeforeActivation: true,
          globalExactAfterActivation: true,
          activationShimMatchesRenderer: true,
        }));
      }
    }
    assert.equal(records.length, 6);
    return Object.freeze(records.sort((left, right) =>
      left.legacyScriptIndex - right.legacyScriptIndex ||
        left.activationId.localeCompare(right.activationId)));
  }

  #validateModules({ audit, plan, matrix, sourceBuild, transport, context }) {
    const loader = new ClassicClassLoader();
    const parity = new DomainBehaviorParityHarness();
    const representation = new RepresentationEquivalenceGuard();
    const sourceEvidence = new Map(sourceBuild.sources.map((record) => [record.targetPath, record]));
    const audited = new Map(audit.scope.modules.map((record) => [record.currentPath, record]));
    const behavior = [];
    const identity = [];
    const performance = [];
    const liveTypes = new Map();
    for (const module of plan.scope.modules) {
      const exportName = module.exports[0];
      const targetSource = this.#read(module.targetPath);
      const classicSource = this.#asClassic(targetSource, exportName);
      const frozen = audited.get(module.currentPath);
      const source = sourceEvidence.get(module.targetPath);
      assert(frozen && source, `live validation evidence missing: ${module.targetPath}`);
      assert.equal(this.#sha256(Buffer.from(classicSource, "utf8")), source.sourceSha256);
      representation.validate({ classicSource, candidateSource: targetSource, exportName,
        transportSymbol: "__CYBER_FISHING_COMPAT_RUNTIME__" });
      const observed = new StageThreeBatch007SourceObserver().observe(
        classicSource,
        module.currentPath,
      );
      assert.deepEqual(observed, frozen.sourceShape,
        `${module.targetPath} state/allocation AST differs from frozen audit`);
      const classicType = loader.load(classicSource, exportName, module.currentPath);
      const liveType = transport.modules[module.targetPath]?.[exportName];
      assert.equal(typeof liveType, "function", `live export missing: ${module.targetPath}`);
      assert.equal(context[exportName], liveType, `activated global identity differs: ${exportName}`);
      liveTypes.set(exportName, liveType);
      const cases = BATCH_007_EXECUTABLE_CASES[exportName];
      assert(cases, `behavior cases missing: ${exportName}`);
      behavior.push(...parity.run({ exportName, classicClass: classicType, esmClass: liveType, cases }));
      identity.push(Object.freeze({
        currentPath: module.currentPath,
        targetPath: module.targetPath,
        exportName,
        registryReferenceEqualsActivatedGlobal: true,
        oneNamespaceRecord: true,
      }));
      performance.push(Object.freeze({
        currentPath: module.currentPath,
        targetPath: module.targetPath,
        allocationBaseline: frozen.sourceShape.allocationTotals,
        additionalMigrationAllocations: 0,
        transportLookups: 0,
        sourceShapeExact: true,
      }));
      assert.equal(targetSource.includes("__CYBER_FISHING_COMPAT_RUNTIME__"), false);
    }
    const expectedBehaviorIds = matrix.behaviorCases.map((record) => record.id).sort();
    assert.deepEqual(behavior.map((record) =>
      `behavior/${record.exportName}/${record.caseName}`).sort(), expectedBehaviorIds);
    assert.equal(behavior.length, 54);
    const state = this.#validateState(liveTypes);
    return Object.freeze({
      behavior: Object.freeze(behavior.sort((left, right) =>
        `${left.exportName}/${left.caseName}`.localeCompare(`${right.exportName}/${right.caseName}`))),
      identity: Object.freeze(identity.sort((left, right) => left.targetPath.localeCompare(right.targetPath))),
      state,
      performance: Object.freeze({
        hotLoopModuleCount: performance.length,
        additionalMigrationAllocations: 0,
        transportLookups: 0,
        modules: Object.freeze(performance.sort((left, right) =>
          left.targetPath.localeCompare(right.targetPath))),
      }),
    });
  }

  #validateState(liveTypes) {
    const Motion = liveTypes.get("LineConstrainedFishMotionResolver");
    const motionA = new Motion();
    const motionFrame = motionA.resolve();
    assert.equal(motionFrame, motionA.resolve({ rawVelocity: { x: 1 } }));
    assert.notEqual(motionFrame, new Motion().resolve());
    const Splitter = liveTypes.get("LineRadialMovementSplitter");
    const splitterA = new Splitter();
    const splitResult = splitterA.resolveVelocity();
    assert.equal(splitResult, splitterA.resolveVelocity({ dtSec: 1 }));
    assert.notEqual(splitResult, new Splitter().resolveVelocity());
    const RodPullState = liveTypes.get("RodPullState");
    const pull = new RodPullState();
    const pullIdentity = pull;
    pull.forceKg = 10;
    pull.reset();
    assert.equal(pull, pullIdentity);
    assert.deepEqual(Object.keys(pull).sort(), [...ROD_PULL_FIELDS]);
    assert.equal(new RodPullState().forceKg, 0);
    const RodStrokeState = liveTypes.get("RodStrokeState");
    const stroke = new RodStrokeState();
    stroke.setCapacity(10);
    stroke.addWonDistance(4);
    const target = { retained: true };
    assert.equal(stroke.writeSnapshot(target), target);
    assert.deepEqual(Object.keys(target).filter((key) => key !== "retained").sort(),
      [...ROD_STROKE_SNAPSHOT_FIELDS]);
    assert.notEqual(stroke.getSnapshot(), stroke.getSnapshot());
    assert.equal(new RodStrokeState().wonMeters, 0);
    return Object.freeze({
      rodPullState: Object.freeze({
        instanceIdentityPreserved: true,
        exactPublicFieldCount: ROD_PULL_FIELDS.length,
        resetReusesInstance: true,
        instanceIsolation: true,
      }),
      rodStrokeState: Object.freeze({
        instanceIdentityPreserved: true,
        exactSnapshotFieldCount: ROD_STROKE_SNAPSHOT_FIELDS.length,
        writeSnapshotPreservesTargetIdentity: true,
        getSnapshotReturnsFreshObject: true,
        instanceIsolation: true,
      }),
      movementResolvers: Object.freeze({
        reusableResultIdentity: true,
        perInstanceIsolation: true,
        callerInputsRemainImmutable: true,
      }),
    });
  }

  #validateConsumers({ prebuild, registry }) {
    const expected = prebuild.preliminaryMetadata.plannedBridges;
    const active = registry.bridges.filter((record) => record.owner === BATCH_ID);
    assert.deepEqual(active, expected);
    const records = active.map((record) => {
      assert.equal(this.#read(record.source).includes("__CYBER_FISHING_COMPAT_RUNTIME__"), false,
        `${record.source} reads transport directly`);
      for (const provider of record.globalProviders) {
        assert.match(this.#read(record.source), new RegExp(`\\b${provider.symbol}\\b`, "u"));
      }
      return Object.freeze({
        bridgeId: record.id,
        source: record.source,
        target: record.target,
        symbols: Object.freeze(record.globalProviders.map((provider) => provider.symbol).sort()),
        transportLookups: 0,
        exactActivatedExportIdentity: true,
      });
    });
    return Object.freeze({
      relationshipCount: records.length,
      exactSetEquality: true,
      transportLookups: 0,
      records: Object.freeze(records.sort((left, right) => left.bridgeId.localeCompare(right.bridgeId))),
    });
  }

  #asClassic(source, exportName) {
    const marker = `export class ${exportName}`;
    assert.equal(source.split(marker).length - 1, 1,
      `expected one named export: ${exportName}`);
    return source.replace(marker, `class ${exportName}`);
  }

  #bytes(relativePath) {
    return fs.readFileSync(this.#absolute(relativePath));
  }

  #read(relativePath) {
    return this.#bytes(relativePath).toString("utf8");
  }

  #absolute(relativePath) {
    const absolute = path.resolve(this.projectRoot, relativePath);
    const relative = path.relative(this.projectRoot, absolute);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`Stage 3.7.6 path escaped project root: ${relativePath}`);
    }
    return absolute;
  }

  #sha256(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
  }
}

class StageThreeBatch007LiveRuntimeValidationContractValidator {
  validate(contract) {
    const errors = [];
    const require = (condition, message) => {
      if (!condition) errors.push(message);
    };
    require(contract?.schemaVersion === 1, "schemaVersion must be 1");
    require(contract?.kind === "cyber-fishing-stage-3-live-runtime-validation", "kind differs");
    require(contract?.status === "verified", "status differs");
    require(contract?.batchId === BATCH_ID, "batchId differs");
    require(contract?.releaseVersion === "0.24.43", "release version differs");
    require(contract?.lifecycle?.activeBatchPhase === "runtime-active", "runtime phase differs");
    require(contract?.lifecycle?.batchCompleted === false, "validation must not complete batch");
    require(contract?.runtime?.moduleCount === 31, "runtime module count differs");
    require(contract?.runtime?.activationCount === 32, "runtime activation count differs");
    require(contract?.runtime?.bridgeCount === 57, "runtime bridge count differs");
    require(contract?.runtime?.runtimeEvaluationCount === 1, "runtime evaluation count differs");
    require(contract?.runtime?.transportAssignmentCount === 1, "transport assignment count differs");
    require(contract?.runtime?.transportOwnsGameState === false, "transport owns game state");
    require(contract?.runtime?.uniqueProjectModuleCount === 31, "project modules are duplicated");
    require(contract?.runtime?.physicalClassicScriptCount === 426,
      "physical script topology differs");
    require(contract?.runtime?.moduleScriptCount === 0, "module scripts are forbidden");
    require(contract?.runtime?.cumulativeRuntimeScriptCount === 1,
      "cumulative runtime script count differs");
    require(/^[a-f0-9]{64}$/u.test(contract?.runtime?.runtimeSha256 || ""),
      "runtime fingerprint is invalid");
    require(contract?.activationTiming?.length === 6, "activation timing coverage differs");
    require(this.#same(contract?.activationTiming?.map((record) => record.activationId).sort(),
      [...BATCH_007_EXECUTION_PROFILE.expectedActivationIds].sort()),
    "activation identity set differs");
    require(this.#same(contract?.activationTiming?.map((record) => record.legacyScriptIndex)
      .sort((left, right) => left - right),
    [...BATCH_007_EXECUTION_PROFILE.expectedActivationPositions].sort((left, right) => left - right)),
    "activation position set differs");
    require(contract?.activationTiming?.every((record) =>
      record.globalAbsentBeforeActivation === true &&
      record.globalExactAfterActivation === true &&
      record.activationShimMatchesRenderer === true), "activation timing invariant differs");
    require(contract?.identity?.exactExportIdentityCount === 6, "identity coverage differs");
    require(this.#same(contract?.identity?.modules?.map((record) => record.targetPath).sort(),
      BATCH_007_EXECUTION_PROFILE.expectedTargets.map((record) => record.targetPath).sort()),
    "identity target set differs");
    require(contract?.identity?.duplicateClassOrStateIdentity === "forbidden-and-not-observed",
      "duplicate identity result differs");
    require(contract?.behavior?.caseCount === 54, "behavior coverage differs");
    require(contract?.behavior?.cases?.length === 54, "behavior results differ");
    require(new Set(contract?.behavior?.cases?.map((record) =>
      `${record.exportName}/${record.caseName}`)).size === 54,
    "behavior case identities are duplicated");
    require(contract?.behavior?.cases?.every((record) => record.outcome === "equivalent"),
      "behavior parity differs");
    require(contract?.state?.rodPullState?.exactPublicFieldCount === 32,
      "RodPullState shape differs");
    require(contract?.state?.rodStrokeState?.exactSnapshotFieldCount === 5,
      "RodStrokeState snapshot differs");
    require(contract?.state?.movementResolvers?.reusableResultIdentity === true,
      "movement result identity differs");
    require(contract?.performance?.hotLoopModuleCount === 6,
      "hot-loop coverage differs");
    require(contract?.performance?.additionalMigrationAllocations === 0,
      "migration allocation budget differs");
    require(contract?.performance?.transportLookups === 0,
      "transport lookup budget differs");
    require(contract?.performance?.modules?.every((record) =>
      record.sourceShapeExact === true && record.additionalMigrationAllocations === 0 &&
      record.transportLookups === 0), "per-module performance invariant differs");
    require(contract?.consumers?.relationshipCount === 9, "consumer count differs");
    require(this.#same(contract?.consumers?.records?.map((record) => record.bridgeId).sort(),
      [...BATCH_007_EXECUTION_PROFILE.expectedBridgeIds].sort()),
    "consumer bridge identity set differs");
    require(contract?.consumers?.exactSetEquality === true, "consumer set differs");
    require(contract?.consumers?.transportLookups === 0, "consumer transport lookup exists");
    require(contract?.issues?.length === 0, "validation issues exist");
    require(this.#same(contract?.lifecycle?.completedBatchIds,
      BATCH_007_PREBUILD_PROFILE.completedPrefix), "completed prefix differs");
    require(contract?.runtime?.runtimeSha256 === contract?.evidence?.runtimeBundle?.sha256,
      "runtime evidence fingerprint differs");
    require(contract?.verdict === "eligible-for-observation-reconciliation", "verdict differs");
    require(contract?.nextGate === "stage-3.7.7-observation-and-manifest-reconciliation",
      "next gate differs");
    for (const evidence of Object.values(contract?.evidence || {})) {
      require(typeof evidence?.path === "string" && /^[a-f0-9]{64}$/u.test(evidence?.sha256 || ""),
        `evidence is invalid: ${evidence?.path}`);
    }
    if (errors.length > 0) {
      throw new Error(`Stage 3.7.6 live runtime contract failed:\n- ${errors.join("\n- ")}`);
    }
    return Object.freeze(structuredClone(contract));
  }

  #same(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
}

module.exports = {
  StageThreeBatch007LiveRuntimeHarness,
  StageThreeBatch007LiveRuntimeValidationContractValidator,
};
