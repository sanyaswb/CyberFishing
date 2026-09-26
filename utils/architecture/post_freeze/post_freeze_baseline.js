"use strict";

const assert = require("node:assert/strict");
const { LegacyScriptOrderReader } = require("../migration/legacy_script_order_reader");
const { StageTwoRuntimeScriptAliasResolver } = require("../migration/stage_two_runtime_script_alias_resolver");
const { INPUTS, HISTORICAL, RUNTIME_OUTPUT_DIRECTORY } = require("./post_freeze_paths");
const { sha256 } = require("./post_freeze_workspace");

const EXPECTED_TOPOLOGY = Object.freeze({ modules: 78, activations: 87, bridges: 139 });

// Records the exact starting point of the Stage 3.22 review: release, completed prefix, runtime
// topology and fingerprints of every input and historical artifact the review reads.
class PostFreezeBaselineBuilder {
  build({ workspace, commit }) {
    assert.match(commit, /^[0-9a-f]{40}$/u, "baseline commit must be a full SHA");
    const state = workspace.json(INPUTS.executionState);
    const approved = workspace.json(HISTORICAL.approvedPlan);
    const runtime = workspace.json(INPUTS.runtimeContract);
    const registry = workspace.json(INPUTS.bridgeRegistry);
    const packageJson = workspace.json(INPUTS.packageJson);
    assert.equal(state.activeBatchId, null, "review requires no active batch");
    assert(!Object.hasOwn(state, "activeBatchPhase"), "review requires a closed batch lifecycle");
    assert.equal(packageJson.version, state.releaseVersion, "package and execution state disagree");
    assert.deepEqual(state.completedBatchIds, approved.batches.map(batch => batch.id),
      "the frozen approved plan must be fully completed");
    const topology = {
      modules: new Set(runtime.activationPositions.map(item => item.targetModule)).size,
      activations: runtime.activationPositions.length,
      bridges: registry.bridges.length,
    };
    assert.deepEqual(topology, EXPECTED_TOPOLOGY, "runtime topology differs from 78/87/139");
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
      kind: "cyber-fishing-stage-3-22-baseline",
      stage: "3.22",
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
