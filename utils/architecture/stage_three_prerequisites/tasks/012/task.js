"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const REPOSITORY = "src/core/inventory/flat_inventory_item_repository.js";
const STACKING = "src/core/inventory/inventory_item_stacking_policy.js";
const MIXED = "mixed-responsibility-requires-decomposition";
const REVIEWED = Object.freeze([REPOSITORY, STACKING]);

// Stage 3.22 backlog task stage-3.22.prerequisite.inventory-decomposition, transition 2 (owner decisions
// 2026-09-28, points 1-2): the decomposition review found no mixed responsibility in the flat item
// repository and the stacking policy. Their blockers are removed without a source edit, on evidence
// recorded from the re-observed Manifest, the policy and the known-debt registry (permitted dependency
// boundaries, no browser API, no DEV, no known debt) with the unchanged source hashes pinned.
module.exports = Object.freeze({
  sequence: 12,
  slug: "inventory-reviewed-reclassification",
  afterBatch: "038",
  backlogTaskId: "stage-3.22.prerequisite.inventory-decomposition",
  intent: "Inventory decomposition 2: evidence-backed removal of the mixed-responsibility blocker from the unchanged FlatInventoryItemRepository (one owner of item records and their location invariants) and InventoryItemStackingPolicy (a stacking-identity rule over saved item records); follow-ups recorded: clock/instance-id injection and removal of visual fields from saved items.",
  sourceEdits: Object.freeze([]),
  reviewedWithoutEdit: REVIEWED,
  manifestUpdates: Object.freeze([
    Object.freeze({ currentPath: REPOSITORY, removedBlockers: Object.freeze([Object.freeze({ blocker: MIXED,
      reason: "One authoritative owner of inventory item records: location and attachment invariants, splitting, merging through an injected stacking policy and snapshots; no player-facing text, configuration, browser or DEV coupling (recorded evidence). The fallback instance id uses the JavaScript Date builtin, not a browser API (migrated Domain precedent: Math.random defaults). Follow-up: inject a clock / instance-id factory (Stage 4)." })]) }),
    Object.freeze({ currentPath: STACKING, removedBlockers: Object.freeze([Object.freeze({ blocker: MIXED,
      reason: "The ignored keys name fields of saved item records (including the rating/power colour fields legacy saved items carry), not UI behaviour; changing them would change stacking and old-save compatibility. Follow-up: remove visual fields from saved items (Stage 4/5)." })]) }),
  ]),
  resolvedDebtIds: Object.freeze([]),
  expectedEdges: Object.freeze({ removed: Object.freeze([]), added: Object.freeze([]) }),
  // No behaviour can change: the reviewed sources are outside the write set; their bytes are pinned.
  parity({ read }) {
    const facts = REVIEWED.map(file => {
      const source = read(file);
      assert(!/[Ѐ-ӿ]/u.test(source), `reviewed source holds player-facing text: ${file}`);
      return [file, crypto.createHash("sha256").update(source).digest("hex")];
    });
    const text = JSON.stringify(facts);
    return { cases: facts.length, factsSha256: crypto.createHash("sha256").update(text).digest("hex") };
  },
});
