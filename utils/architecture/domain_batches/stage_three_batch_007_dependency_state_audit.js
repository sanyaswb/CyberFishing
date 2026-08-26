"use strict";

const crypto = require("node:crypto");
const espree = require("espree");
const estraverse = require("estraverse");
const { immutableRecord } = require("../guards/core/guard_models");

const BATCH_ID = "stage-3.candidate-007-fishing-bb8b3939";
const EXPECTED_TARGET_COUNT = 6;
const EXPECTED_CONSUMER_COUNT = 9;

const ROD_PULL_FIELDS = Object.freeze([
  "active",
  "availableDistanceMeters",
  "availableExtraForceKg",
  "blockedReason",
  "canMoveFish",
  "canReleaseLine",
  "deltaMeters",
  "distanceMeters",
  "dragSlipping",
  "effectiveForceKg",
  "fishTensionKg",
  "forceKg",
  "holdTensionRatio",
  "lineHasReserve",
  "maxDistanceMeters",
  "playerHoldTensionKg",
  "playerPressureEfficiency",
  "playerPressureFatigueEnabled",
  "ratio",
  "rawForceKg",
  "releaseRecovering",
  "releaseRecoveryRatio",
  "releasedThisFrame",
  "rodHoldMaxKg",
  "rodLimitKg",
  "rodStrokeRatio",
  "rodStrokeUnrecoveredMeters",
  "rodStrokeWonMeters",
  "spoolEmpty",
  "tensionCeilingKg",
  "tensionCeilingMultiplier",
  "totalTensionKg",
]);

const ROD_STROKE_SNAPSHOT_FIELDS = Object.freeze([
  "rodStrokeCapacityMeters",
  "rodStrokeRatio",
  "rodStrokeUnrecoveredMeters",
  "rodStrokeUsedMeters",
  "rodStrokeWonMeters",
]);

