"use strict";

const crypto = require("node:crypto");
const espree = require("espree");
const { immutableRecord } = require("../guards/core/guard_models");

const BATCH_ID = "stage-3.candidate-006-fishing-e48e70d8";
const EXPECTED_TARGET_COUNT = 6;

const STATE_DECISIONS = Object.freeze({
  "src/core/fishing/hold_opposition_resolver.js": Object.freeze({
    classification: "stateless-behavior",
    instanceState: [],
    stateSemantics: "No mutable module or instance field; method-local values only.",
  }),
  "src/core/fishing/landing_lift_tension_calculator.js": Object.freeze({
    classification: "stateless-behavior",
    instanceState: [],
    stateSemantics: "No mutable module or instance field; each result is derived from method inputs.",
  }),
  "src/core/fishing/line_constraint_state_resolver.js": Object.freeze({
    classification: "stateless-behavior",
    instanceState: [],
    stateSemantics: "No mutable module or instance field; each result is derived from method inputs.",
  }),
  "src/core/fishing/pole_fight_sector_geometry.js": Object.freeze({
    classification: "instance-local-derived-buffer",
    instanceState: ["PoleFightSectorGeometry#frame"],
    stateSemantics: "Each instance owns one reusable derived frame; the frame is not module-global or authoritative gameplay state.",
  }),
  "src/core/fishing/rod_control_tension_mode_resolver.js": Object.freeze({
    classification: "stateless-behavior",
    instanceState: [],
    stateSemantics: "No mutable module or instance field; each result is derived from method inputs.",
  }),
  "src/core/float_tackle_line_budget_policy.js": Object.freeze({
    classification: "instance-local-config-reference",
    instanceState: ["FloatTackleLineBudgetPolicy#config"],
    stateSemantics: "Constructor injection stores the supplied config reference per instance; the module does not import or own raw configuration.",
  }),
});

class StageThreeBatchDependencyStateAuditBuilder {
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
    this.#require(batch, `Frozen batch is missing: ${BATCH_ID}`);
    this.#require(batch.status === "approved-frozen", "Batch 006 is not approved-frozen");
    this.#require(batch.modules.length === EXPECTED_TARGET_COUNT, "Batch 006 must contain exactly six modules");
    this.#require(typeof sourceReader === "function", "sourceReader must be provided");

