const { MigrationBatchPlanValidator } = require("./migration_batch_plan_validator");

class ApprovedStageTwoBatchValidator {
  constructor({ architecturePolicy }) {
    this.architecturePolicy = architecturePolicy;
    this.candidateValidator = new MigrationBatchPlanValidator({
      architecturePolicy,
    });
  }

  validate({ approvedPlan, candidatePlan, manifest, bridgeRegistry }) {
    const errors = [];
    const candidateSummary = this.candidateValidator.validate({
      plan: candidatePlan,
      manifest,
    });

    this.#require(approvedPlan?.schemaVersion === 1, "schemaVersion must be 1", errors);
    this.#require(approvedPlan?.stage === "1.9", "stage must be 1.9", errors);
    this.#require(
      approvedPlan?.status === "approved-frozen",
      "status must be approved-frozen",
      errors,
    );
    this.#require(
      approvedPlan?.sourceCandidatePlan ===
        "architecture/migration/stage_1_6_initial_batches.json",
      "sourceCandidatePlan must identify the Stage 1.6 candidate plan",
      errors,
    );
    this.#require(
      approvedPlan?.sourceManifest ===
        "architecture/migration/module_migration_manifest.json",
      "sourceManifest must identify the migration manifest",
      errors,
    );
    this.#require(
      /^0\.\d+\.\d+$/.test(approvedPlan?.approvedAtVersion || ""),
      "approvedAtVersion must be a project version",
      errors,
    );
    this.#require(
      Array.isArray(bridgeRegistry?.bridges) && bridgeRegistry.bridges.length === 0,
      "Stage 1.9 must not activate migration bridges",
      errors,
    );

    this.#validatePrerequisite(approvedPlan?.prerequisite, errors);

    const approvedBatches = Array.isArray(approvedPlan?.batches)
      ? approvedPlan.batches
      : [];
    const candidateBatches = Array.isArray(candidatePlan?.batches)
      ? candidatePlan.batches
      : [];
    this.#require(
      approvedBatches.length === candidateBatches.length,
      "Every candidate batch must have exactly one approved batch",
      errors,
    );

    const bridgePaths = new Set();
    const outputPaths = new Set();
    for (let index = 0; index < candidateBatches.length; index += 1) {
      this.#validateBatch({
        approved: approvedBatches[index],
        candidate: candidateBatches[index],
        expectedOrder: index + 1,
        previousBatch: approvedBatches[index - 1] || null,
        prerequisiteId: approvedPlan?.prerequisite?.id,
        bridgePaths,
        outputPaths,
        errors,
      });
    }

    if (errors.length > 0) {
      throw new Error(
        `Stage 2 approved batch freeze failed:\n- ${errors.join("\n- ")}`,
      );
    }

    return Object.freeze({
      prerequisiteCount: 1,
      batchCount: approvedBatches.length,
      moduleCount: approvedBatches.reduce(
        (count, batch) => count + batch.modules.length,
        0,
      ),
      bridgeCount: bridgePaths.size,
      confirmedInterFileEdges: candidateSummary.confirmedInterFileEdges,
    });
  }

  #validatePrerequisite(prerequisite, errors) {
    this.#require(
      prerequisite?.id === "stage-2.0-classic-bridge-build-foundation",
      "Stage 2.0 classic bridge build prerequisite is required",
      errors,
    );
    this.#require(
      prerequisite?.status === "approved-prerequisite",
      "Stage 2.0 prerequisite must be approved",
      errors,
    );
    this.#require(
      prerequisite?.runtimeInput === "approved-esm-bridge-wrappers-only",
      "Stage 2.0 must build approved ESM bridge wrappers only",
      errors,
    );
    this.#require(
      prerequisite?.output?.directory === "dist/legacy-bridges/" &&
        prerequisite?.output?.format === "iife" &&
        prerequisite?.output?.tracked === false,
      "Stage 2.0 output must be ignored dist/legacy-bridges IIFE artifacts",
      errors,
    );
    this.#requireStringArray(
      prerequisite?.files?.create,
      "Stage 2.0 files.create",
      errors,
      3,
    );
    this.#requireStringArray(
      prerequisite?.files?.modify,
      "Stage 2.0 files.modify",
      errors,
      3,
    );
    this.#requireStringArray(
      prerequisite?.acceptanceCriteria,
      "Stage 2.0 acceptanceCriteria",
      errors,
      5,
    );
  }

  #validateBatch({
    approved,
    candidate,
    expectedOrder,
    previousBatch,
    prerequisiteId,
    bridgePaths,
    outputPaths,
    errors,
  }) {
    const label = candidate?.id || `batch ${expectedOrder}`;
    this.#require(approved?.id === candidate?.id, `${label} id changed`, errors);
    this.#require(approved?.order === expectedOrder, `${label} order changed`, errors);
    this.#require(
      approved?.status === "approved",
      `${label} must have approved status`,
      errors,
    );
    this.#require(
      approved?.targetBoundary === candidate?.targetBoundary,
      `${label} targetBoundary changed`,
      errors,
    );
    this.#require(
      approved?.migrationWave === candidate?.migrationWave,
      `${label} migrationWave changed`,
      errors,
    );

    const expectedPrerequisite = previousBatch?.id || prerequisiteId;
    this.#require(
      this.#sameArray(
        approved?.dependencyOrdering?.batchPrerequisites || [],
        [expectedPrerequisite],
      ),
      `${label} must follow the frozen serial batch order`,
      errors,
    );

    const approvedModules = Array.isArray(approved?.modules)
      ? approved.modules
      : [];
    const candidateModules = Array.isArray(candidate?.modules)
      ? candidate.modules
      : [];
    this.#require(
      approvedModules.length === candidateModules.length,
      `${label} module set changed`,
      errors,
    );

    const expectedModuleOrder = candidateModules.map((module) => module.currentPath);
    this.#require(
      this.#sameArray(
        approved?.dependencyOrdering?.moduleOrder || [],
        expectedModuleOrder,
      ),
      `${label} moduleOrder must match the reviewed candidate order`,
      errors,
    );

    for (let index = 0; index < candidateModules.length; index += 1) {
      this.#validateModule(
        approvedModules[index],
        candidateModules[index],
        label,
        errors,
      );
    }

    const bridges = Array.isArray(approved?.bridgeStrategy?.bridges)
      ? approved.bridgeStrategy.bridges
      : [];
    this.#require(
      approved?.bridgeStrategy?.kind === "vite-built-classic-iife",
      `${label} must use the approved synchronous IIFE bridge strategy`,
      errors,
    );
    this.#require(
      approved?.bridgeStrategy?.activation === "same-commit-as-module-cutover",
      `${label} bridge activation must be atomic with cutover`,
      errors,
    );
    this.#require(
      approved?.bridgeStrategy?.wrapperSemantics ===
        "esm-import-and-exact-global-exposure-only",
      `${label} bridge wrapper may only import and expose exact globals`,
      errors,
    );
    this.#require(
      approved?.bridgeStrategy?.scriptReplacement ===
        "one-for-one-at-original-legacy-load-order-position",
      `${label} must preserve classic provider load position`,
      errors,
    );
    this.#require(
      approved?.bridgeStrategy?.removalStage ===
        this.#normalizeStage(candidate?.compatibility?.removalStage),
      `${label} bridge removalStage changed`,
      errors,
    );
    this.#require(
      approved?.bridgeStrategy?.owner === approved?.id,
      `${label} bridge owner must equal batch id`,
      errors,
    );
    this.#require(
      bridges.length === candidateModules.length,
      `${label} requires one bridge wrapper per migrated module`,
      errors,
    );
    for (let index = 0; index < candidateModules.length; index += 1) {
      this.#validateBridge({
        bridge: bridges[index],
        module: candidateModules[index],
        label,
        bridgePaths,
        outputPaths,
        errors,
      });
    }

    this.#requireStringArray(
      approved?.tests?.focused,
      `${label} tests.focused`,
      errors,
      1,
    );
    this.#require(
      this.#sameArray(approved?.tests?.suites || [], ["architecture", "quick", "all"]),
      `${label} must run architecture, quick and all suites`,
      errors,
    );
    this.#require(
      approved?.tests?.browserSmoke === true,
      `${label} requires browser smoke testing`,
      errors,
    );
    this.#requireStringArray(
      approved?.architectureGates,
      `${label} architectureGates`,
      errors,
      7,
    );
    for (const gate of [
      "approved-stage-2-batch-freeze",
      "architecture-guard-corpus",
      "migration-manifest-integrity",
      "stage-2-legacy-bridge-build",
    ]) {
      this.#require(
        approved?.architectureGates?.includes(gate),
        `${label} is missing architecture gate ${gate}`,
        errors,
      );
    }
    this.#require(
      approved?.rollback?.boundary === "single-batch-atomic-cutover",
      `${label} rollback must stop at the batch boundary`,
      errors,
    );
    this.#requireStringArray(
      approved?.rollback?.steps,
      `${label} rollback.steps`,
      errors,
      4,
    );
    this.#requireStringArray(
      approved?.acceptanceCriteria,
      `${label} acceptanceCriteria`,
      errors,
      8,
    );
  }

  #validateModule(approved, candidate, label, errors) {
    for (const field of ["currentPath", "targetPath"]) {
      this.#require(
        approved?.[field] === candidate?.[field],
        `${label} ${field} changed for ${candidate?.currentPath}`,
        errors,
      );
    }
    this.#require(
      this.#sameArray(approved?.providers || [], candidate?.providers || []),
      `${candidate?.currentPath} providers changed`,
      errors,
    );
    this.#require(
      this.#sameArray(
        approved?.legacyConsumers || [],
        candidate?.legacyConsumers || [],
      ),
      `${candidate?.currentPath} legacyConsumers changed`,
      errors,
    );
  }

  #validateBridge({
    bridge,
    module,
    label,
    bridgePaths,
    outputPaths,
    errors,
  }) {
    this.#require(
      bridge?.sourceModule === module.currentPath &&
        bridge?.targetModule === module.targetPath &&
        bridge?.replacesScript === module.currentPath,
      `${label} bridge must map the exact current and target module`,
      errors,
    );
    this.#require(
      this.architecturePolicy.resolveBoundary(bridge?.wrapperPath || "")?.id ===
        "engine",
      `${label} bridge wrapper must be owned by engine`,
      errors,
    );
    this.#require(
      /^dist\/legacy-bridges\/.+\.iife\.js$/.test(bridge?.outputPath || ""),
      `${label} bridge output must be a generated IIFE`,
      errors,
    );
    this.#require(
      bridge?.registrySourceMode === "one-record-per-legacy-consumer",
      `${label} bridge registry records must remain exact per consumer`,
      errors,
    );
    this.#require(
      this.#sameArray(bridge?.legacyConsumers || [], module.legacyConsumers || []),
      `${label} bridge consumer set changed for ${module.currentPath}`,
      errors,
    );
    const expectedGlobals = (module.providers || []).map((symbol) => ({
      symbol,
      mechanism: "global-this-property",
      availability: "program-init",
    }));
    this.#require(
      JSON.stringify(bridge?.globalProviders || []) === JSON.stringify(expectedGlobals),
      `${label} bridge globals changed for ${module.currentPath}`,
      errors,
    );
    this.#require(
      !bridgePaths.has(bridge?.wrapperPath),
      `${label} bridge wrapper path must be unique`,
      errors,
    );
    this.#require(
      !outputPaths.has(bridge?.outputPath),
      `${label} bridge output path must be unique`,
      errors,
    );
    bridgePaths.add(bridge?.wrapperPath);
    outputPaths.add(bridge?.outputPath);
  }

  #normalizeStage(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, "-");
  }

  #requireStringArray(value, label, errors, minimumLength) {
    this.#require(
      Array.isArray(value) &&
        value.length >= minimumLength &&
        value.every((item) => typeof item === "string" && item.trim().length > 0),
      `${label} requires at least ${minimumLength} non-empty strings`,
      errors,
    );
  }

  #sameArray(left, right) {
    return Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => value === right[index]);
  }

  #require(condition, message, errors) {
    if (!condition) errors.push(message);
  }
}

module.exports = { ApprovedStageTwoBatchValidator };