const REVIEWED_CONTRACTS = Object.freeze({
  "src/core/fishing/line_constrained_fish_motion_resolver.js": Object.freeze({
    classification: "instance-local-derived-buffer",
    instanceFields: ["#frame"],
    publicStateShape: [],
    snapshotShape: [],
    stableResultIdentity: true,
    mutatesCallerInputs: false,
    hotLoopCallSites: [
      "src/systems/fight_physics_system.js#updateFishMotion:active-projection",
      "src/systems/fight_physics_system.js#updateFishMotion:preview-projection",
    ],
    callSiteEvidence: [
      { path: "src/systems/fight_physics_system.js", marker: "this.#lineConstrainedFishMotionResolver.resolve" },
      { path: "src/systems/fight_physics_system.js", marker: "this.#lineConstrainedFishMotionPreviewResolver.resolve" },
    ],
    semanticRisk: "movement-projection-formula-and-reusable-frame",
  }),
  "src/core/fishing/line_radial_movement_splitter.js": Object.freeze({
    classification: "instance-local-derived-buffer",
    instanceFields: ["#result"],
    publicStateShape: [],
    snapshotShape: [],
    stableResultIdentity: true,
    mutatesCallerInputs: false,
    hotLoopCallSites: [
      "src/systems/fight_physics_system.js#updateFishMotion:radial-split",
    ],
    callSiteEvidence: [
      { path: "src/systems/fight_physics_system.js", marker: "this.#lineRadialMovementSplitter.resolveVelocity" },
    ],
    semanticRisk: "crossing-time-formula-reusable-result-and-temporary-allocation-profile",
  }),
  "src/core/fishing/reel_retrieve_speed_calculator.js": Object.freeze({
    classification: "stateless-calculator",
    instanceFields: [],
    publicStateShape: [],
    snapshotShape: [],
    stableResultIdentity: false,
    mutatesCallerInputs: false,
    hotLoopCallSites: [
      "src/entities/tackle.js#getRetrieveSpeedMetersPerSec",
      "src/systems/fight_physics_system.js#updateHoldReelRecovery",
      "src/systems/line_system.js#recoverLine",
      "src/systems/reel_system.js#update",
    ],
    callSiteEvidence: [
      { path: "src/entities/tackle.js", marker: "this.#retrieveSpeedCalculator.calculate" },
      { path: "src/systems/fight_physics_system.js", marker: "reel?.getRetrieveSpeedMetersPerSec?.()" },
      { path: "src/systems/line_system.js", marker: "reel.getRetrieveSpeedMetersPerSec?.()" },
      { path: "src/systems/reel_system.js", marker: "reel?.getRetrieveSpeedMetersPerSec?.()" },
    ],
    semanticRisk: "positive-clamp-default-and-bearing-formula",
  }),
  "src/core/fishing/rod_pull_state.js": Object.freeze({
    classification: "authoritative-instance-state",
    instanceFields: ROD_PULL_FIELDS,
    publicStateShape: ROD_PULL_FIELDS,
    snapshotShape: [],
    stableResultIdentity: true,
    mutatesCallerInputs: false,
    hotLoopCallSites: [
      "src/systems/rod_pull_system.js#update:state-copy",
    ],
    callSiteEvidence: [
      { path: "src/systems/rod_pull_system.js", marker: "#state = new RodPullState()" },
      { path: "src/systems/rod_pull_system.js", marker: "this.#copyResultToState(this.#result)" },
    ],
    semanticRisk: "mutable-public-state-defaults-reset-shape-and-instance-identity",
  }),
  "src/core/fishing/rod_stroke_state.js": Object.freeze({
    classification: "authoritative-instance-state-with-derived-snapshot",
    instanceFields: ["#capacityMeters", "#snapshot", "#wonMeters"],
    publicStateShape: [],
    snapshotShape: ROD_STROKE_SNAPSHOT_FIELDS,
    stableResultIdentity: true,
    mutatesCallerInputs: true,
    hotLoopCallSites: [
      "src/systems/rod_pull_system.js#update:stroke-state",
      "src/systems/rod_pull_system.js#writeStrokeSnapshot",
    ],
    callSiteEvidence: [
      { path: "src/systems/rod_pull_system.js", marker: "#strokeState = new RodStrokeState()" },
      { path: "src/systems/rod_pull_system.js", marker: "this.#strokeState.writeSnapshot(this.#strokeSnapshot)" },
    ],
    semanticRisk: "authoritative-distance-state-clamps-aliases-and-snapshot-shape",
  }),
  "src/core/fishing/simple_fight_force_calculator.js": Object.freeze({
    classification: "stateless-calculator",
    instanceFields: [],
    publicStateShape: [],
    snapshotShape: [],
    stableResultIdentity: false,
    mutatesCallerInputs: false,
    hotLoopCallSites: [
      "src/systems/fish_force_system.js#update",
      "src/systems/fish_retrieve_system.js#calculate",
    ],
    callSiteEvidence: [
      { path: "src/systems/fish_force_system.js", marker: "#forceCalculator = new SimpleFightForceCalculator()" },
      { path: "src/systems/fish_retrieve_system.js", marker: "#calculator = new SimpleFightForceCalculator()" },
    ],
    semanticRisk: "force-speed-formulas-clamps-defaults-frozen-result-and-no-rounding",
  }),
});