    const previousBatch = approvedPlan.batches[batch.order - 2];
    const expectedCompletedPrefix = approvedPlan.batches
      .slice(0, batch.order - 1)
      .map((record) => record.id);
    this.#require(
      this.#same(executionState.completedBatchIds, expectedCompletedPrefix),
      "Execution state does not contain the exact completed prefix 001-005",
    );
    this.#require(executionState.activeBatchId === null, "Batch 006 audit requires no active batch");

    const manifestByPath = new Map(manifest.modules.map((entry) => [entry.currentPath, entry]));
    const auditByPath = new Map(domainAudit.entries.map((entry) => [entry.currentPath, entry]));
    const targetPaths = new Set(batch.modules.map((module) => module.targetPath));
    const currentPaths = new Set(batch.modules.map((module) => module.currentPath));
    const existingModules = new Set([
      ...previousBatch.cumulativeRuntimeTopology.stage2Targets,
      ...previousBatch.cumulativeRuntimeTopology.stage3Targets,
    ]);

    const moduleRecords = batch.modules.map((module) => {
      const manifestEntry = manifestByPath.get(module.currentPath);
      const auditEntry = auditByPath.get(module.currentPath);
      this.#require(manifestEntry, `Manifest entry is missing: ${module.currentPath}`);
      this.#require(auditEntry, `Stage 3 audit entry is missing: ${module.currentPath}`);
      this.#require(
        auditEntry.dependencyAudit.status === "verified",
        `Dependency audit is not verified: ${module.currentPath}`,
      );
      this.#require(
        auditEntry.stateOwnership.status === "verified",
        `State observation is not verified: ${module.currentPath}`,
      );
      const source = sourceReader(module.currentPath);
      const syntax = this.#observeSource(source, module.currentPath);
      const stateDecision = STATE_DECISIONS[module.currentPath];
      this.#require(stateDecision, `State decision is missing: ${module.currentPath}`);
      const expectedSymbols = module.providers.map((provider) => provider.symbol).sort();
      this.#require(
        this.#same(syntax.classDeclarations, expectedSymbols),
        `Provider/class declaration mismatch: ${module.currentPath}`,
      );
      this.#require(syntax.topLevelEffectKinds.length === 0, `Top-level effect detected: ${module.currentPath}`);
      this.#require(syntax.moduleBindings.length === 0, `Module binding detected: ${module.currentPath}`);
      const facts = auditEntry.dependencyAudit.facts;
      return {
        currentPath: module.currentPath,
        targetPath: module.targetPath,
        sourceSha256: this.#sha256(source),
        exports: expectedSymbols,
        roles: [...module.roles].sort(),
        dependencyDepth: facts.dependencyDepth,
        scc: facts.scc,
        outgoingProjectEdges: [
          ...facts.internalDependencies,
          ...facts.externalDependencies,
        ].sort(this.#edgeCompare),
        capabilities: [...facts.capabilities].sort(),
        availabilityConstraints: [...facts.availabilityConstraints],
        dynamicConstructs: [...manifestEntry.observed.environment.dynamicConstructs].sort(),
        sourceShape: syntax,
        state: {
          moduleState: "none",
          classification: stateDecision.classification,
          instanceState: [...stateDecision.instanceState],
          stateSemantics: stateDecision.stateSemantics,
          authoritativeOwnerBefore: module.stateOwnershipInvariant.before,
          authoritativeOwnerAfter: module.stateOwnershipInvariant.after,
          ownerIdentity: module.stateOwnershipInvariant.ownerIdentity,
          duplicateStateCopies: module.stateOwnershipInvariant.duplicateStateCopies,
        },
        effects: {
          classification: "safe",
          topLevelEffects: [...facts.topLevelEffects],
          reviewEvidence: [],
        },
        providerFacts: manifestEntry.observed.providers.items,
      };
    }).sort((left, right) => left.currentPath.localeCompare(right.currentPath));

    const outgoingEdges = moduleRecords
      .flatMap((module) => module.outgoingProjectEdges.map((edge) => ({
        source: module.currentPath,
        target: edge.target,
        symbols: [...edge.symbols].sort(),
        resolution: edge.resolution,
      })))
      .sort(this.#edgeCompare);
    const internalEdges = outgoingEdges.filter((edge) => currentPaths.has(edge.target));
    const alreadyCumulativeDependencies = outgoingEdges.filter((edge) => existingModules.has(edge.target));
    const unexpectedDependencies = outgoingEdges.filter((edge) =>
      !currentPaths.has(edge.target) && !existingModules.has(edge.target));
    const frozenNewTargets = batch.cumulativeRuntimeTopology.stage3Targets
      .filter((target) => !existingModules.has(target))
      .sort();
    const exactTargets = [...targetPaths].sort();
    this.#require(this.#same(frozenNewTargets, exactTargets), "Frozen cumulative closure does not add exactly the six batch targets");
    this.#require(unexpectedDependencies.length === 0, "Unexpected recursive project dependency discovered");

    const classicConsumers = batch.externalLegacyConsumers
      .map((consumer) => ({
        provider: consumer.provider,
        source: consumer.source,
        sourceBoundary: consumer.sourceBoundary,
        symbols: [...consumer.symbols].sort(),
      }))
      .sort(this.#consumerCompare);
    const observedConsumers = moduleRecords.flatMap((module) => {
      const auditEntry = auditByPath.get(module.currentPath);
      return auditEntry.dependencyAudit.facts.reverseConsumers.map((consumer) => ({
        provider: module.currentPath,
        source: consumer.source,
        sourceBoundary: consumer.sourceBoundary,
        symbols: [...consumer.symbols].sort(),
      }));
    }).sort(this.#consumerCompare);
    this.#require(this.#same(observedConsumers, classicConsumers), "Classic consumer set differs from verified reverse observations");

    const activations = batch.compatibility.newActivations
      .map((activation) => ({
        ...activation.contract,
        mechanism: activation.mechanism,
        consumers: [...activation.legacyConsumers].sort(),
        removalCondition: activation.removalCondition,
      }))
      .sort((left, right) => left.id.localeCompare(right.id));
    this.#require(activations.length === EXPECTED_TARGET_COUNT, "Batch 006 must contain exactly six activations");

    const forbiddenEdges = outgoingEdges.filter((edge) => {
      const targetEntry = manifestByPath.get(edge.target);
      return ["game-application", "platform", "dev", "presentation"].includes(
        targetEntry?.architecture?.targetBoundary,
      );
    });
    const browserCapabilities = moduleRecords.flatMap((module) =>
      module.capabilities.map((capability) => ({ module: module.currentPath, capability })));
    const transportReads = moduleRecords.filter((module) =>
      module.sourceShape.transportReads.length > 0);
    const configDependencies = outgoingEdges.filter((edge) =>
      manifestByPath.get(edge.target)?.architecture?.targetBoundary === "game-config");
    const unsafeEffects = moduleRecords.filter((module) => module.effects.classification === "unsafe");
    const unresolvedState = moduleRecords.filter((module) => module.state.classification === "unresolved");
    const issues = [
      ...forbiddenEdges.map((edge) => `forbidden-edge:${edge.source}->${edge.target}`),
      ...browserCapabilities.map((fact) => `browser-capability:${fact.module}:${fact.capability}`),
      ...transportReads.map((module) => `transport-read:${module.currentPath}`),
      ...configDependencies.map((edge) => `direct-config-edge:${edge.source}->${edge.target}`),
      ...unsafeEffects.map((module) => `unsafe-effect:${module.currentPath}`),
      ...unresolvedState.map((module) => `unresolved-state:${module.currentPath}`),
    ].sort();
    const newlyDiscoveredPrerequisites = issues.map((issue) => ({ kind: "audit-blocker", issue }));

    return immutableRecord({
      schemaVersion: 1,
      kind: "cyber-fishing-stage-3-batch-dependency-state-audit",
      status: issues.length === 0 ? "verified" : "failed",
      sourceReleaseVersion: executionState.releaseVersion,
      batchId: BATCH_ID,
      sourceEvidence: {
        approvedPlan: {
          path: "architecture/migration/stage_3_approved_batches.json",
          sha256: approvedPlanSha256,
        },
        manifest: {
          path: "architecture/migration/module_migration_manifest.json",
          sha256: manifestSha256,
        },
        domainAudit: {
          path: "architecture/migration/stage_3_domain_audit.json",
          sha256: domainAuditSha256,
        },
        executionState: {
          path: "architecture/migration/stage_3_execution_state.json",
          sha256: executionStateSha256,
        },
      },
      scope: {
        targetCount: moduleRecords.length,
        modules: moduleRecords,
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
        stronglyConnectedComponents: moduleRecords.map((module) => module.scc)
          .sort((left, right) => left.id.localeCompare(right.id)),
        layers: [moduleRecords.map((module) => module.targetPath).sort()],
        cycles: [],
      },
      boundaries: {
        forbiddenEdges,
        directConfigDependencies: configDependencies,
        browserCapabilities,
        transportReads: transportReads.map((module) => module.currentPath),
      },
      state: {
        safe: moduleRecords.map((module) => ({
          module: module.currentPath,
          classification: module.state.classification,
        })),
        reviewed: [],
        unresolved: [],
      },
      effects: {
        safe: moduleRecords.map((module) => module.currentPath),
        reviewed: [],
        unsafe: [],
      },
      compatibility: {
        providers: moduleRecords.flatMap((module) => module.providerFacts.map((provider) => ({
          module: module.currentPath,
          symbol: provider.symbol,
          mechanism: provider.mechanism,
          availability: provider.availability,
        }))).sort((left, right) => `${left.module}\0${left.symbol}`.localeCompare(`${right.module}\0${right.symbol}`)),
        consumers: classicConsumers,
        activations,
      },
      prerequisites: {
        frozen: [...batch.prerequisites],
        newlyDiscovered: newlyDiscoveredPrerequisites,
      },
      issues,
      verdict: issues.length === 0
        ? "eligible-for-execution-plan"
        : "runtime-migration-forbidden",
    });
  }

  #observeSource(source, currentPath) {
    let tree;
    try {
      tree = espree.parse(source, {
        ecmaVersion: "latest",
        sourceType: "script",
        loc: true,
      });
    } catch (error) {
      throw new Error(`Cannot parse ${currentPath}: ${error.message}`);
    }
    const classDeclarations = tree.body
      .filter((node) => node.type === "ClassDeclaration")
      .map((node) => node.id.name)
      .sort();
    const moduleBindings = tree.body
      .filter((node) => node.type === "VariableDeclaration")
      .flatMap((node) => node.declarations.map((declaration) => declaration.id.name || "destructuring"))
      .sort();
    const topLevelEffectKinds = tree.body
      .filter((node) => !["ClassDeclaration", "FunctionDeclaration", "VariableDeclaration", "EmptyStatement"].includes(node.type))
      .map((node) => `${node.type}@${node.loc.start.line}:${node.loc.start.column + 1}`)
      .sort();
    const transportReads = [];
    const browserIdentifiers = [];
    const walk = (node, parent = null) => {
      if (!node || typeof node !== "object") return;
      if (node.type === "Identifier") {
        if (node.name === "__CYBER_FISHING_COMPAT_RUNTIME__") {
          transportReads.push(`${node.loc.start.line}:${node.loc.start.column + 1}`);
        }
        if (["window", "document", "localStorage", "sessionStorage", "Audio", "AudioContext", "CanvasRenderingContext2D"].includes(node.name)) {
          const isProperty = parent?.type === "MemberExpression" && parent.property === node && !parent.computed;
          if (!isProperty) browserIdentifiers.push(node.name);
        }
      }
      for (const [key, value] of Object.entries(node)) {
        if (key === "loc" || key === "range" || key === "tokens" || key === "comments") continue;
        if (Array.isArray(value)) value.forEach((item) => walk(item, node));
        else if (value && typeof value === "object" && typeof value.type === "string") walk(value, node);
      }
    };
    walk(tree);
    return {
      classDeclarations,
      moduleBindings,
      topLevelEffectKinds,
      transportReads: [...new Set(transportReads)].sort(),
      browserIdentifiers: [...new Set(browserIdentifiers)].sort(),
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
    if (!condition) throw new Error(`Stage 3.6.1 audit failed: ${message}`);
  }
}

class StageThreeBatchDependencyStateAuditValidator {
  validate(artifact) {
    const errors = [];
    const require = (condition, message) => {
      if (!condition) errors.push(message);
    };
    require(artifact?.schemaVersion === 1, "schemaVersion must be 1");
    require(artifact?.kind === "cyber-fishing-stage-3-batch-dependency-state-audit", "kind is invalid");
    require(artifact?.batchId === BATCH_ID, "batchId is invalid");
    require(artifact?.status === "verified", "audit status must be verified");
    require(artifact?.verdict === "eligible-for-execution-plan", "verdict must allow only execution planning");
    require(artifact?.scope?.targetCount === EXPECTED_TARGET_COUNT, "scope must contain exactly six targets");
    require(artifact?.scope?.modules?.length === EXPECTED_TARGET_COUNT, "module records must contain exactly six targets");
    require(new Set(artifact?.scope?.modules?.map((module) => module.currentPath)).size === EXPECTED_TARGET_COUNT, "module paths must be unique");
    require(artifact?.closure?.newProjectModuleCount === EXPECTED_TARGET_COUNT, "closure must add exactly six project modules");
    require(artifact?.closure?.newProjectModules?.length === EXPECTED_TARGET_COUNT, "new project module set must contain six targets");
    require(artifact?.closure?.unexpectedDependencies?.length === 0, "unexpected dependency exists");
    require(artifact?.closure?.internalEdges?.length === 0, "frozen batch 006 must remain an independent depth-zero cluster");
    require(artifact?.evaluation?.cycles?.length === 0, "cycle detected");
    require(artifact?.evaluation?.stronglyConnectedComponents?.length === EXPECTED_TARGET_COUNT, "SCC coverage is incomplete");
    require(artifact?.evaluation?.stronglyConnectedComponents?.every((scc) => scc.cyclic === false && scc.members.length === 1), "each target must remain an acyclic singleton SCC");
    require(artifact?.boundaries?.forbiddenEdges?.length === 0, "forbidden boundary edge exists");
    require(artifact?.boundaries?.directConfigDependencies?.length === 0, "direct config dependency exists");
    require(artifact?.boundaries?.browserCapabilities?.length === 0, "browser capability exists");
    require(artifact?.boundaries?.transportReads?.length === 0, "compatibility transport read exists");
    require(artifact?.state?.unresolved?.length === 0, "state classification is unresolved");
    require(artifact?.effects?.unsafe?.length === 0, "unsafe top-level effect exists");
    require(artifact?.compatibility?.providers?.length === EXPECTED_TARGET_COUNT, "provider coverage must contain six symbols");
    require(artifact?.compatibility?.activations?.length === EXPECTED_TARGET_COUNT, "activation coverage must contain six contracts");
    require(artifact?.compatibility?.consumers?.length === 7, "classic consumer map must contain seven exact relationships");
    require(artifact?.prerequisites?.frozen?.length === 0, "frozen prerequisites changed");
    require(artifact?.prerequisites?.newlyDiscovered?.length === 0, "new prerequisite discovered");
    require(artifact?.issues?.length === 0, "audit issues must be empty");
    for (const module of artifact?.scope?.modules || []) {
      require(/^[a-f0-9]{64}$/.test(module.sourceSha256), `source fingerprint is invalid: ${module.currentPath}`);
      require(module.sourceShape?.moduleBindings?.length === 0, `module state binding exists: ${module.currentPath}`);
      require(module.sourceShape?.topLevelEffectKinds?.length === 0, `top-level effect exists: ${module.currentPath}`);
      require(module.sourceShape?.transportReads?.length === 0, `transport read exists: ${module.currentPath}`);
      require(module.sourceShape?.browserIdentifiers?.length === 0, `browser identifier exists: ${module.currentPath}`);
      require(module.state?.moduleState === "none", `module state is not empty: ${module.currentPath}`);
      require(module.state?.duplicateStateCopies === "forbidden", `duplicate state is not forbidden: ${module.currentPath}`);
      require(module.effects?.classification === "safe", `effect is not safe: ${module.currentPath}`);
    }
    if (errors.length > 0) {
      throw new Error(`Stage 3.6.1 audit contract failed:\n- ${errors.join("\n- ")}`);
    }
    return immutableRecord(artifact);
  }
}

module.exports = {
  BATCH_ID,
  EXPECTED_TARGET_COUNT,
  STATE_DECISIONS,
  StageThreeBatchDependencyStateAuditBuilder,
  StageThreeBatchDependencyStateAuditValidator,
};
