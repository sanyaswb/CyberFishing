"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { replay, checkpointWorkspace, REVIEW_ARTIFACTS } = require("./stage-3-22-post-freeze-review");
const { PostFreezeReview } = require("./post_freeze/post_freeze_review");
const { PostFreezeDomainAudit } = require("./post_freeze/post_freeze_domain_audit");
const { PostFreezeLogicalGraphBuilder } = require("./post_freeze/post_freeze_logical_graph");
const { PostFreezePlanValidator } = require("./post_freeze/post_freeze_plan_validator");
const { PostFreezePrerequisiteBacklogBuilder } = require("./post_freeze/post_freeze_prerequisite_backlog");
const { PostFreezeApprovedPrefixValidator } = require("./post_freeze/post_freeze_approved_prefix");
const { FIRST_ORDER } = require("./post_freeze/post_freeze_candidate_plan");
const { INPUTS, ARTIFACTS } = require("./post_freeze/post_freeze_paths");
const { PostFreezeWorkspace } = require("./post_freeze/post_freeze_workspace");
const { PostFreezeReleaseTransition } = require("./post_freeze/post_freeze_release_transition");
const { Stage322ReleaseCheck } = require("./stage-3-22-release-check");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const clone = value => JSON.parse(JSON.stringify(value));

// Input observations presented in reverse order must not change any artifact byte.
class ReversedObservationAudit extends PostFreezeDomainAudit {
  build(options) {
    const result = super.build(options);
    return { ...result,
      observed: { ...result.observed, modules: [...result.observed.modules].reverse() },
      unifiedGraph: { ...result.unifiedGraph, edges: [...result.unifiedGraph.edges].reverse() } };
  }
}

class ReversedRegistryWorkspace extends PostFreezeWorkspace {
  json(file) {
    const value = super.json(file);
    if (file === INPUTS.bridgeRegistry) value.bridges.reverse();
    return value;
  }
}

// A single changed input byte must make the recorded fingerprints stale.
class StalePolicyWorkspace extends PostFreezeWorkspace {
  bytes(file) {
    const bytes = super.bytes(file);
    return file === INPUTS.candidatePolicy ? Buffer.concat([bytes, Buffer.from("\n")]) : bytes;
  }
}

class Stage322PostFreezeReviewCheck {
  run(root = PROJECT_ROOT) {
    const { result, mismatches } = replay({ root });
    assert.deepEqual(mismatches, [], `Stage 3.22 replay differs: ${mismatches.join(", ")}`);
    const context = result.context;
    this.#invariants(result);
    const images = checkpointWorkspace(root).beforeImage;
    const reordered = replay({ root, review: new PostFreezeReview({ domainAudit: new ReversedObservationAudit() }),
      workspace: new ReversedRegistryWorkspace(root, { beforeImage: images }) });
    assert.deepEqual(reordered.mismatches, [], "Stage 3.22 review depends on input order");
    const stale = replay({ root, workspace: new StalePolicyWorkspace(root, { beforeImage: images }) });
    assert(stale.mismatches.includes(ARTIFACTS.baseline) && stale.mismatches.includes(ARTIFACTS.candidateBatches),
      "stale input fingerprint was not detected");
    const fixtures = this.#negativeFixtures(context, root, images);
    const released = new PostFreezeReleaseTransition(root).exists() ? new Stage322ReleaseCheck().run(root) : null;
    console.log(`Stage 3.22 post-freeze review check PASS: ${REVIEW_ARTIFACTS.length} artifacts replay ` +
      `byte-identical and order-independent, stale fingerprints detected, ${fixtures} negative fixtures rejected${released ? "; v0.24.59 release metadata reversible" : ""}.`);
    return { fixtures };
  }

