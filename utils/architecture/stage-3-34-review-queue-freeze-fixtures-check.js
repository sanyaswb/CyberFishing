"use strict";

// Negative fixtures of the Stage 3.34.0 review-queue freeze: the atomic replacement rule, the static
// hot-loop proofs, the freeze decision and the plan-source chaining must reject every tampered input.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreeStateIdentityReview } = require("./domain_batches/stage_three_state_identity_review");
const { StageThreeApprovedPlanSource } = require("./domain_batches/stage_three_approved_plan_source");
const { StageThreeHotLoopSourceReview } = require("./review_queue/hot_loop_source_review");
const { REVIEWED_COLLECTION } = require("./review_queue/collection_identity_evidence");
const {
  StageThreeFreezeExtensionBuilder,
  StageThreeFreezeExtensionValidator,
} = require("./review_queue/freeze_extension");
const { BASE, INPUTS, ARTIFACTS } = require("./review_queue/review_queue_paths");

const ROOT = path.resolve(__dirname, "../..");
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const bytes = file => fs.readFileSync(path.join(ROOT, file));
const json = file => JSON.parse(bytes(file).toString("utf8"));
const reference = file => ({ path: file, sha256: sha(bytes(file)) });
const clone = value => JSON.parse(JSON.stringify(value));
let cases = 0;
const rejects = (action, pattern, label) => {
  assert.throws(action, pattern, label);
  cases += 1;
};
const replaceOnce = (source, from, to) => {
  assert.equal(source.split(from).length, 2, `fixture anchor is not unique: ${from}`);
  return source.replace(from, to);
};

function identityCases() {
  const { currentPath, className, collection } = REVIEWED_COLLECTION;
  const source = checkpointSource(currentPath);
  const review = (candidate, overrides = {}) => new StageThreeStateIdentityReview().review({ source: candidate,
    currentPath, className, collections: [{ ...collection, allowedOperations: [...collection.allowedOperations],
      ...overrides }] });
  assert.equal(review(source).collections[0].replacements.length, 1);
  rejects(() => review(source, { replacement: undefined }), /escapes its owner/u, "replacement without the rule");
  rejects(() => review(source, { replacement: "copy" }), /unknown replacement rule/u, "unknown rule");
  const mutations = [
    ["    this.#states = replacement;\n  }", "    this.#states = replacement;\n    return this;\n  }", /final statement/u],
    ["const replacement = new Map();", "const replacement = new Set();", /new empty Map/u],
    ["const replacement = new Map();", "const replacement = new Map(this.#states.entries());", /new empty Map/u],
    ["replacement.set(state.rootInstanceId, state);",
      "replacement.set(state.rootInstanceId, state); globalThis.leak = replacement;", /escapes or is shadowed/u],
    ["replacement.set(state.rootInstanceId, state);",
      "replacement.set(state.rootInstanceId, state); replacement.clear();", /unreviewed operations/u],
    ["    this.#states = replacement;", "    this.#states = replacement;\n    this.#states = new Map();", /final statement/u],
    ["  list() {", "  swap(other) {\n    other.#states = this.#states;\n  }\n\n  list() {", /unexpected receiver/u],
    ["    this.#states = replacement;", "    [0].forEach(() => { this.#states = replacement; });", /escapes its owner/u],
  ];
  for (const [from, to, pattern] of mutations) {
    rejects(() => review(replaceOnce(source.replaceAll("\r\n", "\n"), from, to)), pattern, `identity mutation: ${to}`);
  }
}

function hotLoopCases() {
  const currentPath = "src/core/fishing/tackle_stress_accumulator.js";
  const className = "TackleStressAccumulator";
  const source = checkpointSource(currentPath).replaceAll("\r\n", "\n");
  const review = candidate => new StageThreeHotLoopSourceReview().review({ source: candidate, currentPath, className });
  assert(Object.values(review(source).proofs).every(Boolean), "baseline hot-loop proofs must hold");
  const anchor = "    const stressConfig = config.stress || {};";
  const mutations = [
    ["const now = Date.now();", "noWallClockTimeSource"],
    ["const now = performance.now();", "noWallClockTimeSource"],
    ["const view = window.innerWidth;", "noRealmOrTransportLookupInClass"],
    ["const view = globalThis.innerWidth;", "noRealmOrTransportLookupInClass"],
    ["const transport = __CYBER_FISHING_COMPAT_RUNTIME__;", "noRealmOrTransportLookupInClass"],
    ["const available = typeof TackleFailureSelector !== \"undefined\";", "noTypeofAvailabilityLookupInClass"],
    ["const selector = new TackleFailureSelector();", "classProvidersOnlyOutsideHotMembers"],
  ];
  for (const [statement, proof] of mutations) {
    const record = review(replaceOnce(source, anchor, `    ${statement}\n${anchor}`));
    assert.equal(record.proofs[proof], false, `hot-loop mutation not detected: ${statement}`);
    cases += 1;
  }
}

