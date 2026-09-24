"use strict";

const crypto = require("node:crypto");
const { immutableRecord } = require("../guards/core/guard_models");
const {
  StageThreeBatchPreflightProfile,
} = require("./stage_three_batch_preflight_profile");
const { StageThreeGlobalExposureReview } = require("./stage_three_global_exposure_review");
const {
  StageThreeBatchSourceObserver,
} = require("./stage_three_batch_source_observer");

class StageThreeBatchPreflightAuditBuilder {
  #profile;
  #sourceObserver;

  constructor({ profile, sourceObserver = new StageThreeBatchSourceObserver() } = {}) {
    this.#profile = StageThreeBatchPreflightProfile.validateImmutable(profile);
    this.#sourceObserver = sourceObserver;
  }

  build({
    approvedPlan,
    approvedPlanSha256,
    manifest,
    manifestSha256,
    domainAudit,
    domainAuditSha256,
    executionState,
    executionStateSha256,
    runtimeContract,
    runtimeContractSha256,
    bridgeRegistry,
    bridgeRegistrySha256,
    indexSha256,
    runtimeOutputFingerprint,
    runtimeFacts,
    sourceReader,
    sideEffectReview = null,
    sideEffectReviewSha256 = null,
  }) {
    const profile = this.#profile;
    const executionProfile = profile.executionProfile;
    const batch = approvedPlan.batches.find((record) => record.id === profile.batchId);
    this.#require(batch?.status === "approved-frozen", "batch is not approved-frozen");
    this.#require(batch.modules.length === executionProfile.expectedTargetCount,
      "frozen target count differs from execution profile");
    this.#require(typeof sourceReader === "function", "sourceReader must be provided");
    const completedPrefix = approvedPlan.batches
      .slice(0, batch.order - 1)
      .map((record) => record.id);
    this.#require(this.#same(executionState.completedBatchIds, completedPrefix),
      "execution state does not contain the exact completed prefix");
    this.#require(executionState.activeBatchId === null, "preflight requires no active batch");
    this.#require(executionState.releaseVersion === profile.sourceReleaseVersion,
      "execution-state release differs");
    this.#require(executionState.compatibilityRuntimeActivated === true,
      "cumulative compatibility runtime must be active");

    const previousBatch = approvedPlan.batches[batch.order - 2];
    this.#require(previousBatch, "previous completed batch is missing");
    const existingModules = new Set([
      ...previousBatch.cumulativeRuntimeTopology.stage2Targets,
      ...previousBatch.cumulativeRuntimeTopology.stage3Targets,
    ]);
    const actualRuntimeModules = new Set(runtimeContract.activationPositions
      .map((activation) => activation.targetModule));
    this.#require(this.#same([...actualRuntimeModules].sort(), [...existingModules].sort()),
      "live runtime module set differs from completed frozen topology");
    this.#require(runtimeFacts.projectModuleCount === existingModules.size,
      "runtime project-module count differs from live module set");
    this.#require(runtimeFacts.activationCount === runtimeContract.activationPositions.length,
      "runtime activation count differs from contract");
    this.#require(runtimeFacts.bridgeCount === bridgeRegistry.bridges.length,
      "runtime bridge count differs from registry");
    this.#require(runtimeContract.activationPositions.every((record) => record.owner !== profile.batchId),
      "runtime contract already contains the pending batch");
    this.#require(bridgeRegistry.bridges.every((record) => record.owner !== profile.batchId),
      "bridge registry already contains the pending batch");

    const manifestByPath = new Map(manifest.modules.map((entry) => [entry.currentPath, entry]));
    const auditByPath = new Map(domainAudit.entries.map((entry) => [entry.currentPath, entry]));
    const currentPaths = new Set(batch.modules.map((module) => module.currentPath));
    const targetPaths = new Set(batch.modules.map((module) => module.targetPath));
    const modules = batch.modules.map((module) => this.#moduleRecord({
      module,
      manifestEntry: manifestByPath.get(module.currentPath),
      auditEntry: auditByPath.get(module.currentPath),
      reviewed: profile.reviewedContracts[module.currentPath],
      sourceReader,
    })).sort((left, right) => left.currentPath.localeCompare(right.currentPath));
    if (profile.sideEffectEvidence) {
      this.#require(sideEffectReview?.modules?.length === modules.length,
        "side-effect review target count differs");
      for (const module of modules) {
        const evidence = sideEffectReview.modules.find(item => item.currentPath === module.currentPath);
        this.#require(evidence && this.#same(evidence.sourceSha256, module.sourceSha256) &&
          this.#same(evidence.symbol, module.effects.reviewedExposure?.symbol) &&
          this.#same(evidence.location, module.effects.reviewedExposure?.location),
        `side-effect review differs from live source: ${module.currentPath}`);
      }
    }

    const exactScope = modules.map(({ currentPath, targetPath, exports }) => ({
      currentPath,
      targetPath,
      exports,
    }));
    this.#require(this.#same(exactScope, executionProfile.expectedTargets),
      "source target/export scope differs from execution profile");

    const outgoingEdges = modules.flatMap((module) =>
      module.outgoingProjectEdges.map((edge) => ({
        source: module.currentPath,
        target: edge.target,
        symbols: [...edge.symbols].sort(),
        resolution: edge.resolution,
      }))).sort(this.#edgeCompare);
    const internalEdges = outgoingEdges.filter((edge) => currentPaths.has(edge.target));
    const alreadyCumulativeDependencies = outgoingEdges.filter((edge) =>
      existingModules.has(edge.target));
    const unexpectedDependencies = outgoingEdges.filter((edge) =>
      !currentPaths.has(edge.target) && !existingModules.has(edge.target));
    const frozenNewTargets = batch.cumulativeRuntimeTopology.stage3Targets
      .filter((target) => !existingModules.has(target))
      .sort();
    this.#require(this.#same(frozenNewTargets, [...targetPaths].sort()),
      "recursive closure does not add the exact frozen target set");
    this.#require(this.#same(
      internalEdges.map(({ source, target, symbols }) => ({ source, target, symbols })),
      batch.internalDependencyClosure.map(({ source, target, symbols }) => ({
        source,
        target,
        symbols: [...symbols].sort(),
      })).sort(this.#edgeCompare),
    ), "internal dependency closure differs from frozen batch");

    const consumers = batch.externalLegacyConsumers.map((consumer) => ({
      provider: consumer.provider,
      source: consumer.source,
      sourceBoundary: consumer.sourceBoundary,
      symbols: [...consumer.symbols].sort(),
    })).sort(this.#consumerCompare);
    const observedConsumers = modules.flatMap((module) =>
      auditByPath.get(module.currentPath).dependencyAudit.facts.reverseConsumers.map((consumer) => ({
        provider: module.currentPath,
        source: consumer.source,
        sourceBoundary: consumer.sourceBoundary,
        symbols: [...consumer.symbols].sort(),
      }))).sort(this.#consumerCompare);
    this.#require(this.#same(consumers, observedConsumers),
      "classic consumer set differs from verified reverse observations");

    const activations = batch.compatibility.newActivations.map((activation) => ({
      ...activation.contract,
      mechanism: activation.mechanism,
      consumers: [...activation.legacyConsumers].sort(),
      removalCondition: activation.removalCondition,
    })).sort((left, right) => left.id.localeCompare(right.id));
    this.#require(this.#same(
      activations.map((record) => record.id),
      executionProfile.expectedActivationIds,
    ), "activation IDs differ from execution profile");
    this.#require(this.#same(
      activations.map((record) => record.legacyScriptIndex).sort((left, right) => left - right),
      executionProfile.expectedActivationPositions,
    ), "activation positions differ from execution profile");

    const forbiddenEdges = outgoingEdges.filter((edge) => [
      "game-application", "platform", "dev", "presentation",
    ].includes(manifestByPath.get(edge.target)?.architecture?.targetBoundary));
    const directConfigDependencies = outgoingEdges.filter((edge) =>
      manifestByPath.get(edge.target)?.architecture?.targetBoundary === "game-config");
    const browserCapabilities = modules.flatMap((module) =>
      module.capabilities.map((capability) => ({ module: module.currentPath, capability })));
    const transportReads = modules.filter((module) =>
      module.sourceShape.forbiddenReads.includes("transport")).map((module) => module.currentPath);
    const forbiddenSourceReads = modules.flatMap((module) => module.sourceShape.forbiddenReads
      .map((read) => ({ module: module.currentPath, read })));
    const dynamicConstructs = modules.flatMap((module) => module.dynamicConstructs
      .map((construct) => ({ module: module.currentPath, construct })));
    const unsafeEffects = modules.filter((module) => module.effects.classification === "unsafe");
    const reviewedPrerequisites = batch.prerequisites.filter((prerequisite) =>
      prerequisite.kind === "side-effect-review" && modules.some((module) =>
        module.currentPath === prerequisite.module &&
        module.effects.classification === "reviewed-compatible"));
    const unresolvedPrerequisites = batch.prerequisites.filter((prerequisite) =>
      !reviewedPrerequisites.includes(prerequisite));
    const unresolvedState = modules.filter((module) => !module.state.reviewed);
    const issues = [
      ...unexpectedDependencies.map((edge) => `unexpected:${edge.source}->${edge.target}`),
      ...forbiddenEdges.map((edge) => `forbidden-edge:${edge.source}->${edge.target}`),
      ...directConfigDependencies.map((edge) => `config-edge:${edge.source}->${edge.target}`),
      ...browserCapabilities.map((fact) => `browser-capability:${fact.module}:${fact.capability}`),
      ...forbiddenSourceReads.map((fact) => `forbidden-read:${fact.module}:${fact.read}`),
      ...dynamicConstructs.map((fact) => `dynamic-construct:${fact.module}:${fact.construct}`),
      ...unsafeEffects.map((module) => `unsafe-effect:${module.currentPath}`),
      ...unresolvedState.map((module) => `unresolved-state:${module.currentPath}`),
    ].sort();

    return immutableRecord({
      schemaVersion: 1,
      kind: profile.artifactKind,
      status: issues.length === 0 ? "verified" : "failed",
      stage: profile.stageLabel,
      sourceReleaseVersion: executionState.releaseVersion,
      batchId: profile.batchId,
      sourceEvidence: {
        approvedPlan: { path: "architecture/migration/stage_3_approved_batches.json", sha256: approvedPlanSha256 },
        manifest: { path: "architecture/migration/module_migration_manifest.json", sha256: manifestSha256 },
        domainAudit: { path: "architecture/migration/stage_3_domain_audit.json", sha256: domainAuditSha256 },
        executionState: { path: "architecture/migration/stage_3_execution_state.json", sha256: executionStateSha256 },
        runtimeContract: { path: "architecture/migration/stage_3_compatibility_runtime.json", sha256: runtimeContractSha256 },
        bridgeRegistry: { path: "architecture/guards/migration_bridge_registry.json", sha256: bridgeRegistrySha256 },
        index: { path: "index.html", sha256: indexSha256 },
        runtimeOutput: { path: "dist/stage-3-compat-runtime", fingerprint: runtimeOutputFingerprint },
        ...(profile.sideEffectEvidence ? {
          sideEffectReview: { path: profile.sideEffectEvidence.path,
            sha256: sideEffectReviewSha256 },
        } : {}),
      },
      scope: { targetCount: modules.length, modules },
      runtimeBaseline: {
        projectModuleCount: runtimeFacts.projectModuleCount,
        projectModules: [...actualRuntimeModules].sort(),
        activationCount: runtimeFacts.activationCount,
        bridgeCount: runtimeFacts.bridgeCount,
        scriptTopology: runtimeFacts.scriptTopology,
      },
      closure: {
        existingCumulativeModuleCount: existingModules.size,
        existingCumulativeModules: [...existingModules].sort(),
        newProjectModuleCount: frozenNewTargets.length,
        newProjectModules: frozenNewTargets,
        resultingProjectModuleCount: new Set([...existingModules, ...frozenNewTargets]).size,
        internalEdges,
        alreadyCumulativeDependencies,
        unexpectedDependencies,
      },
      evaluation: {
        legacyScriptOrderControlsEvaluation: false,
        ordering: "esm-graph-topology-with-lexicographic-diagnostic-tiebreak",
        stronglyConnectedComponents: modules.map((module) => module.scc)
          .sort((left, right) => left.id.localeCompare(right.id)),
        layers: [modules.map((module) => module.targetPath).sort()],
        cycles: modules.filter((module) => module.scc.cyclic).map((module) => module.scc.id).sort(),
      },
      boundaries: {
        forbiddenEdges,
        directConfigDependencies,
        browserCapabilities,
        transportReads,
        forbiddenSourceReads,
        dynamicConstructs,
      },
      state: {
        reviewed: modules.map((module) => ({
          module: module.currentPath,
          frozenStateRole: module.state.frozenStateRole,
          classification: module.state.classification,
          ownerIdentity: module.state.ownerIdentity,
        })),
        unresolved: unresolvedState.map((module) => module.currentPath),
      },
      behavior: {
        resultShapeSensitive: modules.filter((module) => module.state.resultShape.length > 0)
          .map((module) => module.currentPath),
        mutableIdentitySensitive: modules.filter((module) => module.state.stableResultIdentity)
          .map((module) => module.currentPath),
        formulaDefaultsClampsRoundingFingerprints: modules.map((module) => ({
          module: module.currentPath,
          sha256: module.behavior.formulaDefaultsClampsRoundingFingerprint,
        })),
        unresolved: [],
      },
      performance: {
        reviewed: modules.map((module) => ({
          module: module.currentPath,
          classification: module.performance.classification,
          callSites: module.performance.callSites,
          callSiteEvidence: module.performance.callSiteEvidence,
          allocationBaseline: module.performance.allocationBaseline,
        })),
        additionalMigrationAllocationsAllowed: 0,
        transportLookupsAllowed: 0,
        unresolved: [],
      },
      effects: {
        safe: modules.filter((module) => module.effects.classification === "safe")
          .map((module) => module.currentPath),
        reviewed: modules.filter((module) => module.effects.classification === "reviewed-compatible")
          .map((module) => module.currentPath),
        unsafe: unsafeEffects.map((module) => module.currentPath),
      },
      compatibility: {
        providers: modules.flatMap((module) => module.providerFacts.map((provider) => ({
          module: module.currentPath,
          symbol: provider.symbol,
          mechanism: provider.mechanism,
          availability: provider.availability,
        }))).sort((left, right) => `${left.module}\0${left.symbol}`.localeCompare(`${right.module}\0${right.symbol}`)),
        consumers,
        activations,
      },
      prerequisites: {
        frozen: unresolvedPrerequisites,
        ...(profile.sideEffectEvidence ? { reviewed: reviewedPrerequisites } : {}),
        newlyDiscovered: issues.map((issue) => ({ kind: "preflight-blocker", issue })),
      },
      migrationGates: [...profile.migrationGates],
      issues,
      verdict: issues.length === 0 ? "eligible-for-execution-plan" : "runtime-migration-forbidden",
    });
  }

  #moduleRecord({ module, manifestEntry, auditEntry, reviewed, sourceReader }) {
    this.#require(manifestEntry, `Manifest entry is missing: ${module.currentPath}`);
    this.#require(auditEntry?.dependencyAudit?.status === "verified",
      `dependency audit is stale: ${module.currentPath}`);
    this.#require(auditEntry?.stateOwnership?.status === "verified",
      `state audit is stale: ${module.currentPath}`);
    this.#require(auditEntry?.configurationInput?.status === "verified",
      `configuration audit is stale: ${module.currentPath}`);
    this.#require(reviewed, `reviewed contract is missing: ${module.currentPath}`);
    const source = sourceReader(module.currentPath);
    const sourceShape = this.#sourceObserver.observe(source, module.currentPath);
    const expectedSymbols = [...new Set(module.providers.map((provider) => provider.symbol))].sort();
    const providerSymbols = manifestEntry.observed.providers.items
      .map((provider) => provider.symbol);
    this.#require(this.#same(sourceShape.classDeclarations, expectedSymbols),
      `class declaration differs: ${module.currentPath}`);
    this.#require(this.#same([...new Set(providerSymbols)].sort(), expectedSymbols),
      `provider facts differ: ${module.currentPath}`);
    this.#require(sourceShape.topLevelBindings.length === 0,
      `top-level binding exists: ${module.currentPath}`);
    let reviewedExposure = null;
    if (reviewed.legacyExposure) {
      reviewedExposure = new StageThreeGlobalExposureReview().review({
        source, currentPath: module.currentPath, ...reviewed.legacyExposure,
      });
      this.#require(this.#same(auditEntry.dependencyAudit.facts.topLevelEffects,
        [{ kind: "assignment", location: reviewed.legacyExposure.location,
          classification: "observable" }]),
      `frozen top-level effect differs: ${module.currentPath}`);
      this.#require(this.#same(sourceShape.topLevelEffects,
        [`ExpressionStatement@${reviewed.legacyExposure.location}`]),
      `reviewed top-level effect differs: ${module.currentPath}`);
    } else {
      this.#require(sourceShape.topLevelEffects.length === 0,
        `top-level effect exists: ${module.currentPath}`);
    }
    this.#require(sourceShape.forbiddenReads.length === 0,
      `forbidden source read exists: ${module.currentPath}`);
    this.#require(this.#same(
      sourceShape.fields.map((field) => field.name),
      [...reviewed.instanceFields].sort(),
    ), `instance field shape differs: ${module.currentPath}`);
    this.#require(this.#same(
      sourceShape.methods.filter((method) => method.kind === "get").map((method) => method.name).sort(),
      [...reviewed.publicStateShape].sort(),
    ), `public getter shape differs: ${module.currentPath}`);
    this.#require(this.#same(sourceShape.allocationTotals, reviewed.allocationBaseline),
      `allocation baseline differs: ${module.currentPath}`);
    for (const evidence of reviewed.callSiteEvidence) {
      this.#require(sourceReader(evidence.path).includes(evidence.marker),
        `call-site evidence is stale: ${module.currentPath} -> ${evidence.path}`);
    }
    const facts = auditEntry.dependencyAudit.facts;
    return {
      currentPath: module.currentPath,
      targetPath: module.targetPath,
      sourceSha256: this.#sha256(source),
      exports: expectedSymbols,
      roles: [...module.roles].sort(),
      dependencyDepth: facts.dependencyDepth,
      scc: facts.scc,
      outgoingProjectEdges: [...facts.internalDependencies, ...facts.externalDependencies]
        .sort(this.#edgeCompare),
      capabilities: [...facts.capabilities].sort(),
      availabilityConstraints: [...facts.availabilityConstraints],
      dynamicConstructs: [...manifestEntry.observed.environment.dynamicConstructs].sort(),
      sourceShape,
      state: {
        reviewed: true,
        frozenStateRole: module.stateRole,
        classification: reviewed.classification,
        instanceFields: [...reviewed.instanceFields].sort(),
        publicStateShape: [...reviewed.publicStateShape].sort(),
        resultShape: [...reviewed.resultShape].sort(),
        stableResultIdentity: reviewed.stableResultIdentity,
        mutatesCallerInputs: reviewed.mutatesCallerInputs,
        authoritativeOwnerBefore: module.stateOwnershipInvariant.before,
        authoritativeOwnerAfter: module.stateOwnershipInvariant.after,
        ownerIdentity: module.stateOwnershipInvariant.ownerIdentity,
        duplicateStateCopies: module.stateOwnershipInvariant.duplicateStateCopies,
      },
      behavior: {
        semanticRisk: reviewed.semanticRisk,
        formulaDefaultsClampsRoundingFingerprint: this.#sha256(JSON.stringify({
          sourceSha256: this.#sha256(source),
          methods: sourceShape.methods,
        })),
        representationOnlyRequired: true,
      },
      performance: {
        classification: reviewed.performanceClassification,
        callSites: [...reviewed.hotLoopCallSites].sort(),
        callSiteEvidence: reviewed.callSiteEvidence.map((record) => ({ ...record }))
          .sort((left, right) => `${left.path}\0${left.marker}`.localeCompare(`${right.path}\0${right.marker}`)),
        allocationBaseline: sourceShape.allocationTotals,
        additionalMigrationAllocationsAllowed: 0,
        transportLookupsAllowed: 0,
        comparisonMode: "target-ast-after-removing-export-must-equal-frozen-source-ast",
      },
      effects: {
        classification: facts.topLevelEffects.length === 0 ? "safe" :
          reviewedExposure ? "reviewed-compatible" : "unsafe",
        topLevelEffects: [...facts.topLevelEffects],
        ...(reviewedExposure ? { reviewedExposure } : {}),
      },
      providerFacts: manifestEntry.observed.providers.items,
    };
  }

  #consumerCompare(left, right) {
    return `${left.provider}\0${left.source}\0${left.symbols.join(",")}`
      .localeCompare(`${right.provider}\0${right.source}\0${right.symbols.join(",")}`);
  }

  #edgeCompare(left, right) {
    return `${left.source || ""}\0${left.target || ""}\0${(left.symbols || []).join(",")}`
      .localeCompare(`${right.source || ""}\0${right.target || ""}\0${(right.symbols || []).join(",")}`);
  }

  #same(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  #sha256(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
  }

  #require(condition, message) {
    if (!condition) throw new Error(`${this.#profile.stageLabel} preflight audit failed: ${message}`);
  }
}

