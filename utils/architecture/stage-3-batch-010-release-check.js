"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { sha } = require("./domain_batches/stage_three_batch_010_planning");
const { PROFILE, PATHS } = require("./domain_batches/stage_three_batch_010_preflight");
const { Batch010ReleaseTransition, TRANSITION, STATE, RELEASE_PATHS } =
  require("./domain_batches/stage_three_batch_010_release_transition");

class Batch010ReleaseCheck {
  run(root = path.resolve(__dirname, "../..")) {
    const read = file => fs.readFileSync(path.join(root, file));
    const json = file => JSON.parse(read(file));
    const transition = new Batch010ReleaseTransition(root);
    const record = transition.validate(json(TRANSITION));
    assert.deepEqual(record.records.map(item => item.path), RELEASE_PATHS);
    for (const item of record.records) transition.reverse(read(item.path), item);
    const state = json(STATE);
    const approved = json(PATHS.approvedPlan);
    assert.equal(state.releaseVersion, "0.24.47");
    assert.deepEqual(state.completedBatchIds, approved.batches.slice(0, 10).map(item => item.id));
    assert.equal(state.completedBatchIds[9], PROFILE.batchId);
    assert.equal(state.activeBatchId, null);
    assert(!Object.hasOwn(state, "activeBatchPhase"));
    assert.equal(state.compatibilityRuntimeActivated, true);
    const packageJson = json("package.json"), lock = json("package-lock.json");
    assert.equal(packageJson.version, "0.24.47");
    assert.equal(lock.version, packageJson.version);
    assert.equal(lock.packages[""].version, packageJson.version);
    const version = read("src/config/project_version.js").toString("utf8");
    assert(version.includes('const CURRENT_PROJECT_VERSION = "0.24.47";'));
    assert(version.includes('codename: "inventory-assembly-capacity-domain"'));
    const html = read(PATHS.index).toString("utf8");
    assert.equal(html.split("src/config/project_version.js?v=0.24.47").length - 1, 1);
    assert(read("CHANGELOG.md").toString("utf8")
      .startsWith("# CyberFishing changelog\n\n## v0.24.47 - Inventory Assembly Capacity Domain\n"));
    const runtime = json(PATHS.runtimeContract);
    const registry = json(PATHS.bridgeRegistry);
    assert.equal(new Set(runtime.activationPositions.map(item => item.targetModule)).size, 37);
    assert.equal(runtime.activationPositions.length, 38);
    assert.equal(registry.bridges.length, 64);
    const built = json("architecture/migration/stage_3_batch_010_source_build_validation.json");
    assert.equal(sha(read(runtime.output.directory + runtime.output.runtimeFile)), built.report.runtimeSha256);
    for (const output of built.report.activationOutputs) {
      assert.equal(sha(read(output.path)), output.sha256);
    }
    const browser = json("architecture/migration/stage_3_batch_010_browser_confirmation.json");
    const accepted = json("architecture/migration/stage_3_batch_010_acceptance_pass.json");
    assert.equal(browser.status, "passed");
    assert.equal(browser.console.errors, 0);
    assert.equal(browser.console.warnings, 0);
    assert.equal(browser.supplements.sha256,
      sha(read("architecture/migration/stage_3_batch_010_acceptance_pass.json")));
    assert.equal(accepted.verdict, "eligible-for-release-closure");
    for (const evidence of accepted.protectedEvidence) {
      if (evidence.path !== STATE && evidence.path !== PATHS.index) {
        assert.equal(sha(read(evidence.path)), evidence.sha256);
      }
    }
    return { status: "passed", topology: { modules: 37, activations: 38, bridges: 64 },
      releaseFiles: record.records.length };
  }
}

if (require.main === module) {
  new (require("./domain_batches/stage_three_batch_011_historical_workspace").Batch011HistoricalWorkspace)()
    .run(path.resolve(__dirname, "../.."), root => {
      const result = new Batch010ReleaseCheck().run(root);
      console.log(`Stage 3.10.9 release check PASS: ${result.releaseFiles} reversible metadata files, completed prefix 001–010, 37/38/64.`);
    })
    .catch(error => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { Batch010ReleaseCheck };
