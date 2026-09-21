"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Batch009Planning, PROFILE, PATHS, sha, serialize } = require("./stage_three_batch_009_planning");
const { Batch009PrebuildHistory, STATE, PREBUILD, BATCH } = require("./stage_three_batch_009_prebuild_history");
const { StageThreeBatchPrebuildProfile } = require("./stage_three_batch_prebuild_profile");
const { StageThreeBatchPrebuildContractBuilder, StageThreeBatchPrebuildContractValidator } = require("./stage_three_batch_prebuild_contract");
const { ControlledMetadataTransaction } = require("./controlled_metadata_transaction");

class Batch009Prebuild {
  constructor(root) { this.root = path.resolve(root); this.app = new Batch009Planning(this.root); }
  raw(file) { return fs.readFileSync(path.join(this.root, file)); }
  protectedSnapshot() {
    const files = new Set(["index.html", "package.json", "package-lock.json", "CHANGELOG.md", "refactor_Task.txt",
      "architecture/build/package_contract.json", "architecture/module_architecture.json",
      PATHS.manifest, PATHS.runtimeContract, PATHS.bridgeRegistry, PATHS.approvedPlan,
      PROFILE.auditPath, PROFILE.executionPlanPath, PROFILE.testMatrixPath]);
    const walk = relative => {
      for (const e of fs.readdirSync(path.join(this.root, relative), { withFileTypes: true })) {
        assert(!e.isSymbolicLink(), "Protected tree contains a symlink");
        const f = `${relative}/${e.name}`;
        if (e.isDirectory()) walk(f); else files.add(f);
      }
    };
    walk("src"); walk("dist/stage-3-compat-runtime");
    return [...files].sort().map(file => ({ path: file, sha256: sha(this.raw(file)) }));
  }
  build() {
    const read = file => this.app.bytes(file), json = file => JSON.parse(read(file));
    const stateBytes = read(STATE), state = JSON.parse(stateBytes), plan = json(PROFILE.executionPlanPath);
    for (const evidence of Object.values(plan.sourceEvidence).filter(e => e.path)) {
      assert.equal(sha(read(evidence.path)), evidence.sha256, `Prebuild input changed since planning: ${evidence.path}`);
    }
    for (const evidence of [...plan.rollback.baselineEvidence.files, ...plan.rollback.baselineEvidence.runtimeOutput.files]) {
      assert.equal(sha(read(evidence.path)), evidence.sha256, `Rollback baseline drift: ${evidence.path}`);
    }
    const runtime = json(PATHS.runtimeContract), registry = json(PATHS.bridgeRegistry);
    const profile = new StageThreeBatchPrebuildProfile({ schemaVersion: 1, contractSchemaVersion: 2,
      stageLabel: "Stage 3.9.3", batchId: BATCH, completedPrefix: json(PATHS.approvedPlan).batches.slice(0, 8).map(b => b.id),
      executionProfile: PROFILE, artifactPath: PREBUILD, planningStorage: "prebuild-contract-only",
      topology: { active: { modules: 34, activations: 35, bridges: 60 }, delta: { modules: 2, activations: 2, bridges: 2 },
        planned: { modules: 36, activations: 37, bridges: 62 } },
      unlockCondition: "stage-3.9.4-target-source-and-build-validation", verdict: "eligible-for-target-source-and-build-validation",
    }).value;
    const artifact = new StageThreeBatchPrebuildContractBuilder(profile).build({
      audit: json(PROFILE.auditPath), auditSha256: sha(read(PROFILE.auditPath)),
      executionPlan: plan, executionPlanSha256: sha(read(PROFILE.executionPlanPath)),
      testMatrix: json(PROFILE.testMatrixPath), testMatrixSha256: sha(read(PROFILE.testMatrixPath)),
      executionState: state, executionStateSha256: sha(stateBytes), manifestSha256: sha(read(PATHS.manifest)),
      runtimeContract: runtime, runtimeContractSha256: sha(read(PATHS.runtimeContract)),
      bridgeRegistry: registry, bridgeRegistrySha256: sha(read(PATHS.bridgeRegistry)),
    });
    new StageThreeBatchPrebuildContractValidator(profile).validate(artifact);
    const after = serialize({ ...state, activeBatchId: BATCH, activeBatchPhase: "prebuild" });
    return { ...artifact, stateTransition: { path: STATE, beforeSha256: sha(stateBytes), afterSha256: sha(after),
      beforeBase64: stateBytes.toString("base64"), afterBase64: after.toString("base64") },
      candidateIsolation: "temporary-workspace-only; no live source, registry, manifest, index or output publication",
      runtimeRelocation: plan.runtimeRelocation, protectedFiles: this.protectedSnapshot() };
  }
  validate() {
    const artifact = JSON.parse(this.raw(PREBUILD));
    const { after } = new Batch009PrebuildHistory(this.root).validate(artifact.stateTransition);
    assert.deepEqual(this.raw(STATE), after, "Real live state must be exact batch 009 prebuild state");
    assert.deepEqual(this.raw(PREBUILD), serialize(this.build()), "Prebuild contract/repository evidence drift");
    for (const m of PROFILE.expectedTargets) assert(!fs.existsSync(path.join(this.root, m.targetPath)), "Planned target leaked into live src");
    const registry = JSON.parse(this.raw(PATHS.bridgeRegistry));
    assert(!registry.bridges.some(b => b.owner === BATCH), "Planned bridge leaked into active registry");
    return artifact;
  }
  open({ failureInjector } = {}) {
    if (fs.existsSync(path.join(this.root, PREBUILD))) return this.validate();
    const artifact = this.build();
    new Batch009PrebuildHistory(this.root).validate(artifact.stateTransition);
    new ControlledMetadataTransaction({ projectRoot: this.root, failureInjector }).commit([
      { relativePath: PREBUILD, bytes: serialize(artifact) },
      { relativePath: STATE, bytes: Buffer.from(artifact.stateTransition.afterBase64, "base64") },
    ], () => this.validate());
    return artifact;
  }
}
module.exports = { Batch009Prebuild };