function freezeInputs() {
  const collection = json(ARTIFACTS.collectionIdentityEvidence);
  const hotLoop = json(ARTIFACTS.hotLoopEvidence);
  const collectionRef = reference(ARTIFACTS.collectionIdentityEvidence);
  const hotLoopRef = reference(ARTIFACTS.hotLoopEvidence);
  const extension = json(ARTIFACTS.freezeExtension);
  return {
    base: json(BASE.approvedPrefix), baseRef: reference(BASE.approvedPrefix),
    candidates: json(BASE.candidateBatches), candidatesRef: reference(BASE.candidateBatches),
    reviewEvidence: json(BASE.reviewEvidence), reviewEvidenceRef: reference(BASE.reviewEvidence),
    backlog: json(BASE.prerequisiteBacklog), backlogRef: reference(BASE.prerequisiteBacklog),
    // The recorded pre-adoption execution state (the extension names it by fingerprint).
    executionState: { completedBatchIds: extension.completedPrefix.completedBatchIds },
    executionStateRef: extension.completedPrefix.executionState,
    evidence: [
      ...collection.records.map(record => ({ taskId: collection.evidenceTaskId, artifact: collectionRef, record })),
      ...hotLoop.records.map(record => ({ taskId: hotLoop.evidenceTaskId, artifact: hotLoopRef, record })),
    ],
    // Sources at the freeze checkpoint: the recorded Stage 3.22 evidence binds them exactly.
    readSource: file => {
      const record = [...collection.records, ...hotLoop.records].find(item => item.currentPath === file);
      const source = checkpointSource(file);
      assert.equal(sha(source), record.sourceSha256, `fixture source differs from the frozen evidence: ${file}`);
      return source;
    },
  };
}

// Before the review-queue batches migrate, the live classic source is the checkpoint source; a
// migrated module is read from its recorded cutover before-image.
function checkpointSource(file) {
  const live = bytes(file);
  const migration = fs.readdirSync(path.join(ROOT, "architecture/migration"))
    .filter(name => /^stage_3_batch_\d{3}_runtime_cutover\.json$/u.test(name))
    .map(name => json(`architecture/migration/${name}`))
    .flatMap(cutover => cutover.writes || [])
    .find(write => write.path === file && write.beforeBase64);
  return (migration ? Buffer.from(migration.beforeBase64, "base64") : live).toString("utf8");
}

