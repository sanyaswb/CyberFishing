"use strict";

const { StageThreeBatchCandidateBuild } = require("./stage_three_batch_candidate_build");

const BATCH_007_APPROVED_VIRTUAL_MODULES = Object.freeze([
  "\u0000@oxc-project+runtime@0.146.0/helpers/esm/defineProperty.js",
  "\u0000@oxc-project+runtime@0.146.0/helpers/esm/toPrimitive.js",
  "\u0000@oxc-project+runtime@0.146.0/helpers/esm/toPropertyKey.js",
  "\u0000@oxc-project+runtime@0.146.0/helpers/esm/typeof.js",
]);

class StageThreeBatch007CandidateBuild extends StageThreeBatchCandidateBuild {
  constructor(projectRoot) {
    super({ projectRoot, batchNumber: "007", additionalVirtualModules: BATCH_007_APPROVED_VIRTUAL_MODULES });
  }
}

module.exports = { BATCH_007_APPROVED_VIRTUAL_MODULES, StageThreeBatch007CandidateBuild };