class StageThreeBatchPreflightAuditValidator {
  #profile;

  constructor(profile) {
    this.#profile = StageThreeBatchPreflightProfile.validateImmutable(profile);
  }

  validate(artifact) {
    const profile = this.#profile;
    const executionProfile = profile.executionProfile;
    const errors = [];
    const require = (condition, message) => {
      if (!condition) errors.push(message);
    };
    require(artifact?.schemaVersion === 1, "schemaVersion must be 1");
    require(artifact?.kind === profile.artifactKind, "kind is invalid");
    require(artifact?.stage === profile.stageLabel, "stage is invalid");
    require(artifact?.batchId === profile.batchId, "batchId is invalid");
    require(artifact?.sourceReleaseVersion === profile.sourceReleaseVersion, "source release differs");
    require(artifact?.status === "verified", "audit status must be verified");
    require(artifact?.verdict === "eligible-for-execution-plan", "verdict must allow execution planning");
    require(artifact?.scope?.targetCount === executionProfile.expectedTargetCount, "target count differs");
    require(artifact?.scope?.modules?.length === executionProfile.expectedTargetCount, "module coverage differs");
    require(artifact?.closure?.newProjectModuleCount === executionProfile.expectedTargetCount,
      "closure must add exact target count");
    require(artifact?.closure?.newProjectModules?.length === executionProfile.expectedTargetCount,
      "new module set differs");
    require(artifact?.closure?.resultingProjectModuleCount ===
      artifact?.closure?.existingCumulativeModuleCount + artifact?.closure?.newProjectModuleCount,
    "resulting module count must be derived from exact sets");
    require(artifact?.runtimeBaseline?.projectModuleCount ===
      artifact?.closure?.existingCumulativeModuleCount, "runtime baseline differs from closure");
    require(this.#same(artifact?.runtimeBaseline?.projectModules,
      artifact?.closure?.existingCumulativeModules), "runtime module set differs from closure");
    require(artifact?.runtimeBaseline?.activationCount === executionProfile.expectedTopology.beforeActivationCount,
      "activation baseline differs");
    require(artifact?.runtimeBaseline?.bridgeCount === executionProfile.expectedTopology.beforeBridgeCount,
      "bridge baseline differs");
    require(artifact?.runtimeBaseline?.scriptTopology?.cumulativeRuntimeScriptCount === 1,
      "one cumulative runtime is required");
    require(artifact?.runtimeBaseline?.scriptTopology?.isolatedIifeScriptCount === 0,
      "isolated IIFE must remain zero");
    require(artifact?.runtimeBaseline?.scriptTopology?.moduleScriptCount === 0,
      "module scripts must remain zero");
    require(artifact?.closure?.internalEdges?.length === executionProfile.expectedDependencyEdgeCount,
      "internal dependency closure differs");
    require(artifact?.closure?.unexpectedDependencies?.length === 0, "unexpected dependency exists");
    require(artifact?.evaluation?.cycles?.length === 0, "cycle exists");
    require(artifact?.evaluation?.stronglyConnectedComponents?.length === executionProfile.expectedTargetCount,
      "SCC coverage differs");
    require(Object.values(artifact?.boundaries || {}).every((records) => records.length === 0),
      "forbidden boundary/capability/transport fact exists");
    require(artifact?.state?.reviewed?.length === executionProfile.expectedTargetCount,
      "state review coverage differs");
    require(artifact?.state?.unresolved?.length === 0, "state review is unresolved");
    require(artifact?.behavior?.unresolved?.length === 0, "behavior review is unresolved");
    require(artifact?.performance?.reviewed?.length === executionProfile.expectedTargetCount,
      "performance review coverage differs");
    require(artifact?.performance?.additionalMigrationAllocationsAllowed === 0,
      "additional allocations must be forbidden");
    require(artifact?.performance?.transportLookupsAllowed === 0,
      "transport lookups must be forbidden");
    require(artifact?.performance?.unresolved?.length === 0, "performance review is unresolved");
    require(artifact?.effects?.unsafe?.length === 0, "unsafe top-level effect exists");
    require(new Set(artifact?.compatibility?.providers?.map(provider => provider.symbol)).size ===
      executionProfile.expectedExportCount,
      "provider coverage differs");
    require(artifact?.compatibility?.consumers?.length === executionProfile.expectedConsumerCount,
      "consumer coverage differs");
    require(artifact?.compatibility?.activations?.length === executionProfile.expectedActivationCount,
      "activation coverage differs");
    require(this.#same(artifact?.compatibility?.activations?.map((record) => record.id),
      executionProfile.expectedActivationIds), "activation identity set differs");
    require(artifact?.prerequisites?.frozen?.length === 0, "frozen prerequisite exists");
    require(artifact?.prerequisites?.newlyDiscovered?.length === 0, "new prerequisite discovered");
    require(this.#same(artifact?.migrationGates, profile.migrationGates), "migration gates differ");
    require(artifact?.issues?.length === 0, "issues must be empty");
    for (const [name, evidence] of Object.entries(artifact?.sourceEvidence || {})) {
      const fingerprint = name === "runtimeOutput" ? evidence.fingerprint : evidence.sha256;
      require(/^[a-f0-9]{64}$/u.test(fingerprint), `evidence fingerprint is invalid: ${name}`);
    }
    for (const module of artifact?.scope?.modules || []) {
      const reviewed = profile.reviewedContracts[module.currentPath];
      require(reviewed !== undefined, `reviewed contract is missing: ${module.currentPath}`);
      require(/^[a-f0-9]{64}$/u.test(module.sourceSha256), `source fingerprint is invalid: ${module.currentPath}`);
      require(this.#same(module.sourceShape?.fields?.map((field) => field.name),
        [...(reviewed?.instanceFields || [])].sort()), `instance fields differ: ${module.currentPath}`);
      require(this.#same(module.state?.publicStateShape,
        [...(reviewed?.publicStateShape || [])].sort()), `public state shape differs: ${module.currentPath}`);
      require(this.#same(module.state?.resultShape,
        [...(reviewed?.resultShape || [])].sort()), `result shape differs: ${module.currentPath}`);
      require(module.state?.ownerIdentity === "preserved", `owner identity differs: ${module.currentPath}`);
      require(module.state?.duplicateStateCopies === "forbidden", `duplicate state is allowed: ${module.currentPath}`);
      require(module.state?.classification === reviewed?.classification,
        `state classification differs: ${module.currentPath}`);
      require(this.#same(module.sourceShape?.allocationTotals, reviewed?.allocationBaseline),
        `allocation baseline differs: ${module.currentPath}`);
      require(module.performance?.additionalMigrationAllocationsAllowed === 0,
        `allocation budget differs: ${module.currentPath}`);
      require(module.performance?.transportLookupsAllowed === 0,
        `transport budget differs: ${module.currentPath}`);
      require(module.effects?.classification === (reviewed?.legacyExposure ?
        "reviewed-compatible" : "safe"), `effect classification differs: ${module.currentPath}`);
      if (reviewed?.legacyExposure) {
        require(module.effects?.reviewedExposure?.symbol === reviewed.legacyExposure.symbol &&
          module.effects?.reviewedExposure?.location === reviewed.legacyExposure.location,
        `reviewed exposure differs: ${module.currentPath}`);
      }
    }
    if (errors.length > 0) {
      throw new Error(`${profile.stageLabel} preflight contract failed:\n- ${errors.join("\n- ")}`);
    }
    return immutableRecord(artifact);
  }

  #same(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
}

module.exports = {
  StageThreeBatchPreflightAuditBuilder,
  StageThreeBatchPreflightAuditValidator,
};