function freezeCases() {
  const inputs = freezeInputs();
  const build = overrides => new StageThreeFreezeExtensionBuilder().build({ ...inputs, ...overrides });
  const extension = build({});
  assert.deepEqual(Buffer.from(`${JSON.stringify(extension, null, 2)}\n`), bytes(ARTIFACTS.freezeExtension),
    "the recorded freeze extension must rebuild from its recorded inputs");
  const validate = candidate => new StageThreeFreezeExtensionValidator().validate({ extension: candidate, base: inputs.base });
  validate(extension);
  const decision = (candidate, index) => candidate.batchDecisions[index].decision;
  const changed = build({ readSource: file => `${inputs.readSource(file)}\n// drift\n` });
  assert.deepEqual([decision(changed, 0), decision(changed, 1)], ["requires-evidence", "requires-evidence"]);
  assert(changed.batchDecisions[0].unresolved.some(item => item.startsWith("source-changed-since-stage-3.22-review:")));
  cases += 1;
  const missingHotLoop = build({ evidence: inputs.evidence.filter(item =>
    item.record.currentPath !== "src/systems/rod_lateral_control_system.js") });
  assert.deepEqual([decision(missingHotLoop, 0), decision(missingHotLoop, 1)], ["approved-frozen", "requires-evidence"]);
  assert.equal(missingHotLoop.batches.length, 1);
  cases += 1;
  const missingCollection = build({ evidence: inputs.evidence.slice(1) });
  assert.deepEqual([decision(missingCollection, 0), decision(missingCollection, 1)], ["requires-evidence", "requires-evidence"]);
  assert(missingCollection.batchDecisions[1].unresolved.includes("after-evidence-freeze-barrier"));
  cases += 1;
  const staleEvidence = build({ evidence: inputs.evidence.map((item, index) => index === 0
    ? { ...item, record: { ...item.record, sourceSha256: "0".repeat(64) } } : item) });
  assert.equal(decision(staleEvidence, 0), "requires-evidence");
  cases += 1;
  const duplicated = build({ evidence: [...inputs.evidence, inputs.evidence[1]] });
  assert.equal(decision(duplicated, 1), "requires-evidence");
  cases += 1;
  rejects(() => build({ executionState: { completedBatchIds: inputs.executionState.completedBatchIds.slice(0, -1) } }),
    /complete Stage 3.22 approved prefix/u, "incomplete execution prefix");
  const tamper = mutate => { const candidate = clone(extension); mutate(candidate); return () => validate(candidate); };
  rejects(tamper(candidate => { candidate.batches.reverse(); }), /ordered review queue/u, "reordered batches");
  rejects(tamper(candidate => { candidate.batches[0].order = 40; }), /order differs/u, "order");
  rejects(tamper(candidate => { candidate.batchDecisions[1].resolutions.pop(); }), /hot-loop gate lacks evidence|not resolved/u,
    "missing resolution");
  rejects(tamper(candidate => { candidate.batchDecisions[0].moduleBindings[0].stage322SourceBinding = "changed"; }),
    /module source changed/u, "changed source binding");
  rejects(tamper(candidate => { candidate.batches[1].rollback.partialRollbackAllowed = true; }), /batch-only atomic/u,
    "partial rollback");
  rejects(tamper(candidate => {
    candidate.batches[0].cumulativeRuntimeTopology.topologyRevalidation.requiredBeforeApprovedFreeze = true;
  }), /graph-changing prerequisite/u, "graph-changing prerequisite");
  rejects(tamper(candidate => { candidate.runtimeMigrationAllowed = true; }), /runtime migration/u, "runtime migration");
  rejects(tamper(candidate => { candidate.reviewQueue.push(candidate.reviewQueue[0] || {}); }), /cover the review queue/u,
    "queue coverage");
}

function planSourceCases() {
  const extensionBytes = bytes(ARTIFACTS.freezeExtension);
  const extensionRef = { path: ARTIFACTS.freezeExtension, sha256: sha(extensionBytes) };
  const extension = JSON.parse(extensionBytes);
  const state = { ...json(INPUTS.executionState), continuationPlan: extension.base,
    completedBatchIds: extension.completedPrefix.completedBatchIds, activeBatchId: null };
  delete state.activeBatchPhase;
  const withExtension = document => {
    const tampered = Buffer.from(`${JSON.stringify(document, null, 2)}\n`);
    const read = file => (file === ARTIFACTS.freezeExtension ? tampered : bytes(file));
    return { read, reference: { path: ARTIFACTS.freezeExtension, sha256: sha(tampered) } };
  };
  const load = (document, currentState = state) => {
    const { read, reference: ref } = withExtension(document);
    return new StageThreeApprovedPlanSource({ read }).load(currentState, { adopting: ref });
  };
  const plan = load(extension);
  assert.equal(plan.document.batches.length, extension.completedPrefix.completedBatchIds.length + extension.batches.length);
  rejects(() => load({ ...extension, base: { ...extension.base, sha256: "0".repeat(64) } }),
    /adopted continuation plan differs/u, "extension of another base");
  rejects(() => load({ ...extension, status: "candidate" }), /not frozen/u, "unfrozen extension");
  rejects(() => load({ ...extension, completedPrefix: { ...extension.completedPrefix,
    completedBatchIds: extension.completedPrefix.completedBatchIds.slice(1) } }), /complete base continuation/u,
  "incomplete completed prefix");
  rejects(() => load({ ...extension, batches: extension.batches.map((batch, index) =>
    index === 0 ? { ...batch, order: 99 } : batch) }), /extension order differs/u, "extension order");
  rejects(() => load({ ...extension, batches: [] }), /no frozen batches/u, "empty extension");
  rejects(() => new StageThreeApprovedPlanSource({ read: bytes }).load(state,
    { adopting: { ...extensionRef, sha256: "0".repeat(64) } }), /fingerprint is stale/u, "stale extension fingerprint");
}

identityCases();
hotLoopCases();
freezeCases();
planSourceCases();
console.log(`Stage 3.34.0 review-queue freeze fixtures PASS: ${cases} negative cases (atomic replacement, ` +
  "hot-loop proofs, freeze decisions, extension validator and plan-source chaining).");
