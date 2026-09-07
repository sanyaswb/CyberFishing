"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { fingerprint } = require("./domain_batches/stage_three_pending_target_manifest");
const { StageThreeBatch008ReleaseTransition, TRANSITION, STATE } = require("./domain_batches/stage_three_batch_008_release_transition");
const { LegacyScriptOrderReader } = require("./migration/legacy_script_order_reader");
const { StageTwoRuntimeScriptAliasResolver } = require("./migration/stage_two_runtime_script_alias_resolver");

const PREFIX = "architecture/migration/";
const CLOSURE = `${PREFIX}stage_3_batch_008_release_closure.json`;
const BROWSER = `${PREFIX}stage_3_batch_008_browser_confirmation.json`;
const CHECKS = Object.freeze(["bootCanvasInventory", "castWaitingFight", "lineReleaseRecovery",
  "strokeGained", "strokeLost", "strokeStable", "holdDragRecoveryGates"]);

class StageThreeBatch008ReleaseAcceptanceCheck {
  constructor(root = path.resolve(__dirname, "../.."), { read } = {}) {
    this.root = root;
    this.read = read || ((file) => fs.readFileSync(path.join(root, file)));
  }
  json(file) { return JSON.parse(this.read(file)); }
  verifyReference(record) {
    assert(record && typeof record.path === "string");
    assert.equal(fingerprint(this.read(record.path)), record.sha256, `Stale closure evidence: ${record.path}`);
  }

