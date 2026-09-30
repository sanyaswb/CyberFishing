"use strict";

// The Stage 3.41 review is the first graph-triggered replacement of an unexecuted approved-plan
// suffix. These fixtures prove that only the exact completed prefix survives and malformed
// replacement links cannot be adopted.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreeApprovedPlanSource } = require("./domain_batches/stage_three_approved_plan_source");

const ROOT = path.resolve(__dirname, "../..");
const STATE = "architecture/migration/stage_3_execution_state.json";
const REPLACEMENT = "architecture/migration/stage_3_41_graph_review/approved_prefix.json";
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const bytes = file => fs.readFileSync(path.join(ROOT, file));
const clone = value => JSON.parse(JSON.stringify(value));
const state = JSON.parse(bytes(STATE));
const replacementBytes = bytes(REPLACEMENT);
const replacement = JSON.parse(replacementBytes);
const reference = { path: REPLACEMENT, sha256: sha(replacementBytes) };
let cases = 0;

const load = document => {
  const candidate = Buffer.from(`${JSON.stringify(document, null, 2)}\n`);
  const read = file => (file === REPLACEMENT ? candidate : bytes(file));
  return new StageThreeApprovedPlanSource({ read }).load(state,
    { adopting: { path: REPLACEMENT, sha256: sha(candidate) } });
};
const rejects = (mutate, pattern, label) => {
  const document = clone(replacement);
  mutate(document);
  assert.throws(() => load(document), pattern, label);
  cases += 1;
};

const adopted = new StageThreeApprovedPlanSource({ read: bytes }).load(state, { adopting: reference });
assert.deepEqual(adopted.document.batches.map(batch => batch.id),
  [...state.completedBatchIds, ...replacement.batches.map(batch => batch.id)],
  "replacement must preserve the completed prefix and replace only its unexecuted suffix");
assert.equal(adopted.domainAuditPath,
  "architecture/migration/stage_3_41_graph_review/domain_audit.json");

rejects(document => { document.base.sha256 = "0".repeat(64); },
  /adopted continuation plan differs/u, "replacement of another base");
rejects(document => { document.status = "candidate"; }, /not frozen/u, "unfrozen replacement");
rejects(document => { document.runtimeMigrationAllowed = true; }, /strictly equal/u,
  "runtime migration enabled");
rejects(document => { document.completedPrefix.completedBatchIds = document.completedPrefix.completedBatchIds.slice(0, 20); },
  /historical prefix/u, "historical prefix removed");
rejects(document => {
  const ids = document.completedPrefix.completedBatchIds;
  ids[ids.length - 1] = "wrong-batch";
},
  /exact completed base prefix/u, "completed prefix changed");
rejects(document => {
  document.completedPrefix.completedBatchIds = new StageThreeApprovedPlanSource({ read: bytes })
    .load(state).document.batches.map(batch => batch.id);
}, /replace a non-empty suffix/u, "empty replaced suffix");
rejects(document => { document.batches[0].order = 99; },
  /replacement batch order differs/u, "replacement order");
rejects(document => { document.batches = []; }, /no frozen batches/u, "empty replacement");
rejects(document => { delete document.replacesIncompleteSuffix; },
  /complete base continuation/u, "replacement flag removed");

console.log(`Stage 3.41 replacement-plan fixtures PASS: ${cases} negative cases and exact completed-prefix preservation.`);
