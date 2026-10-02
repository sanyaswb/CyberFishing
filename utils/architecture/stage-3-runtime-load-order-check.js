"use strict";

// Stage 3 runtime load order (owner decision 2026-10-01, prerequisite 031): the single cumulative runtime
// tag evaluates before every approved activation. The published runtime contract and every activation that
// the approved execution plan still has to perform (batches not yet completed) must sit at or after the
// runtime load slot of index.html (at the slot only when the tag precedes the whole slot), so a graph
// review can no longer freeze a batch whose activations would run before the runtime. Negative fixtures
// prove the rule rejects an earlier activation and a tag inside the activation's slot.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { CumulativeRuntimeLoadSlot } = require("../build/compat_runtime/cumulative_runtime_load_slot");
const { StageThreeRuntimeScriptAliasResolver } = require("./migration/stage_three_runtime_script_alias_resolver");
const { StageThreeApprovedPlanSource } = require("./domain_batches/stage_three_approved_plan_source");

const ROOT = path.resolve(__dirname, "../..");
const read = file => fs.readFileSync(path.join(ROOT, file));
const json = file => JSON.parse(read(file).toString("utf8"));

// Positions that load at or after the runtime: later slots, or the runtime slot itself when the tag
// precedes every member of that slot.
function violations(load, positions) {
  return positions.filter(item => item.legacyScriptIndex < load.slot ||
    (item.legacyScriptIndex === load.slot && !load.precedesWholeSlot));
}

const contract = json("architecture/migration/stage_3_compatibility_runtime.json");
const runtimePath = contract.output.directory + contract.output.runtimeFile;
const load = CumulativeRuntimeLoadSlot.read({ html: read("index.html").toString("utf8"),
  aliases: new StageThreeRuntimeScriptAliasResolver().resolve(contract), runtimePath });
const state = json("architecture/migration/stage_3_execution_state.json");
const plan = new StageThreeApprovedPlanSource({ read }).load(state).document;
const completed = new Set(state.completedBatchIds);
const planned = plan.batches.filter(batch => !completed.has(batch.id) && batch.id !== state.activeBatchId)
  .flatMap(batch => (batch.compatibility?.newActivations || []).map(item =>
    ({ id: item.contract.id, batch: batch.id, legacyScriptIndex: item.contract.legacyScriptIndex })));
assert.deepEqual(violations(load, contract.activationPositions), [], "a published activation precedes the runtime");
assert.deepEqual(violations(load, planned), [], "an approved batch activation would precede the runtime");
// Stage 4 M1 (2026-10-02): the tag precedes every legacy slot, so config activations of slots 1-29 see it.
assert.deepEqual({ slot: load.slot, precedesWholeSlot: load.precedesWholeSlot }, { slot: 1, precedesWholeSlot: true },
  "the cumulative runtime tag must precede every legacy slot");

// Negative fixtures over a minimal document: runtime tag, then slots 1..3.
const tag = file => `<script src="${file}"></script>\n`;
const html = (...files) => files.map(tag).join("");
const fixture = (...files) => CumulativeRuntimeLoadSlot.read({ html: html(...files), aliases: new Map([[runtimePath, null]]),
  runtimePath });
const late = fixture("a.js", runtimePath, "b.js", "c.js");
assert.deepEqual({ ...late }, { slot: 2, firstPath: "b.js", precedesWholeSlot: true });
assert.deepEqual(violations(late, [{ legacyScriptIndex: 1 }]).length, 1, "an earlier activation is rejected");
assert.deepEqual(violations(late, [{ legacyScriptIndex: 2 }, { legacyScriptIndex: 3 }]), [], "later activations pass");
const inside = CumulativeRuntimeLoadSlot.read({ html: `<script src="a.js" data-legacy-slot="1"></script>\n${tag(runtimePath)}` +
  `<script src="b.js" data-legacy-slot="1"></script>\n`, aliases: new Map([[runtimePath, null]]), runtimePath });
assert.deepEqual({ ...inside }, { slot: 1, firstPath: "b.js", precedesWholeSlot: false });
assert.equal(violations(inside, [{ legacyScriptIndex: 1 }]).length, 1, "a tag inside the activation slot is rejected");
assert.throws(() => fixture("a.js", "b.js"), /Expected one cumulative runtime tag/u, "a missing runtime tag is rejected");
assert.throws(() => fixture(runtimePath, "a.js", runtimePath), /Expected one cumulative runtime tag/u,
  "a duplicate runtime tag is rejected");

console.log(`Stage 3 runtime load order passed: runtime at slot ${load.slot} before ${contract.activationPositions.length} ` +
  `published and ${planned.length} planned activations; 6 negative fixture cases.`);