  verifyMechanical() {
    const transition = new StageThreeBatch008ReleaseTransition(this.root);
    const release = transition.validate(this.json(TRANSITION));
    for (const record of release.records) transition.reverse(this.read(record.path), record);
    transition.runtimeState(); // Exact completed -> historical runtime-active reversal.
    const state = this.json(STATE), approved = this.json(`${PREFIX}stage_3_approved_batches.json`);
    const batch = approved.batches[7];
    assert.equal(release.batchId, batch.id);
    assert.equal(batch.status, "approved-frozen");
    assert.equal(state.releaseVersion, release.toRelease);
    assert.deepEqual(state.completedBatchIds, approved.batches.slice(0, 8).map((item) => item.id));
    assert.equal(state.activeBatchId, null);
    assert(!Object.hasOwn(state, "activeBatchPhase"));
    assert.equal(state.compatibilityRuntimeActivated, true);
    assert.equal(state.status, "migration-active");
    const packageJson = this.json("package.json"), lock = this.json("package-lock.json");
    for (const version of [packageJson.version, lock.version, lock.packages[""].version]) assert.equal(version, release.toRelease);
    const version = this.read("src/config/project_version.js").toString();
    assert(version.includes(`const CURRENT_PROJECT_VERSION = "${release.toRelease}";`));
    assert(version.includes('codename: "line-spool-stroke-distance-and-reel-hold"'));
    const html = this.read("index.html").toString();
    assert(html.includes(`src/config/project_version.js?v=${release.toRelease}`));
    assert(this.read("CHANGELOG.md").toString().includes(`## v${release.toRelease} - Line Spool, Stroke Distance and Reel Hold`));
    const task = this.read("refactor_Task.txt").toString();
    assert(task.includes("**Поточний наступний етап:** `Stage 3.9.0 — Batch 009 Preflight and Dependency/State Audit`"));
    assert(task.includes(`**Поточна release-версія:** \`v${release.toRelease}\``));
    assert(task.includes(approved.batches[8].id));
    const runtime = this.json(`${PREFIX}stage_3_compatibility_runtime.json`);
    const registry = this.json("architecture/guards/migration_bridge_registry.json");
    const cutover = this.json(`${PREFIX}stage_3_batch_008_runtime_cutover.json`);
    const prebuild = this.json(`${PREFIX}stage_3_batch_008_prebuild_contract.json`);
    const manifest = this.json(`${PREFIX}module_migration_manifest.json`);
    assert.deepEqual(runtime.activationPositions.map((a) => a.id).sort(), cutover.topology.activationIds);
    assert.deepEqual(registry.bridges.map((b) => b.id).sort(), cutover.topology.bridgeIds);
    assert.deepEqual(runtime.activationPositions.filter((a) => a.owner === batch.id), prebuild.preliminaryMetadata.plannedActivationPositions);
    assert.deepEqual(registry.bridges.filter((b) => b.owner === batch.id), prebuild.preliminaryMetadata.plannedBridges);
    for (const module of batch.modules) {
      const target = manifest.modules.find((item) => item.currentPath === module.targetPath);
      assert.equal(target?.architecture.migrationStatus, "verified");
      assert.equal(target?.architecture.targetBoundary, "game-domain");
    }
    const sourceBuild = this.json(`${PREFIX}stage_3_batch_008_source_build_validation.json`);
    for (const source of sourceBuild.sources) assert.equal(fingerprint(this.read(source.targetPath)), source.targetSha256);
    const automatic = this.json(`${PREFIX}stage_3_batch_008_automated_acceptance.json`);
    for (const output of automatic.fresh.runtimeOutput) this.verifyReference(output);
    const scripts = [...html.matchAll(/<script\b([^>]*)\bsrc=["']([^"']+)["'][^>]*><\/script>/giu)];
    const runtimePath = `${runtime.output.directory}${runtime.output.runtimeFile}`;
    assert.equal(fingerprint(this.read(runtimePath)), cutover.build.runtimeSha256);
    const aliases = new StageTwoRuntimeScriptAliasResolver().loadProject(this.root);
    const logical = new LegacyScriptOrderReader(null, { scriptAliases: aliases }).parse(html);
    const topology = { projectModuleCount: cutover.topology.projectModules.length,
      activationCount: runtime.activationPositions.length, bridgeRecordCount: registry.bridges.length,
      physicalClassicScriptCount: scripts.length, logicalLegacyPositionCount: logical.length,
      moduleScriptCount: scripts.filter((m) => /\btype=["']module["']/iu.test(m[1])).length,
      cumulativeRuntimeCount: scripts.filter((m) => m[2].split("?")[0] === runtimePath).length,
      isolatedIifeCount: scripts.filter((m) => m[2].includes("dist/legacy-bridges/")).length };
    assert.equal(topology.projectModuleCount, prebuild.plannedTopology.counts.modules);
    assert.equal(topology.activationCount, prebuild.plannedTopology.counts.activations);
    assert.equal(topology.bridgeRecordCount, prebuild.plannedTopology.counts.bridges);
    assert.equal(topology.moduleScriptCount, 0); assert.equal(topology.cumulativeRuntimeCount, 1); assert.equal(topology.isolatedIifeCount, 0);
    const scriptPlan = this.json(`${PREFIX}stage_3_batch_008_execution_plan.json`);
    assert.equal(topology.physicalClassicScriptCount, scriptPlan.scriptTopology.after.physicalClassicScriptCount);
    assert.equal(topology.logicalLegacyPositionCount, scriptPlan.scriptTopology.after.logicalLegacyPositionCount);
    const contract = this.json("architecture/build/package_contract.json");
    assert.equal(contract.stage.current, "3.8");
    assert.equal(contract.stage.cumulativeRuntimeBuild.runtimeInputs, topology.projectModuleCount);
    assert.equal(contract.stage.cumulativeRuntimeBuild.activationInputs, topology.activationCount);
    return { release, batch, approved, state, topology, scriptPlan };
  }

  verifyBrowser(proof, accepted) {
    assert.equal(proof.schemaVersion, 1);
    assert.equal(proof.kind, "cyber-fishing-stage-3-batch-008-browser-confirmation");
    assert.equal(proof.batchId, accepted.batchId);
    assert.equal(proof.status, "passed");
    assert.equal(proof.performedBy, "user");
    assert.deepEqual(Object.keys(proof.checks).sort(), [...CHECKS].sort());
    for (const key of CHECKS) assert.equal(proof.checks[key], "PASS", `Browser gate not confirmed: ${key}`);
    assert.equal(proof.console.errors, 0); assert.equal(proof.console.warnings, 0);
    assert(typeof proof.userStatement === "string" && proof.userStatement.trim().length > 0);
    assert.equal(proof.supplements.path, `${PREFIX}stage_3_batch_008_acceptance_pass.json`);
    this.verifyReference(proof.supplements);
  }

  run({ requireTag = false } = {}) {
    const data = this.verifyMechanical();
    const accepted = this.json(`${PREFIX}stage_3_batch_008_acceptance_pass.json`);
    assert.equal(accepted.verdict, "eligible-for-release-closure");
    assert.equal(accepted.releaseClosureAllowed, true);
    // An overall summary is preserved, but is not promoted into seven invented results.
    let proof;
    try { proof = this.json(BROWSER); } catch (error) {
      if (error.code === "ENOENT") throw new Error("Release blocked: structured user browser confirmation (seven scenarios and console 0/0) is missing");
      throw error;
    }
    this.verifyBrowser(proof, accepted);
    const closure = this.json(CLOSURE);
    assert.equal(closure.kind, "cyber-fishing-stage-3-batch-release-closure");
    assert.equal(closure.batchId, data.batch.id);
    assert.equal(closure.releaseVersion, data.release.toRelease);
    assert.equal(closure.previousReleaseVersion, data.release.fromRelease);
    assert(["release-candidate", "verified"].includes(closure.status));
    assert.equal(closure.completedBatchCount, data.state.completedBatchIds.length);
    assert.equal(closure.completedDomainModuleCount, data.approved.batches.slice(0, 8).reduce((n, b) => n + b.modules.length, 0));
    assert.deepEqual(closure.runtimeTopology, data.topology);
    this.verifyReference(closure.acceptance.automatedEvidence);
    this.verifyReference(closure.acceptance.browserProof);
    assert.equal(closure.acceptance.browserProof.path, BROWSER);
    this.verifyReference(closure.releaseTransition);
    for (const record of closure.releaseEvidence) this.verifyReference(record);
    const rollback = data.scriptPlan.rollback;
    assert.deepEqual(closure.rollback, { atomic: rollback.atomic, fromRelease: rollback.fromRelease,
      toRelease: rollback.toRelease, removeBatchId: rollback.removeBatchId,
      preserveCompletedBatchIds: rollback.preserveCompletedBatchIds, restoreTopology: rollback.restoreTopology,
      baselineEvidenceReference: { path: `${PREFIX}stage_3_batch_008_execution_plan.json`,
        sha256: fingerprint(this.read(`${PREFIX}stage_3_batch_008_execution_plan.json`)) } });
    assert.equal(closure.nextStage, "Stage 3.9.0 — Batch 009 Preflight and Dependency/State Audit");
    if (closure.status === "verified" || requireTag) {
      assert.equal(closure.status, "verified");
      assert.equal(closure.releasePublicationAllowed, true);
      const final = closure.finalRegression;
      assert.equal(final.status, "passed");
      assert.equal(final.lockfileChanged, false);
      for (const id of ["npm-ci", "cumulative-build", "architecture", "quick", "full"]) {
        const step = final.steps.find((item) => item.id === id);
        assert.equal(step?.exitCode, 0);
        if (["architecture", "quick", "full"].includes(id)) assert(step.passedChecks > 0);
      }
    }
    if (requireTag) {
      const git = process.platform === "win32" ? "C:/Program Files/Git/cmd/git.exe" : "git";
      const run = (args) => { const result = spawnSync(git, args, { cwd: this.root, encoding: "utf8", maxBuffer: 16000000 });
        assert.equal(result.status, 0, result.stderr); return result.stdout.trim(); };
      assert.equal(run(["cat-file", "-t", "v0.24.45"]), "tag");
      assert.equal(run(["rev-parse", "v0.24.45^{commit}"]), run(["rev-parse", "HEAD"]));
      assert.deepEqual(JSON.parse(run(["show", `v0.24.45:${CLOSURE}`])), closure);
      assert.equal(run(["status", "--porcelain"]), "", "Release worktree is not clean");
    }
    const { StageThreeBatch008ObservationApplication } = require("./domain_batches/stage_three_batch_008_observation_application");
    new StageThreeBatch008ObservationApplication(this.root).check();
    return { status: closure.status, topology: data.topology, browser: "passed", exactReleaseFiles: data.release.records.length };
  }
}
if (require.main === module) {
  try { const result = new StageThreeBatch008ReleaseAcceptanceCheck().run({ requireTag: process.argv.includes("--require-tag") });
    console.log(`Stage 3.8.9 ${result.status}: exact release metadata/reversal, completed prefix, browser proof and runtime topology verified.`);
  } catch (error) { console.error(error); process.exitCode = 1; }
}
module.exports = { StageThreeBatch008ReleaseAcceptanceCheck, CLOSURE, BROWSER, CHECKS };
