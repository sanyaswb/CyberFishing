# Wide and landscape item editor: parameters scroll under the section tabs

Owner report, 2026-10-16: in landscape the editor's parameters were clipped at the top edge of the section tab bar, so
the bar looked like it stood on its own background strip. The owner had first suspected the bar's background; the cause
was the editor's clip edge. No version bump until the owner's command.

## Change

While an item editor is open in the equipment section of a wide or landscape layout (the section tabs are visible in
the left column), the editor runs to the bottom of the column and the tab bar lies over its bottom edge
(`position: absolute; bottom: 0; z-index: 1` inside the now positioned `inventory-main__sidebar`). The parameters
scroll under the tabs and are clipped only by the column, as on phones. The bar passes touches through the gaps
between its tabs (`pointer-events: none`, tabs `auto`). The editor's bottom padding adds the bar height (15% of the
column width, the bar's own `100cqi * 0.15`), so its last content can scroll above the tabs. Portrait phones keep
hiding the section tabs in the editor (spec 091) and keep the plain container padding.

## Verification

In-app browser, computed geometry only. 1280 x 800: editor 89-782 px (the column's bottom), tab bar 718-782 px over
it, fully scrolled the parameter panel ends at 696 px above the bar, a point between two tabs hits the editor, a tab
point hits the tab. 740 x 360: editor 110-351 px, bar 296-351 px, panel ends at 284 px. 360 x 740: section tabs
hidden, editor padding 10 px. Inventory UI check asserts the overlay, the pass-through, the clearing padding and the
positioned column. CSS usage, Architecture, Quick, Full; game-cycle unchanged.
