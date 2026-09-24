"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { Batch010Preflight, Batch010SourceContract, PROFILE } = require("./domain_batches/stage_three_batch_010_preflight");

class Batch010AuditFixtures {
  run(root = path.resolve(__dirname, "../..")) {
    const preflight = new Batch010Preflight(root);
    const target = PROFILE.executionProfile.expectedTargets[0];
    const source = preflight.read(target.currentPath);
    const contract = new Batch010SourceContract();
    contract.verify(source);
    let negatives = 0;
    const rejectSource = (label, changed) => {
      assert.throws(() => contract.verify(changed), label);
      negatives++;
    };
    for (const [label, replacement] of [
      ["config coupling", "CONFIG.allowed"],
      ["browser coupling", "document.readyState"],
      ["dev coupling", "DevTools.enabled"],
      ["transport coupling", "__CYBER_FISHING_COMPAT_RUNTIME__.allowed"],
      ["semantic difference", "false"],
      ["shared result", "SHARED_RESULT"],
    ]) rejectSource(label, source.replace("allowed: true", `allowed: ${replacement}`));
    rejectSource("new top-level effect", `${source}\nregister();`);
    rejectSource("new instance state", source.replace("  canApply()", "  result = null;\n  canApply()"));
    rejectSource("new per-call allocation", source.replace("return { allowed: true, reason: null };", "return { allowed: true, reason: [] };"));

    const artifact = preflight.json(PROFILE.executionProfile.auditPath);
    preflight.verifyReplay(artifact);
    for (const [label, mutate] of [
      ["stale source evidence", item => { item.scope.modules[0].sourceSha256 = "0".repeat(64); }],
      ["stale consumer evidence", item => { item.compatibility.consumers.pop(); }],
      ["stale activation evidence", item => { item.compatibility.activations[0].legacyScriptIndex++; }],
      ["stale graph evidence", item => { item.scope.modules[0].scc.cyclic = true; }],
      ["stale runtime evidence", item => { item.sourceEvidence.runtimeOutput.fingerprint = "0".repeat(64); }],
      ["new config edge", item => { item.boundaries.directConfigDependencies.push("config"); }],
      ["new browser capability", item => { item.boundaries.browserCapabilities.push("dom"); }],
      ["new dev edge", item => { item.boundaries.forbiddenEdges.push("dev"); }],
      ["new transport read", item => { item.boundaries.transportReads.push(target.currentPath); }],
    ]) {
      const changed = structuredClone(artifact);
      mutate(changed);
      assert.throws(() => preflight.verifyReplay(changed), label);
      negatives++;
    }
    console.log(`Stage 3.10.0 fixtures PASS: ${negatives} negative cases; source, graph and runtime evidence remain read-only.`);
    return negatives;
  }
}

if (require.main === module) {
  new (require("./domain_batches/stage_three_batch_010_historical_workspace").Batch010HistoricalWorkspace)()
    .run(path.resolve(__dirname, "../.."), root => new Batch010AuditFixtures().run(root))
    .catch(error => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { Batch010AuditFixtures };