  #invariants(result) {
    const { approved, candidates, graph, eligibility } = result.context;
    assert.equal(result.summary.observationDrift, 0, "fresh observation drifted from the Manifest");
    assert.deepEqual(result.summary.domainScope, { entries: 135, completedEsmTargets: 69,
      remainingClassicModules: 66, shimsExcluded: 69 });
    assert.equal(graph.logical.nodeCount, 135);
    assert.equal(eligibility.summary.remainingModuleCount, 66);
    assert.equal(approved.runtimeMigrationAllowed, false);
    assert.equal(candidates.runtimeMigrationAllowed, false);
    assert.equal(approved.completedPrefix.completedBatchIds.length, 21);
    assert.deepEqual(approved.freezeBoundary.topologyBefore, { modules: 78, activations: 87, bridges: 139 });
    assert.equal(approved.coverage.unassigned.length, 0);
  }

  #negativeFixtures(context, root, images) {
    const workspace = new PostFreezeWorkspace(root, { beforeImage: images });
    const { audit, graph, eligibility, evidence, plan, candidates, reviewEvidence, approved,
      runtimeContract, bridgeRegistry } = context;
    const graphInput = (overrides = {}) => ({ document: audit.audit.document, completedTargets: audit.completedTargets,
      runtimeContract, bridgeRegistry, unifiedGraph: audit.unifiedGraph, readSource: file => workspace.text(file),
      ...overrides });
    const validate = (planValue, graphValue = graph, contract = runtimeContract) => new PostFreezePlanValidator()
      .validate({ plan: planValue, eligibility, logicalGraph: graphValue, runtimeContract: contract,
        firstOrder: FIRST_ORDER, maximumModulesPerBatch: eligibility.policy.clustering.maximumModulesPerBatch });
    const resolved = graph.activationResolution.find(item => item.scope === "completed-domain");
    const cases = [];
    const expect = (name, action, pattern) => {
      assert.throws(action, pattern, `negative fixture accepted: ${name}`);
      cases.push(name);
    };
    expect("incorrect activation alias", () => {
      const contract = clone(runtimeContract);
      contract.activationPositions.find(item => item.id === resolved.activationId).legacySymbol = "RenamedSymbol";
      new PostFreezeLogicalGraphBuilder().build(graphInput({ runtimeContract: contract }));
    }, /Incorrect activation alias/);
    expect("incorrect activation export", () => {
      const contract = clone(runtimeContract);
      contract.activationPositions.find(item => item.id === resolved.activationId).exportName = "MissingExport";
      new PostFreezeLogicalGraphBuilder().build(graphInput({ runtimeContract: contract }));
    }, /Incorrect activation export/);
    expect("missing bridge consumer", () => {
      const bridge = bridgeRegistry.bridges.find(item => item.introducedStage === "stage-3" &&
        audit.completedTargets.has(item.target));
      const unifiedGraph = { ...audit.unifiedGraph, edges: audit.unifiedGraph.edges.filter(edge =>
        !(edge.source === bridge.source && edge.target === bridge.bridge)) };
      new PostFreezeLogicalGraphBuilder().build(graphInput({ unifiedGraph }));
    }, /Bridge consumer is missing/);
    expect("duplicate legacy symbol owner in runtime contract", () => {
      const contract = clone(runtimeContract);
      const [first, second] = contract.activationPositions.filter(item => audit.completedTargets.has(item.targetModule) &&
        item.targetModule !== resolved.targetModule);
      second.legacySymbol = first.legacySymbol;
      new PostFreezeLogicalGraphBuilder().build(graphInput({ runtimeContract: contract }));
    }, /Duplicate legacy symbol owner|Duplicate activation/);
    expect("module assigned twice", () => {
      const value = clone(plan);
      value.batches[1].modules.push(value.batches[0].modules[0]);
      validate(value);
    }, /module assigned twice/);
    expect("duplicate new activation owner", () => {
      const value = clone(plan);
      const batch = value.batches.find(item => item.compatibility.newActivations.length > 0);
      batch.compatibility.newActivations[0].contract.legacySymbol = runtimeContract.activationPositions
        .find(item => item.targetModule !== batch.compatibility.newActivations[0].contract.targetModule).legacySymbol;
      validate(value);
    }, /duplicate legacy symbol owner/);
    expect("invalid dependency order", () => {
      const value = clone(plan);
      const consumer = graph.nodes.find(node => node.status === "remaining" &&
        node.dependencies.some(item => item.kind === "classic-global") &&
        value.coverage.assigned.includes(node.currentPath));
      const dependency = consumer.dependencies.find(item => item.kind === "classic-global").target;
      const from = value.batches.find(batch => batch.modules.some(module => module.currentPath === dependency));
      const moved = from.modules.find(module => module.currentPath === dependency);
      const consumerBatch = value.batches.find(batch => batch.modules.some(module =>
        module.currentPath === consumer.currentPath));
      const later = value.batches.filter(batch => batch.order > consumerBatch.order && batch !== from &&
        batch.modules.length < eligibility.policy.clustering.maximumModulesPerBatch).at(-1);
      from.modules = from.modules.filter(module => module !== moved);
      later.modules.push(moved);
      validate(value);
    }, /dependency order is invalid/);
    expect("SCC split across batches", () => {
      const logical = clone(graph);
      const [left, right] = [plan.batches[0].modules[0].currentPath, plan.batches[1].modules[0].currentPath];
      logical.nodes.find(node => node.currentPath === right).planningSccId =
        logical.nodes.find(node => node.currentPath === left).planningSccId;
      validate(plan, logical);
    }, /SCC is split across batches/);
    expect("dependency on a blocked module", () => {
      const logical = clone(graph);
      const blocked = eligibility.records.find(record => record.category === "prerequisite-blocked").currentPath;
      logical.nodes.find(node => node.currentPath === plan.batches[0].modules[0].currentPath)
        .dependencies.push({ target: blocked, kind: "classic-global" });
      validate(plan, logical);
    }, /depends on a blocked or deferred module/);
    expect("blocked module assigned to a batch", () => {
      const value = clone(plan);
      const blocked = value.prerequisiteBlocked.shift();
      value.batches[0].modules.push({ currentPath: blocked.currentPath, targetPath: blocked.targetPath });
      validate(value);
    }, /blocked or deferred module assigned/);
    expect("incomplete coverage", () => {
      const value = clone(plan);
      value.deferred.pop();
      validate(value);
    }, /coverage is incomplete/);
    expect("unassigned module", () => {
      const value = clone(plan);
      value.coverage.unassigned.push(value.coverage.deferred[0]);
      validate(value);
    }, /coverage has unassigned modules/);
    expect("prerequisite without backlog task", () => {
      const records = clone(eligibility.records);
      const target = records.find(record => record.category === "prerequisite-blocked");
      target.eligibility.prerequisites.push({ id: "boundary-extraction:unknown", kind: "boundary-extraction",
        action: "remove-forbidden-domain-dependency-and-regenerate-evidence", module: "src/unknown.js" });
      new PostFreezePrerequisiteBacklogBuilder().build({ eligibility: { ...eligibility, records }, evidence,
        unifiedGraph: audit.unifiedGraph, providerAmbiguities: [], readSource: file => workspace.text(file),
        sourceExists: file => workspace.exists(file) });
    }, /Prerequisites without a backlog task/);
    expect("frozen batch with insufficient evidence", () => {
      const review = clone(reviewEvidence);
      review.batchDecisions[0].moduleEvidence[0].verdict = "insufficient";
      new PostFreezeApprovedPrefixValidator().validate({ approved, candidates, reviewEvidence: review,
        expectedDomainModuleCount: 135 });
    }, /frozen module lacks sufficient evidence/);
    expect("hot-loop batch frozen", () => {
      // Even with approved decisions and sufficient verdicts, a hot-loop gate forbids the freeze.
      const hot = candidates.batches.find(batch => batch.gates.performance.length > 0);
      const reordered = { ...candidates, batches: [...approved.batches.map(batch =>
        candidates.batches.find(item => item.id === batch.id)), hot] };
      const value = clone(approved);
      value.batches.push({ ...hot, status: "approved-frozen" });
      value.reviewQueue = [];
      const review = clone(reviewEvidence);
      const decision = review.batchDecisions.find(item => item.batchId === hot.id);
      decision.decision = "approved-frozen";
      decision.moduleEvidence.forEach(item => { item.verdict = "sufficient"; });
      new PostFreezeApprovedPrefixValidator().validate({ approved: value, candidates: reordered,
        reviewEvidence: review, expectedDomainModuleCount: 135 });
    }, /frozen batch carries a hot-loop gate/);
    return cases.length;
  }
}

// Later batches change the reviewed inputs; the review replays at its own checkpoint, which the
// batch-022 historical workspace reconstructs (it is the live tree until batch 022 opens).
if (require.main === module) {
  const { Batch022HistoricalWorkspace } = require("./domain_batches/stage_three_batch_022_historical_workspace");
  new Batch022HistoricalWorkspace().run(PROJECT_ROOT, prior => new Stage322PostFreezeReviewCheck().run(prior))
    .catch(error => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { Stage322PostFreezeReviewCheck };