class StageThreeBatch007SourceObserver {
  observe(source, currentPath) {
    const tree = espree.parse(source, {
      ecmaVersion: "latest",
      sourceType: "script",
      loc: true,
    });
    const classes = tree.body.filter((node) => node.type === "ClassDeclaration");
    const topLevelBindings = tree.body.filter((node) =>
      node.type === "VariableDeclaration" || node.type === "FunctionDeclaration");
    const topLevelEffects = tree.body.filter((node) =>
      !["ClassDeclaration", "EmptyStatement"].includes(node.type));
    const classNode = classes[0];
    const fields = [];
    const methods = [];
    const forbiddenReads = [];
    const allocationTotals = {
      objectExpressions: 0,
      arrayExpressions: 0,
      newExpressions: 0,
      objectFreezeCalls: 0,
      objectAssignCalls: 0,
      roundingCalls: 0,
    };

    for (const element of classNode?.body?.body || []) {
      if (element.type === "PropertyDefinition") {
        const name = this.#memberName(element.key);
        fields.push({
          name,
          visibility: element.key.type === "PrivateIdentifier" ? "private" : "public",
          initializerType: element.value?.type || null,
          objectShape: element.value?.type === "ObjectExpression"
            ? element.value.properties.map((property) => this.#memberName(property.key)).sort()
            : [],
        });
        this.#walk(element.value, allocationTotals, forbiddenReads);
      }
      if (element.type === "MethodDefinition") {
        const counts = {
          objectExpressions: 0,
          arrayExpressions: 0,
          newExpressions: 0,
          objectFreezeCalls: 0,
          objectAssignCalls: 0,
          roundingCalls: 0,
        };
        this.#walk(element.value, counts, forbiddenReads);
        for (const key of Object.keys(allocationTotals)) {
          allocationTotals[key] += counts[key];
        }
        methods.push({
          name: this.#memberName(element.key),
          kind: element.kind,
          parameterCount: element.value.params.length,
          allocations: counts,
        });
      }
    }

    return immutableRecord({
      currentPath,
      classDeclarations: classes.map((node) => node.id.name).sort(),
      topLevelBindings: topLevelBindings.map((node) => node.type).sort(),
      topLevelEffects: topLevelEffects.map((node) =>
        `${node.type}@${node.loc.start.line}:${node.loc.start.column + 1}`).sort(),
      fields: fields.sort((left, right) => left.name.localeCompare(right.name)),
      methods: methods.sort((left, right) =>
        `${left.kind}\0${left.name}`.localeCompare(`${right.kind}\0${right.name}`)),
      allocationTotals,
      forbiddenReads: [...new Set(forbiddenReads)].sort(),
    });
  }

  #walk(root, counts, forbiddenReads) {
    if (!root) return;
    estraverse.traverse(root, {
      fallback: "iteration",
      enter(node, parent) {
        if (node.type === "ObjectExpression") counts.objectExpressions += 1;
        if (node.type === "ArrayExpression") counts.arrayExpressions += 1;
        if (node.type === "NewExpression") counts.newExpressions += 1;
        if (node.type === "CallExpression" && node.callee?.type === "MemberExpression") {
          const object = node.callee.object;
          const property = node.callee.property;
          if (object?.name === "Object" && property?.name === "freeze") counts.objectFreezeCalls += 1;
          if (object?.name === "Object" && property?.name === "assign") counts.objectAssignCalls += 1;
          if (object?.name === "Math" && ["round", "floor", "ceil", "trunc"].includes(property?.name)) {
            counts.roundingCalls += 1;
          }
        }
        if (node.type !== "Identifier") return;
        const isStaticProperty = parent?.type === "MemberExpression" &&
          parent.property === node && !parent.computed;
        if (isStaticProperty) return;
        if (node.name === "__CYBER_FISHING_COMPAT_RUNTIME__") forbiddenReads.push("transport");
        if (["window", "document", "localStorage", "sessionStorage", "Audio", "AudioContext", "CanvasRenderingContext2D"].includes(node.name)) {
          forbiddenReads.push(`browser:${node.name}`);
        }
        if (["CONFIG", "GAME_CONFIG", "FISHING_CONFIG"].includes(node.name)) {
          forbiddenReads.push(`config:${node.name}`);
        }
      },
    });
  }

  #memberName(node) {
    if (node?.type === "PrivateIdentifier") return `#${node.name}`;
    if (node?.type === "Identifier") return node.name;
    if (node?.type === "Literal") return String(node.value);
    return "computed";
  }
}

