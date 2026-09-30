"use strict";

const { immutableRecord } = require("../guards/core/guard_models");
const {
  StageThreeBatchExecutionProfile,
} = require("./stage_three_batch_execution_profile");

class StageThreeBatchPreflightProfile {
  constructor(definition) {
    this.value = this.#validate(definition);
  }

  #validate(definition) {
    const errors = [];
    const require = (condition, message) => {
      if (!condition) errors.push(message);
    };
    let executionProfile = null;
    try {
      executionProfile = StageThreeBatchExecutionProfile.validateImmutable(
        definition?.executionProfile,
      );
    } catch (error) {
      errors.push(error.message);
    }
    require(definition?.schemaVersion === 1, "schemaVersion must be 1");
    require(typeof definition?.stageLabel === "string" && definition.stageLabel.length > 0,
      "stageLabel is required");
    require(typeof definition?.artifactKind === "string" && definition.artifactKind.length > 0,
      "artifactKind is required");
    require(definition?.batchId === executionProfile?.batchId,
      "batchId must match execution profile");
    require(definition?.sourceReleaseVersion === executionProfile?.sourceReleaseVersion,
      "sourceReleaseVersion must match execution profile");
    const contracts = definition?.reviewedContracts;
    require(contracts && !Array.isArray(contracts) && typeof contracts === "object",
      "reviewedContracts are required");
    if (definition?.sideEffectEvidence) {
      require(typeof definition.sideEffectEvidence.path === "string" &&
        definition.sideEffectEvidence.path.startsWith("architecture/migration/") &&
        /^[a-f0-9]{64}$/u.test(definition.sideEffectEvidence.sha256),
      "sideEffectEvidence needs an exact migration path and SHA-256");
    }
    const expectedPaths = executionProfile?.expectedTargets.map((target) => target.currentPath).sort() || [];
    require(JSON.stringify(Object.keys(contracts || {}).sort()) === JSON.stringify(expectedPaths),
      "reviewedContracts must cover exact target paths");
    for (const [currentPath, contract] of Object.entries(contracts || {})) {
      for (const field of ["classification", "semanticRisk", "performanceClassification"]) {
        require(typeof contract?.[field] === "string" && contract[field].length > 0,
          `${currentPath} ${field} is required`);
      }
      for (const field of [
        "instanceFields", "publicStateShape", "resultShape", "hotLoopCallSites", "callSiteEvidence",
      ]) {
        require(Array.isArray(contract?.[field]), `${currentPath} ${field} must be an array`);
      }
      require(typeof contract?.stableResultIdentity === "boolean",
        `${currentPath} stableResultIdentity must be boolean`);
      require(typeof contract?.mutatesCallerInputs === "boolean",
        `${currentPath} mutatesCallerInputs must be boolean`);
      require(contract?.allocationBaseline && typeof contract.allocationBaseline === "object",
        `${currentPath} allocationBaseline is required`);
      if (contract?.legacyExposure) {
        require(Boolean(definition?.sideEffectEvidence),
          `${currentPath} legacyExposure requires sideEffectEvidence`);
        require(typeof contract.legacyExposure.symbol === "string" &&
          /^\d+:\d+$/u.test(contract.legacyExposure.location),
        `${currentPath} legacyExposure must name an exact symbol and location`);
      }
      if (contract?.frozenConstants) {
        require(Boolean(definition?.sideEffectEvidence),
          `${currentPath} frozenConstants requires sideEffectEvidence`);
        require((typeof contract.frozenConstants.className === "string") !==
          (Array.isArray(contract.frozenConstants.classNames) &&
            contract.frozenConstants.classNames.length > 1) &&
          Object.keys(contract.frozenConstants.bindings || {}).length > 0 &&
          Object.values(contract.frozenConstants.bindings).every((binding) =>
            /^\d+:\d+$/u.test(binding?.location)),
        `${currentPath} frozenConstants must name one class and exact bindings`);
      }
      if (contract?.frozenStaticFields) {
        require(Boolean(definition?.sideEffectEvidence),
          `${currentPath} frozenStaticFields requires sideEffectEvidence`);
        require(!contract.frozenConstants && !contract.legacyExposure,
          `${currentPath} frozenStaticFields cannot be combined with another reviewed effect`);
        const bindings = contract.frozenStaticFields.bindings || {};
        require(typeof contract.frozenStaticFields.className === "string" &&
          Object.keys(bindings).length > 0 &&
          Object.values(bindings).every((binding) => /^\d+:\d+$/u.test(binding?.location)),
        `${currentPath} frozenStaticFields must name one class and exact static bindings`);
      }
    }
    for (const [currentPath, contract] of Object.entries(contracts || {})) {
      const review = contract?.stateIdentityReview;
      if (!review) continue;
      require(typeof review.className === "string" && Array.isArray(review.collections) &&
        review.collections.length > 0 && review.collections.every((collection) =>
          typeof collection?.owner === "string" && collection.field?.startsWith("#") &&
          ["static", "instance"].includes(collection.scope) &&
          ["Set", "Map"].includes(collection.collection) &&
          Array.isArray(collection.allowedOperations) && collection.allowedOperations.length > 0),
      `${currentPath} stateIdentityReview must name private Set/Map collections and their operations`);
    }
    for (const [currentPath, contract] of Object.entries(contracts || {})) {
      const sets = contract?.privateStaticSets;
      if (!sets) continue;
      require(Boolean(definition?.sideEffectEvidence),
        `${currentPath} privateStaticSets requires sideEffectEvidence`);
      require(!contract.frozenConstants && !contract.frozenStaticFields && !contract.classFamily &&
        (!contract.legacyExposure || contract.legacyExposure.mechanism === "global-this-property"),
      `${currentPath} privateStaticSets combine only with a global-this exposure`);
      require(typeof sets.className === "string" && Object.keys(sets.bindings || {}).length > 0 &&
        Object.entries(sets.bindings).every(([name, binding]) => name.startsWith("#") &&
          /^\d+:\d+$/u.test(binding?.location) && Array.isArray(binding?.values)),
      `${currentPath} privateStaticSets must name one class and exact private set bindings`);
    }
    for (const [currentPath, contract] of Object.entries(contracts || {})) {
      const family = contract?.classFamily;
      if (!family) continue;
      require(Boolean(definition?.sideEffectEvidence),
        `${currentPath} classFamily requires sideEffectEvidence`);
      require(!contract.legacyExposure && !contract.frozenConstants && !contract.frozenStaticFields,
        `${currentPath} classFamily cannot be combined with another reviewed effect`);
      require(Array.isArray(family.classes) && family.classes.length > 1 &&
        Array.isArray(family.exposures) && family.exposures.length === family.classes.length &&
        family.exposures.every((item) => family.classes.includes(item?.symbol) &&
          /^\d+:\d+$/u.test(item?.location)) &&
        Object.entries(family.localSuperclasses || {}).every(([child, parent]) =>
          family.classes.indexOf(parent) >= 0 &&
          family.classes.indexOf(parent) < family.classes.indexOf(child)),
      `${currentPath} classFamily must name ordered classes, local superclasses and exact exposures`);
    }
    for (const [currentPath, contract] of Object.entries(contracts || {})) {
      const functions = contract?.topLevelFunctions;
      if (functions === undefined) continue;
      require(!contract.legacyExposure && !contract.frozenConstants && !contract.frozenStaticFields &&
        !contract.privateStaticSets && !contract.classFamily,
      `${currentPath} topLevelFunctions combine only with effect-free classes`);
      require(Array.isArray(functions) && functions.length > 0 &&
        functions.every((name) => /^[A-Za-z_$][\w$]*$/u.test(name)) &&
        new Set(functions).size === functions.length,
      `${currentPath} topLevelFunctions must name unique top-level functions`);
    }
    for (const [currentPath, contract] of Object.entries(contracts || {})) {
      const composed = contract?.localCompositions;
      if (composed === undefined) continue;
      require(Array.isArray(composed) && composed.length > 0 &&
        composed.every((name) => /^[A-Za-z_$][\w$]*$/u.test(name)) && new Set(composed).size === composed.length,
      `${currentPath} localCompositions must name unique composed classes`);
    }
    require(Array.isArray(definition?.migrationGates) && definition.migrationGates.length > 0,
      "migrationGates are required");
    if (errors.length > 0) {
      throw new Error(`Stage 3 batch preflight profile failed:\n- ${errors.join("\n- ")}`);
    }
    return immutableRecord(definition);
  }

  static validateImmutable(definition) {
    if (!definition || typeof definition !== "object" || !Object.isFrozen(definition)) {
      throw new Error("Stage 3 batch preflight profile is required and must be immutable");
    }
    return new StageThreeBatchPreflightProfile(definition).value;
  }
}

module.exports = { StageThreeBatchPreflightProfile };
