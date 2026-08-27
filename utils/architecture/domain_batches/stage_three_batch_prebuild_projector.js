"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  StageThreeBatchPrebuildContractBuilder,
  StageThreeBatchPrebuildContractValidator,
} = require("./stage_three_batch_prebuild_contract");

class StageThreeBatchPrebuildProjector {
  #projectRoot;
  #profile;
  #paths;

  constructor({ projectRoot, profile, paths }) {
    this.#projectRoot = path.resolve(projectRoot);
    this.#profile = profile;
    this.#paths = Object.freeze({ ...paths });
  }

  build() {
    const inputs = Object.fromEntries([
      "audit", "executionPlan", "testMatrix", "executionState", "manifest",
      "runtimeContract", "bridgeRegistry",
    ].map((name) => [name, this.#read(name)]));
    for (const module of inputs.executionPlan.document.scope.modules) {
      if (fs.existsSync(this.#absolute(module.targetPath))) {
        throw new Error(`Prebuild target already exists: ${module.targetPath}`);
      }
    }
    const artifact = new StageThreeBatchPrebuildContractBuilder(this.#profile).build({
      audit: inputs.audit.document,
      auditSha256: inputs.audit.sha256,
      executionPlan: inputs.executionPlan.document,
      executionPlanSha256: inputs.executionPlan.sha256,
      testMatrix: inputs.testMatrix.document,
      testMatrixSha256: inputs.testMatrix.sha256,
      executionState: inputs.executionState.document,
      executionStateSha256: inputs.executionState.sha256,
      manifestSha256: inputs.manifest.sha256,
      runtimeContract: inputs.runtimeContract.document,
      runtimeContractSha256: inputs.runtimeContract.sha256,
      bridgeRegistry: inputs.bridgeRegistry.document,
      bridgeRegistrySha256: inputs.bridgeRegistry.sha256,
    });
    new StageThreeBatchPrebuildContractValidator(this.#profile).validate(artifact);
    return Object.freeze({ artifact, inputs });
  }

  serialize(value) {
    return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  }

  #read(name) {
    const bytes = fs.readFileSync(this.#absolute(this.#paths[name]));
    return Object.freeze({
      bytes,
      document: JSON.parse(bytes.toString("utf8")),
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    });
  }

  #absolute(relativePath) {
    return path.join(this.#projectRoot, relativePath);
  }
}

module.exports = { StageThreeBatchPrebuildProjector };
