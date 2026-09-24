"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { StageThreeLivePreflight } = require("./domain_batches/stage_three_live_preflight");
const { BATCH_011_PREFLIGHT_PROFILE: PROFILE } = require("./domain_batches/stage_three_batch_011_preflight_profile");

class Batch011AuditFixtures {
  run(root = path.resolve(__dirname, "../..")) {
    const preflight = new StageThreeLivePreflight(root, PROFILE);
    const artifact = preflight.json(PROFILE.executionProfile.auditPath);
    preflight.verifyReplay(artifact);
    const negatives = [
      ["source fingerprint", item => { item.scope.modules[0].sourceSha256 = "0".repeat(64); }],
      ["consumer identity", item => { item.compatibility.consumers.pop(); }],
      ["activation position", item => { item.compatibility.activations[0].legacyScriptIndex++; }],
      ["cycle", item => { item.scope.modules[0].scc.cyclic = true; }],
      ["runtime fingerprint", item => { item.sourceEvidence.runtimeOutput.fingerprint = "0".repeat(64); }],
      ["config edge", item => { item.boundaries.directConfigDependencies.push("config"); }],
      ["browser capability", item => { item.boundaries.browserCapabilities.push("dom"); }],
      ["transport read", item => { item.boundaries.transportReads.push("global runtime"); }],
      ["state owner", item => { item.scope.modules[0].state.ownerIdentity = "duplicated"; }],
      ["registry allocation", item => { item.scope.modules[3].sourceShape.allocationTotals.arrayExpressions++; }],
    ];
    for (const [label, mutate] of negatives) {
      const changed = structuredClone(artifact);
      mutate(changed);
      assert.throws(() => preflight.verifyReplay(changed), label);
    }
    console.log(`Stage 3.11.0 fixtures PASS: ${negatives.length} negative cases.`);
    return negatives.length;
  }
}

if (require.main === module) {
  new (require("./domain_batches/stage_three_batch_011_historical_workspace").Batch011HistoricalWorkspace)()
    .run(path.resolve(__dirname, "../.."), root => new Batch011AuditFixtures().run(root))
    .catch(error => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { Batch011AuditFixtures };
