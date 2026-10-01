"use strict";

const assert = require("node:assert/strict");
const { LegacyScriptOrderReader } = require("../migration/legacy_script_order_reader");
const { StageTwoRuntimeScriptAliasResolver } = require("../migration/stage_two_runtime_script_alias_resolver");
const { INPUTS, HISTORICAL, RUNTIME_OUTPUT_DIRECTORY } = require("./post_freeze_paths");
const { sha256 } = require("./post_freeze_workspace");
const { STAGE_3_22 } = require("./post_freeze_review_profile");
const { StageThreeApprovedPlanSource } = require("../domain_batches/stage_three_approved_plan_source");

const EXPECTED_TOPOLOGY = STAGE_3_22.expectedTopology;

// Records the exact starting point of a post-freeze review: release, completed prefix, runtime
// topology and fingerprints of every input and historical artifact the review reads.
class PostFreezeBaselineBuilder {
  build({ workspace, commit, profile = STAGE_3_22 }) {
    assert.match(commit, /^[0-9a-f]{40}$/u, "baseline commit must be a full SHA");
    const state = workspace.json(INPUTS.executionState);
    const approved = profile.completedFromPlanSource
      ? new StageThreeApprovedPlanSource({ read: file => workspace.bytes(file) }).load(workspace.json(INPUTS.executionState)).document
      : workspace.json(HISTORICAL.approvedPlan);
    const runtime = workspace.json(INPUTS.runtimeContract);
    const registry = workspace.json(INPUTS.bridgeRegistry);
    const packageJson = workspace.json(INPUTS.packageJson);
    assert.equal(state.activeBatchId, null, "review requires no active batch");
    assert(!Object.hasOwn(state, "activeBatchPhase"), "review requires a closed batch lifecycle");
    assert.equal(packageJson.version, state.releaseVersion, "package and execution state disagree");
    const approvedIds = approved.batches.map(batch => batch.id);
    if (profile.replacesIncompleteSuffix) {
      assert(state.completedBatchIds.length < approvedIds.length,
        "replacement review requires an incomplete approved-plan suffix");
      assert.deepEqual(state.completedBatchIds, approvedIds.slice(0, state.completedBatchIds.length),
        "completed batches must be an exact approved-plan prefix");
    } else {
      assert.deepEqual(state.completedBatchIds, approvedIds,
        "the frozen approved plan must be fully completed");
    }
    const topology = {
      modules: new Set(runtime.activationPositions.map(item => item.targetModule)).size,
      activations: runtime.activationPositions.length,
      bridges: registry.bridges.length,
    };
    assert.deepEqual(topology, profile.expectedTopology, `runtime topology differs from ${Object.values(profile.expectedTopology).join("/")}`);
    const scripts = new LegacyScriptOrderReader(workspace.absolute(INPUTS.index), {
      scriptAliases: new StageTwoRuntimeScriptAliasResolver().loadProject(workspace.root),
    }).parse(workspace.text(INPUTS.index));
    const sources = workspace.sourceFiles().map(file => workspace.fingerprint(file));
    const runtimeOutput = [runtime.output.directory + runtime.output.runtimeFile,
      ...runtime.activationPositions.map(item => runtime.output.directory + item.shimFile)]
      .sort().map(file => workspace.fingerprint(file));
    assert(runtimeOutput.every(item => item.path.startsWith(`${RUNTIME_OUTPUT_DIRECTORY}/`)));
    return {
      schemaVersion: 1,
      kind: profile.kind("baseline"),
      stage: profile.stage,
      commit,
      releaseVersion: state.releaseVersion,
      executionState: {
        ...workspace.fingerprint(INPUTS.executionState),
        status: state.status,
        completedBatchIds: state.completedBatchIds,
        activeBatchId: state.activeBatchId,
        approvedPlanSha256: state.approvedPlanSha256,
        compatibilityRuntimeActivated: state.compatibilityRuntimeActivated,
      },
      topology,
      inputs: Object.values(INPUTS).map(file => workspace.fingerprint(file)),
      historicalArtifacts: Object.values(HISTORICAL).map(file => workspace.fingerprint(file)),
      scriptOrder: {
        count: scripts.length,
        sha256: sha256(JSON.stringify(scripts.map(item => [item.legacyLoadOrder, item.currentPath, item.type]))),
      },
      sources: {
        count: sources.length,
        treeSha256: sha256(JSON.stringify(sources.map(item => [item.path, item.sha256]))),
        files: sources,
      },
      runtimeOutput: { count: runtimeOutput.length, files: runtimeOutput },
    };
  }
}

module.exports = { PostFreezeBaselineBuilder, EXPECTED_TOPOLOGY };
