"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { canonicalBytes, fingerprint } = require("./domain_batches/stage_three_pending_target_manifest");
const { StageThreeBatch008ReleaseTransition, TRANSITION } = require("./domain_batches/stage_three_batch_008_release_transition");
const { StageThreeBatch008ReleaseAcceptanceCheck, CHECKS, BROWSER, CLOSURE } = require("./stage-3-batch-008-release-acceptance-check");
function run() {
const root = path.resolve(__dirname, "../..");
const read = (file) => require("./domain_batches/stage_three_batch_009_prebuild_history")
  .beforeBatch009Prebuild(file, fs.readFileSync(path.join(root, file)), root);
const transition = new StageThreeBatch008ReleaseTransition(root);
const record = JSON.parse(read(TRANSITION));
const guard = new StageThreeBatch008ReleaseAcceptanceCheck(root);
let rejected = 0;
for (const item of record.records) {
  assert.equal(fingerprint(transition.reverse(read(item.path), item)), item.beforeSha256);
  assert.throws(() => transition.reverse(Buffer.concat([read(item.path), Buffer.from(" ")]), item));
  rejected++;
}
for (const mutate of [
  (r) => r.records.pop(), (r) => r.records.reverse(),
  (r) => r.records[0].path = "src/game/domain/fishing/*",
  (r) => r.records[0].afterSha256 = "stale", (r) => r.batchId = "unapproved",
]) { const invalid = structuredClone(record); mutate(invalid); assert.throws(() => transition.validate(invalid)); rejected++; }
for (const [file, mutate] of [
  ["package.json", (p) => p.scripts.unapproved = "node arbitrary.js"],
  ["package-lock.json", (p) => p.packages[""].dependencies.glob = "*"],
  ["architecture/migration/stage_3_execution_state.json", (p) => p.activeBatchPhase = "runtime-active"],
  ["architecture/migration/stage_3_execution_state.json", (p) => p.completedBatchIds.reverse()],
  ["architecture/migration/stage_3_execution_state.json", (p) => p.activeBatchId = record.batchId],
]) {
  const invalid = JSON.parse(read(file)); mutate(invalid);
  assert.throws(() => transition.validateDelta(file, transition.before(file), canonicalBytes(invalid))); rejected++;
}
const acceptedPath = "architecture/migration/stage_3_batch_008_acceptance_pass.json";
const accepted = JSON.parse(read(acceptedPath));
// Synthetic positive fixture only; never persisted as real browser evidence.
const fixture = { schemaVersion: 1, kind: "cyber-fishing-stage-3-batch-008-browser-confirmation",
  batchId: accepted.batchId, status: "passed", performedBy: "user",
  checks: Object.fromEntries(CHECKS.map((key) => [key, "PASS"])), console: { errors: 0, warnings: 0 },
  userStatement: "synthetic fixture", supplements: { path: acceptedPath, sha256: fingerprint(read(acceptedPath)) } };
guard.verifyBrowser(fixture, accepted);
for (const mutate of [
  ...CHECKS.map((key) => (p) => p.checks[key] = "not-checked"),
  (p) => p.console.errors = 1, (p) => p.console.warnings = 1,
  (p) => p.console.errors = null, (p) => p.checks = null,
  (p) => p.checks.extra = "PASS", (p) => p.performedBy = "assistant",
  (p) => p.userStatement = "", (p) => p.supplements.sha256 = "0".repeat(64),
]) { const invalid = structuredClone(fixture); mutate(invalid); assert.throws(() => guard.verifyBrowser(invalid, accepted)); rejected++; }
assert.throws(() => guard.verifyBrowser(accepted.browserSmoke, accepted)); rejected++;
guard.verifyMechanical();
const candidate = JSON.parse(read(CLOSURE));
candidate.status = "release-candidate";
candidate.releasePublicationAllowed = false;
candidate.finalRegression = null;
candidate.acceptance.browserProof = { path: BROWSER, sha256: fingerprint(canonicalBytes(fixture)) };
const fixtureReader = (file) => file === BROWSER ? canonicalBytes(fixture) : file === CLOSURE ? canonicalBytes(candidate) : read(file);
assert.equal(new StageThreeBatch008ReleaseAcceptanceCheck(root, { read: fixtureReader }).run().status, "release-candidate");
assert.throws(() => new StageThreeBatch008ReleaseAcceptanceCheck(root, { read: fixtureReader }).run({ requireTag: true }));
rejected++;
console.log(`Stage 3.8.9 fixtures PASS: seven exact reversals; ${rejected} negative metadata/browser cases. Synthetic proof is not real acceptance.`);
}
require("./domain_batches/stage_three_batch_009_historical_workspace").runHistoricalScript(path.resolve(__dirname,"../.."),
  "utils/architecture/stage-3-batch-008-release-fixture-check.js",run).catch(e=>{console.error(e.stack);process.exitCode=1;});
