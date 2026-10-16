# Inventory cards and editor polish

Owner request, 2026-10-16. No version bump until the owner's release command; release = commit, push develop and
publish gh-pages.

## Decisions

1. **Active section tab fill restored in the editor.** Spec 089's editor-under-tabs layout stays; the active tab keeps
   its fill (`--inventory-equipment-tab-active`), which the owner prefers to a see-through tab.
2. **Equip flash twice.** `inventory-equipped-flash` runs two pulses in one animation: the first as before
   (2 x `--ui-duration-normal`), the second 1.3 times slower (2.6 x); each peaks at 0.4 opacity at 30% of its time.
3. **No incomplete marker for missing consumables.** Bait (hook) and tackle chum (feeder rig) are filled through the
   header switchers (spec 074), so an empty bait/chum slot no longer marks a card incomplete (the red dot).
   `AssemblyCompletionPolicy.analyze` takes `ignoredSlotIds`; `InventoryItemTreeViewFactory` adds `equipmentCompletion`
   (ignoring `HEADER_CONSUMABLE_SLOT_IDS = ["bait", "chum"]`, owned by `EquipmentConsumableTargetResolver`) beside the
   unchanged `assemblyCompletion`; the card's incomplete dot reads `equipmentCompletion`. Boat cargo still counts.
4. **Card artwork centred; squares 1.5x.** The item artwork (`inventory-item-card__visual`) is absolutely positioned
   over the whole card (inside its padding) and centred; the small equipment squares and the resource meter keep their
   own places and lie above it, so they no longer push the artwork off centre. The squares are 1.5 times larger
   (33% instead of 22% of the card, still bounded by the space they have) with proportional contents (glyph cap
   20 -> 30 px; images fill the square). Scales are not enlarged.
5. **Boat scale without the lightning.** The energy (boat charge) meter has no icon.
6. **Phone editor actions in one row.** Up to 820 px the item editor's actions (equip/remove, disassemble, back) share
   one row with the mobile gap; long labels end with an ellipsis.

Unchanged by owner decision: a first tap on a filled cell in the item editor keeps its current behaviour.

## Verification

Inventory UI check (artwork, squares, layering, flash keyframes, phone actions, no boat icon, incomplete-dot fixtures on
`equipmentCompletion`), inventory integration check (a hook without bait is complete equipment while its assembly still
lists the empty bait slot), CSS usage, Architecture, Quick, Full; game-cycle digest unchanged. No browser measurement
for this spec; owner visual check on the phone after the release.
