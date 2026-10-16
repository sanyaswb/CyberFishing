# Phone item editor: first round of fixes

Owner review of spec 091 on the phone, 2026-10-16. No version bump.

## Changes

1. **The active tab fills the row.** Inactive tabs keep the cell size; the active one grows into the row's free width
   (`flex-grow: 1`), so every gap is the same and selecting another tab widens that one. A root without cells keeps
   its tab at half the width (spec 091).
2. **Rounded joins.** Where the parameter panel continues beside the active tab, the join is a concave fillet of the
   panel radius on both sides (pseudo-elements in the gap above the panel); the panel's top corner is square only where
   the active tab is at the row's edge (`--first-active`, `--last-active`).
3. **The preview swipes too.** The editor passes its preview to the tabs renderer as an extra swipe surface; the same
   `SwipePagerController` (own flag, click suppression) switches the tab.
4. **Picking from the editor returns to it.** Inside an item editor only its own buttons leave it. An item activated
   while the editor is open (a pick for its empty cell or a list card) that ends on the equipment panel returns to the
   same editor (`InventoryCommandService#activateInventoryItem`); an item that opens its own editor keeps that editor.
5. **Sections keep the editor.** `SECTION_SELECT` no longer closes the editor when the backpack is chosen outside a
   pick; returning to Equipment (by tab or by the keepnet -> backpack -> equipment swipe chain) shows the same editor.
6. **Filled cells: tap shows, long press removes.** In the phone tabs a tap on a filled cell only shows its parameters
   (no command, no component editor); a long press (equipped duration) removes the item — `EQUIPMENT_SLOT_LONG_PRESS`
   for a rod's cells, the socket command for an assembly's filled socket. An empty cell keeps its tap (pick). Wide
   layouts keep the cell grid's current taps.

## Verification

Inventory integration check: a float picked from the rod editor is equipped and the editor stays; keepnet, backpack and
equipment keep the editor. Inventory UI check: filled cell tap selects without dispatch, long press dispatches the
socket command, the preview swipe switches the tab. CSS usage, Architecture, Quick, Full; game-cycle unchanged.
