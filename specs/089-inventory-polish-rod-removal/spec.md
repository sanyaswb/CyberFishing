# Item editor scrolls under the section tabs, hidden keepnet help, rod removal only for a full rod

Owner request, 2026-10-16. No version bump.

## Portrait item editor scrolls under the section tabs

Owner screenshot (portrait, rod editor): the editor's content stopped above the bottom tab row with a hard edge, so the
row looked like a second background strip under the buttons. Owner decision: only in the item editor the content
scrolls under the tabs, which lie on the full-screen container; elsewhere each section's own container clips its
scrolling, as before. The active tab's frame stays visible and everything behind it shows through (its fill is not
needed); inactive tabs keep their fill.

Portrait, `.inventory-modal--section-equipment:has(.inventory-assembly-editor)`:
- `.inventory-main__left` (the scroller) spans the content and tab rows (`grid-row: 2 / 4`);
- the editor's bottom padding clears the tab bar (`100cqi * 0.15`, the bar height of section-tabs.css, plus the
  container gap), so its last content can scroll above the tabs;
- `.inventory-main__tabs` lies on top (`z-index: 1`), its active tab is transparent, and the bar passes touches through
  its gaps to the content (`pointer-events: none`, tabs `auto`).

Earlier attempts (3e4fbfe9: sidebar surface moved onto the content; 9647f280: transparent tab fills everywhere) are
reverted to the pre-089 tab and sidebar styles. Measured with the owner's permission in the in-app browser at
360 x 740 (computed styles and geometry only): outside the editor the content ends at 687 px above the tabs (686 px);
in the editor the scroller runs to the bottom (106-741 px) under the tabs, the active tab is `rgba(0, 0, 0, 0)`, a tap
in a tab gap reaches the editor, and fully scrolled the last parameter ends at 665 px, above the tabs.

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
