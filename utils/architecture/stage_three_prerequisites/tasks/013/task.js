"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const LOADOUT = "src/core/loadouts/equipment_loadout.js";
const MIXED = "mixed-responsibility-requires-decomposition";

// Stage 3.22 backlog task stage-3.22.prerequisite.loadouts-decomposition, transition 2 (owner decision
// 2026-09-28, point 3): "Комплект" is the default name and displayType persisted in every loadout
// snapshot, i.e. save-format data, not a UI label; a presentation catalog would let a translation change
// new saves. EquipmentLoadout keeps it as a Domain save-format constant; its blocker is removed without a
// source edit on recorded evidence. EquipmentLoadoutRepository has no blocker of its own.
module.exports = Object.freeze({
  sequence: 13,
  slug: "loadout-reviewed-reclassification",
  afterBatch: "038",
  backlogTaskId: "stage-3.22.prerequisite.loadouts-decomposition",
  intent: "Loadouts decomposition 2: evidence-backed removal of the mixed-responsibility blocker from the unchanged EquipmentLoadout, whose \"Комплект\" default name and displayType are save-format data persisted in every snapshot.",
  sourceEdits: Object.freeze([]),
  reviewedWithoutEdit: Object.freeze([LOADOUT]),
  manifestUpdates: Object.freeze([
    Object.freeze({ currentPath: LOADOUT, removedBlockers: Object.freeze([Object.freeze({ blocker: MIXED,
      reason: "\"Комплект\" is the default name and displayType persisted in every loadout snapshot (save-format data, not a UI label); keeping it a Domain constant keeps saves independent of translations. The entity otherwise holds only the five main root slots and their invariants (recorded evidence: permitted dependencies only, no browser, DEV or debt)." })]) }),
  ]),
  resolvedDebtIds: Object.freeze([]),
  expectedEdges: Object.freeze({ removed: Object.freeze([]), added: Object.freeze([]) }),
  // No behaviour can change: the reviewed source is outside the write set; its bytes are pinned and its
  // save-format constant is unchanged.
  parity({ read }) {
    const source = read(LOADOUT);
    assert(/const LOADOUT_DISPLAY_NAME = "Комплект";/u.test(source), "the save-format constant changed");
    const text = JSON.stringify([[LOADOUT, crypto.createHash("sha256").update(source).digest("hex")]]);
    return { cases: 1, factsSha256: crypto.createHash("sha256").update(text).digest("hex") };
  },
});
