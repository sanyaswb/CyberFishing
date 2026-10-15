# Transparent section tab bar, hidden keepnet help, rod removal only for a full rod

Owner request, 2026-10-16. No version bump.

## Section tab buttons without their own background

The dark grey the owner saw is the bottom section buttons' own fill: inactive tabs `--inventory-equipment-tab`
(#262626), the active one `--inventory-equipment-tab-active` (#303030) with square bottom corners. Above a transparent
section (an item editor in portrait) the active tab stood out as a separate grey tile.

`.inventory-main__tabs` sets both tokens to `transparent`: the buttons stand on their parent container — the sidebar on
wide layouts (spec 077, unchanged), the full-screen container in portrait. The active tab keeps its frame
(`--inventory-equipment-tab-border`) and light icon. The backpack/keepnet pager tabs keep their colours to join their
items panel.

A first attempt (3e4fbfe9) moved the sidebar's surface onto the section content instead; it did not touch the buttons'
fill and is reverted. Measured with the owner's permission in the in-app browser, portrait 360 x 740 with the rod
editor open (computed styles only, no screenshots): bottom tabs `rgba(0, 0, 0, 0)`, active frame `rgb(123, 123, 123)`,
pager tabs unchanged, no other background between the full-screen container and the tabs.

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