class StageThreeBatch007DependencyStateAuditBuilder {
  constructor({ sourceObserver = new StageThreeBatch007SourceObserver() } = {}) {
    this.sourceObserver = sourceObserver;
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
    sourceReader,
  }) {
    const batch = approvedPlan.batches.find((record) => record.id === BATCH_ID);
    this.#require(batch?.status === "approved-frozen", "batch 007 is not approved-frozen");
    this.#require(batch.modules.length === EXPECTED_TARGET_COUNT, "batch 007 must contain six modules");
    this.#require(typeof sourceReader === "function", "sourceReader must be provided");
    const completedPrefix = approvedPlan.batches.slice(0, 6).map((record) => record.id);
    this.#require(this.#same(executionState.completedBatchIds, completedPrefix), "completed prefix must be 001-006");
    this.#require(executionState.activeBatchId === null, "batch 007 audit requires no active batch");

    const previousBatch = approvedPlan.batches[5];
    const existingModules = new Set([
      ...previousBatch.cumulativeRuntimeTopology.stage2Targets,
      ...previousBatch.cumulativeRuntimeTopology.stage3Targets,
    ]);
    const manifestByPath = new Map(manifest.modules.map((entry) => [entry.currentPath, entry]));
    const auditByPath = new Map(domainAudit.entries.map((entry) => [entry.currentPath, entry]));
    const currentPaths = new Set(batch.modules.map((module) => module.currentPath));
    const targetPaths = new Set(batch.modules.map((module) => module.targetPath));

    const modules = batch.modules.map((module) => {
      const manifestEntry = manifestByPath.get(module.currentPath);
      const auditEntry = auditByPath.get(module.currentPath);
      const reviewed = REVIEWED_CONTRACTS[module.currentPath];
      this.#require(manifestEntry, `manifest entry is missing: ${module.currentPath}`);
      this.#require(auditEntry?.dependencyAudit?.status === "verified", `dependency audit is stale: ${module.currentPath}`);
      this.#require(auditEntry?.stateOwnership?.status === "verified", `state audit is stale: ${module.currentPath}`);
      this.#require(reviewed, `reviewed contract is missing: ${module.currentPath}`);
      const source = sourceReader(module.currentPath);
      const sourceShape = this.sourceObserver.observe(source, module.currentPath);
      const providers = manifestEntry.observed.providers.items;
      this.#require(sourceShape.classDeclarations.length === 1, `exactly one class required: ${module.currentPath}`);
      this.#require(sourceShape.classDeclarations[0] === providers[0]?.symbol, `provider/class mismatch: ${module.currentPath}`);
      this.#require(sourceShape.topLevelBindings.length === 0, `top-level binding exists: ${module.currentPath}`);
      this.#require(sourceShape.topLevelEffects.length === 0, `top-level effect exists: ${module.currentPath}`);
      this.#require(sourceShape.forbiddenReads.length === 0, `forbidden read exists: ${module.currentPath}`);
      const observedFields = sourceShape.fields.map((field) => field.name).sort();
      this.#require(this.#same(observedFields, [...reviewed.instanceFields].sort()), `instance field shape differs: ${module.currentPath}`);
      for (const evidence of reviewed.callSiteEvidence) {
        this.#require(
          sourceReader(evidence.path).includes(evidence.marker),
          `hot-loop call-site evidence is stale: ${module.currentPath} -> ${evidence.path}`,
        );
      }
      const facts = auditEntry.dependencyAudit.facts;
      return {
        currentPath: module.currentPath,
        targetPath: module.targetPath,
        sourceSha256: this.#sha256(source),
        exports: providers.map((provider) => provider.symbol).sort(),
        roles: [...module.roles].sort(),
        dependencyDepth: facts.dependencyDepth,
        scc: facts.scc,
        outgoingProjectEdges: [...facts.internalDependencies, ...facts.externalDependencies]
          .sort(this.#edgeCompare),
        sourceShape,
        state: {
          classification: reviewed.classification,
          instanceFields: [...reviewed.instanceFields].sort(),
          publicStateShape: [...reviewed.publicStateShape].sort(),
          snapshotShape: [...reviewed.snapshotShape].sort(),
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
          classification: "hot-loop-sensitive",
          callSites: [...reviewed.hotLoopCallSites].sort(),
          callSiteEvidence: reviewed.callSiteEvidence.map((record) => ({ ...record }))
            .sort((left, right) => `${left.path}\0${left.marker}`.localeCompare(`${right.path}\0${right.marker}`)),
          allocationBaseline: sourceShape.allocationTotals,
          additionalMigrationAllocationsAllowed: 0,
          transportLookupsAllowed: 0,
          comparisonMode: "target-ast-after-removing-export-must-equal-frozen-source-ast",
        },
        effects: {
          classification: "safe",
          topLevelEffects: [...facts.topLevelEffects],
        },
        providerFacts: providers,
      };
    }).sort((left, right) => left.currentPath.localeCompare(right.currentPath));

    const outgoingEdges = modules.flatMap((module) => module.outgoingProjectEdges.map((edge) => ({
      source: module.currentPath,
      target: edge.target,
      symbols: [...edge.symbols].sort(),
      resolution: edge.resolution,
    }))).sort(this.#edgeCompare);
    const internalEdges = outgoingEdges.filter((edge) => currentPaths.has(edge.target));
    const alreadyCumulativeDependencies = outgoingEdges.filter((edge) => existingModules.has(edge.target));
    const unexpectedDependencies = outgoingEdges.filter((edge) =>
      !currentPaths.has(edge.target) && !existingModules.has(edge.target));
    const frozenTargets = batch.cumulativeRuntimeTopology.stage3Targets
      .filter((target) => !existingModules.has(target)).sort();
    this.#require(this.#same(frozenTargets, [...targetPaths].sort()), "closure must add exactly the six frozen targets");

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
    this.#require(this.#same(consumers, observedConsumers), "consumer set differs from reverse observations");

    const activations = batch.compatibility.newActivations.map((activation) => ({
      ...activation.contract,
      mechanism: activation.mechanism,
      consumers: [...activation.legacyConsumers].sort(),
      removalCondition: activation.removalCondition,
    })).sort((left, right) => left.id.localeCompare(right.id));

    const boundaryIssues = modules.flatMap((module) => module.sourceShape.forbiddenReads.map((read) => ({
      module: module.currentPath,
      read,
    })));
    const issues = [
      ...unexpectedDependencies.map((edge) => `unexpected:${edge.source}->${edge.target}`),
      ...boundaryIssues.map((issue) => `forbidden-read:${issue.module}:${issue.read}`),
      ...(internalEdges.length === 0 ? [] : ["frozen-internal-edge-set-changed"]),
    ].sort();

    return immutableRecord({
      schemaVersion: 1,
      kind: "cyber-fishing-stage-3-batch-007-dependency-state-audit",
      status: issues.length === 0 ? "verified" : "failed",
      sourceReleaseVersion: executionState.releaseVersion,
      batchId: BATCH_ID,
      sourceEvidence: {
        approvedPlan: { path: "architecture/migration/stage_3_approved_batches.json", sha256: approvedPlanSha256 },
        manifest: { path: "architecture/migration/module_migration_manifest.json", sha256: manifestSha256 },
        domainAudit: { path: "architecture/migration/stage_3_domain_audit.json", sha256: domainAuditSha256 },
        executionState: { path: "architecture/migration/stage_3_execution_state.json", sha256: executionStateSha256 },
      },
      scope: { targetCount: modules.length, modules },
      closure: {
        existingCumulativeModuleCount: existingModules.size,
        existingCumulativeModules: [...existingModules].sort(),
        newProjectModuleCount: frozenTargets.length,
        newProjectModules: frozenTargets,
        resultingProjectModuleCount: new Set([...existingModules, ...frozenTargets]).size,
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
        cycles: [],
      },
      boundaries: {
        forbiddenEdges: [],
        directConfigDependencies: [],
        browserCapabilities: [],
        transportReads: [],
      },
      state: {
        reviewed: modules.map((module) => ({
          module: module.currentPath,
          classification: module.state.classification,
          ownerIdentity: module.state.ownerIdentity,
        })),
        unresolved: [],
      },
      behavior: {
        formulaSensitiveModules: modules.filter((module) =>
          module.state.classification.includes("calculator") ||
          module.state.classification.includes("derived-buffer"))
          .map((module) => module.currentPath),
        snapshotSensitiveModules: modules.filter((module) =>
          module.state.publicStateShape.length > 0 || module.state.snapshotShape.length > 0)
          .map((module) => module.currentPath),
        unresolved: [],
      },
      performance: {
        hotLoopSensitive: modules.map((module) => ({
          module: module.currentPath,
          callSites: module.performance.callSites,
          callSiteEvidence: module.performance.callSiteEvidence,
          allocationBaseline: module.performance.allocationBaseline,
        })),
        additionalMigrationAllocationsAllowed: 0,
        transportLookupsAllowed: 0,
        unresolved: [],
      },
      effects: {
        safe: modules.map((module) => module.currentPath),
        reviewed: [],
        unsafe: [],
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
        frozen: [...batch.prerequisites],
        newlyDiscovered: [],
      },
      migrationGates: [
        "representation-only-source-equivalence",
        "same-authoritative-owner-before-and-after",
        "exact-mutable-and-snapshot-shape",
        "zero-new-hot-loop-allocations",
        "zero-domain-transport-lookups",
        "exact-formula-default-clamp-and-rounding-semantics",
      ],
      issues,
      verdict: issues.length === 0 ? "eligible-for-execution-plan" : "runtime-migration-forbidden",
    });
  }

  #consumerCompare(left, right) {
    return `${left.provider}\0${left.source}\0${left.symbols.join(",")}`
      .localeCompare(`${right.provider}\0${right.source}\0${right.symbols.join(",")}`);
  }

  #edgeCompare(left, right) {
    return `${left.source || ""}\0${left.target || ""}\0${(left.symbols || []).join(",")}`
      .localeCompare(`${right.source || ""}\0${right.target || ""}\0${(right.symbols || []).join(",")}`);
  }

  #sha256(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
  }

  #same(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  #require(condition, message) {
    if (!condition) throw new Error(`Stage 3.7.0 audit failed: ${message}`);
  }
}

