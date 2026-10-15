# Transparent section tab bar, hidden keepnet help, rod removal only for a full rod

Owner request, 2026-10-16. No version bump.

## Section tab bar without a wrapper background

The bottom tab bar (Equipment, Backpack, Keepnet) stood on the dark grey surface of its parent, the left column's
`inventory-main__sidebar` (spec 077), which shows on wide layouts as a wrapper around the tabs. The sidebar now paints
no background; the section content above the bar (`.inventory-main__sidebar > .inventory-main__left`) paints the
column's surface with top-rounded corners, so the tabs stand on the page background and the active tab still joins the
content. Portrait is unchanged (the sidebar has no box there and the full-screen container is the background).

## Keepnet help button hidden, component kept

The "?" on the keepnet view's image (the keepnet's counterpart of the backpack view, spec 088) is not needed there for
now. `KeepnetOverviewRenderer` takes `showHelp` (default true); `InventoryUiBootstrap.createKeepnet`/`createKeepnetView`
pass `showHelp: false` for the game and the UI catalog. The button, its hint and the dismissal logic stay; the keepnet
check exercises them with `showHelp: true` and asserts that the game shows no button.

## Rod removal: the save prompt only for a fully equipped rod

Owner rule: a long press on an unsaved rod offers "Save as a loadout / Disassemble" only when the rod is fully
equipped — every first-level cell it shows is filled (reel, line, tackle, float, as the rod's capabilities make them
visible, `EquipmentSlotVisibilityPolicy`). An incomplete rod, including a bare rod, comes off at once without the
prompt: its components return to the backpack as they are (assemblies keep their attachments, line keeps its length),
and no loadout is created. Before, any main component triggered the prompt. A saved rod still returns to its loadout
without a prompt.

`InventoryCommandService` receives `slotVisibilityPolicy` (the composition root's `visibilityPolicy`) and decides in
`#isRodFullyEquipped`; the "Remove" button of the rod's editor follows the same rule (same `#unequipSlot`).

## Verification

Inventory integration check: the rod-removal fixture is now a full pole rod (float added; card attachment, member and
repository counts follow), and a new scenario removes an incomplete rod without the prompt and keeps its components
intact. Inventory UI check: the sidebar paints no background, the content does. Keepnet check: help hidden in the game,
the component still works. Architecture, Quick, Full; game-cycle digest unchanged. Owner visual check; no browser
testing by Claude.
