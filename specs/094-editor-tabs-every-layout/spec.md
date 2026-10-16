# Item editor tabs in every layout, no scales in tabs

Owner request, 2026-10-16. No version bump until the owner's command.

## Changes

1. **One editor for PC, landscape and portrait.** The phone item editor of spec 091-093 is the editor everywhere:
   the actions panel (one row), the square preview panel and the tabs block — one row of tabs (the item, each cell,
   nested items) joined to the active tab's parameter panel. The separate cell grid
   (`inventory-assembly-editor__sockets`) and the stacked parameter sections are no longer rendered; the
   `inventory-assembly-workspace` container query that only served them is removed. `__workspace` stays as the
   preview's DOM group (`display: contents`). Timer updates refresh the parameters of every tab item in place
   (`InventoryEditorTabsRenderer.items`), equal items in different cells included.
2. **Swipes everywhere.** `--inventory-editor-swipe: on` is set on the modal in every layout; the section tabs hide
   and the section swipe stops only in portrait (spec 091), so on PC the left column keeps its section tab bar.
3. **No scales in tabs.** Tab cards are rendered without a resource meter (condition, line, charge), and
   `InventoryItemCardRenderer.updateDynamicVisuals` keeps it off: a card rendered with `showResourceMeter: false` is
   marked `data-resource-meter="off"`. Before, the 250 ms dynamic refresh added the meter back to every card, which is
   why the owner still saw scales in the tabs. Other cards keep their scales.

4. **Landscape: the open tab's artwork on the left.** In landscape orientation (PC, a phone held sideways) the active
   tab's card or cell keeps the cell square at the tab's left edge (inside the inset); portrait centres it in the wider
   tab (spec 093). Measured at 1280 x 800: active square at the tab's left inset, same 48 px as the other tabs; at
   360 x 740 still centred.

Spacing follows the container gap of each layout (20 px on wide screens, 10 px on phones); the active tab's join
fillets keep the panel radius.

## Verification

In-app browser, computed geometry only: 1280 x 800 (editor 430 px wide in the left column, preview 378 px square, full
tab row 378 px, active tab 86 px joining the panel, section tab bar kept), 740 x 360 (same structure; the editor
scrolls inside its 185 px), 360 x 740 (unchanged from spec 093, section tabs hidden); no meters in tabs after timer
updates. Inventory UI check: editor DOM order, no cell grid, tab-page parameters, meter-off cards after a timer
update; CSS usage, Architecture, Quick, Full; game-cycle unchanged.