class StageThreeBatch007DependencyStateAuditValidator {
  validate(artifact) {
    const errors = [];
    const require = (condition, message) => {
      if (!condition) errors.push(message);
    };
    require(artifact?.schemaVersion === 1, "schemaVersion must be 1");
    require(artifact?.kind === "cyber-fishing-stage-3-batch-007-dependency-state-audit", "kind is invalid");
    require(artifact?.batchId === BATCH_ID, "batchId is invalid");
    require(artifact?.status === "verified", "audit must be verified");
    require(artifact?.verdict === "eligible-for-execution-plan", "verdict must allow execution planning");
    require(artifact?.scope?.targetCount === EXPECTED_TARGET_COUNT, "scope must contain six targets");
    require(artifact?.scope?.modules?.length === EXPECTED_TARGET_COUNT, "module records must contain six targets");
    require(artifact?.closure?.existingCumulativeModuleCount === 25, "existing graph must contain 25 modules");
    require(artifact?.closure?.newProjectModuleCount === EXPECTED_TARGET_COUNT, "closure must add six targets");
    require(artifact?.closure?.resultingProjectModuleCount === 31, "resulting graph must contain 31 modules");
    require(artifact?.closure?.internalEdges?.length === 0, "internal dependency exists");
    require(artifact?.closure?.alreadyCumulativeDependencies?.length === 0, "unexpected existing dependency exists");
    require(artifact?.closure?.unexpectedDependencies?.length === 0, "unexpected dependency exists");
    require(artifact?.evaluation?.cycles?.length === 0, "cycle exists");
    require(artifact?.evaluation?.stronglyConnectedComponents?.length === 6, "SCC coverage differs");
    require(artifact?.evaluation?.stronglyConnectedComponents?.every((scc) =>
      scc.cyclic === false && scc.members.length === 1), "each SCC must be acyclic singleton");
    require(Object.values(artifact?.boundaries || {}).every((records) => records.length === 0), "boundary fact is forbidden");
    require(artifact?.state?.reviewed?.length === 6, "six state contracts must be reviewed");
    require(artifact?.state?.unresolved?.length === 0, "state review is unresolved");
    require(artifact?.behavior?.formulaSensitiveModules?.length === 4, "formula-sensitive coverage differs");
    require(artifact?.behavior?.snapshotSensitiveModules?.length === 2, "snapshot-sensitive coverage differs");
    require(artifact?.behavior?.unresolved?.length === 0, "behavior review is unresolved");
    require(artifact?.performance?.hotLoopSensitive?.length === 6, "hot-loop coverage must contain six modules");
    require(artifact?.performance?.additionalMigrationAllocationsAllowed === 0, "new allocations must be forbidden");
    require(artifact?.performance?.transportLookupsAllowed === 0, "transport lookups must be forbidden");
    require(artifact?.performance?.unresolved?.length === 0, "performance review is unresolved");
    require(artifact?.effects?.unsafe?.length === 0, "unsafe effect exists");
    require(artifact?.compatibility?.providers?.length === 6, "provider coverage differs");
    require(artifact?.compatibility?.consumers?.length === EXPECTED_CONSUMER_COUNT, "consumer coverage must contain nine relationships");
    require(artifact?.compatibility?.activations?.length === 6, "activation coverage differs");
    require(artifact?.prerequisites?.frozen?.length === 0, "frozen prerequisite exists");
    require(artifact?.prerequisites?.newlyDiscovered?.length === 0, "new prerequisite discovered");
    require(artifact?.migrationGates?.length === 6, "migration gates are incomplete");
    require(artifact?.issues?.length === 0, "audit issues must be empty");
    for (const module of artifact?.scope?.modules || []) {
      const reviewed = REVIEWED_CONTRACTS[module.currentPath];
      require(reviewed !== undefined, `reviewed contract is missing: ${module.currentPath}`);
      require(/^[a-f0-9]{64}$/u.test(module.sourceSha256), `source fingerprint is invalid: ${module.currentPath}`);
      require(/^[a-f0-9]{64}$/u.test(module.behavior?.formulaDefaultsClampsRoundingFingerprint), `behavior fingerprint is invalid: ${module.currentPath}`);
      require(module.sourceShape?.topLevelBindings?.length === 0, `top-level binding exists: ${module.currentPath}`);
      require(module.sourceShape?.topLevelEffects?.length === 0, `top-level effect exists: ${module.currentPath}`);
      require(module.sourceShape?.forbiddenReads?.length === 0, `forbidden read exists: ${module.currentPath}`);
      require(module.state?.duplicateStateCopies === "forbidden", `duplicate state is not forbidden: ${module.currentPath}`);
      require(module.state?.classification === reviewed?.classification, `state classification differs: ${module.currentPath}`);
      require(JSON.stringify(module.state?.instanceFields) === JSON.stringify([...(reviewed?.instanceFields || [])].sort()), `instance field shape differs: ${module.currentPath}`);
      require(JSON.stringify(module.state?.publicStateShape) === JSON.stringify([...(reviewed?.publicStateShape || [])].sort()), `public state shape differs: ${module.currentPath}`);
      require(JSON.stringify(module.state?.snapshotShape) === JSON.stringify([...(reviewed?.snapshotShape || [])].sort()), `snapshot shape differs: ${module.currentPath}`);
      require(module.state?.stableResultIdentity === reviewed?.stableResultIdentity, `result identity differs: ${module.currentPath}`);
      require(module.state?.mutatesCallerInputs === reviewed?.mutatesCallerInputs, `caller mutation contract differs: ${module.currentPath}`);
      require(module.performance?.classification === "hot-loop-sensitive", `hot-loop classification differs: ${module.currentPath}`);
      require(module.performance?.callSites?.length > 0, `hot-loop call-site evidence is missing: ${module.currentPath}`);
      require(JSON.stringify(module.performance?.callSites) === JSON.stringify([...(reviewed?.hotLoopCallSites || [])].sort()), `hot-loop call-site set differs: ${module.currentPath}`);
      require(module.performance?.additionalMigrationAllocationsAllowed === 0, `allocation budget differs: ${module.currentPath}`);
      require(module.performance?.transportLookupsAllowed === 0, `transport budget differs: ${module.currentPath}`);
      require(module.effects?.classification === "safe", `effect differs: ${module.currentPath}`);
    }
    if (errors.length > 0) {
      throw new Error(`Stage 3.7.0 audit contract failed:\n- ${errors.join("\n- ")}`);
    }
    return immutableRecord(artifact);
  }
}

module.exports = {
  BATCH_ID,
  EXPECTED_TARGET_COUNT,
  EXPECTED_CONSUMER_COUNT,
  ROD_PULL_FIELDS,
  ROD_STROKE_SNAPSHOT_FIELDS,
  REVIEWED_CONTRACTS,
  StageThreeBatch007SourceObserver,
  StageThreeBatch007DependencyStateAuditBuilder,
  StageThreeBatch007DependencyStateAuditValidator,
};
