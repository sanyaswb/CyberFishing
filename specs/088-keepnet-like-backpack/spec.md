# Keepnet section laid out like the backpack section

Owner request, 2026-10-16. Five points: (1) keepnet filters in the backpack's filter style and place, (2) the capacity
bar as the backpack's scale with the existing fish icon on the left and the counter centred on the meter, (3) two
pages like the backpack's — fish on the left, the keepnet image with its parameters on the right, (4) the backpack
section's container nesting, (5) the same styling on wide (PC) layouts.

Interpretation of (3): the right page shows the **keepnet** image and parameters (the backpack's counterpart), not the
backpack.

## Structure

Right host, every layout — the shared collection (spec 074), nested like the backpack's:

```
keepnet-section__content.inventory-collection
  keepnet-section__controls.inventory-collection__controls.inventory-panel
    keepnet-section__filters (display: contents)
      nav.inventory-categories      species toggle (▾/▴) + kind buttons (Уся риба, Забраний улов, Живці)
      div.inventory-subfilters       species radios (Усі види + species), opened by the toggle
    keepnet-section__detail          back + species heading; hidden (no gap) outside species details
  inventory-pager                    tabs Риба | Садок (portrait only)
    keepnet-section__items.inventory-collection__items.inventory-panel (the pager viewport)
      page fish:    faded keepnet backdrop + fish list
      page keepnet: keepnet view (portrait only)
```

Keepnet view (`KeepnetOverviewRenderer`), the counterpart of `InventoryBackpackSummaryRenderer`: an image container
(keepnet image, help button) and a stats container (capacity scale, status line). Two instances: the left column's
summary (wide layouts) and the pager's second page (portrait). Both update together; both help buttons open the one
help hint.

Capacity scale: `InventoryScaleRenderer` with `iconHref` (sprite symbol drawn in `currentColor`) — the existing fish
icon `assets/ui/status-icons.svg#fish` (House capacity) on the left, the shared meter, the reading `n / capacity`
centred on it. Occupied space fills the meter; its colour follows the free space (`remainingPercent`, as before).
The fish tab icon is the same drawing added to `assets/ui/inventory-sections.svg` (the tab sprite).

## Behaviour

- Kind buttons and the species radios keep the existing filter values (`kind`, `speciesId`); the species row is
  closed by default, like the backpack's subfilters.
- The keepnet pager swipes like the backpack's in portrait (spec 087 flag); a swipe past the fish page returns to the
  backpack (entering on its Backpack page), the keepnet page is the end of the chain. Opening the section starts on
  the fish page.
- Portrait hides the keepnet's left column like the backpack's; wide layouts keep the keepnet view in the sidebar
  and show only the fish page.

## Ownership and CSS

`InventoryUiBootstrap.createKeepnetView` builds the view with its collaborators for production and the UI catalog;
`InventoryUI.swipeSection` is public for section pagers. CSS: `.keepnet-overview*` join the backpack view's rules in
`loadout.css`; the controls panel layout moves from `.inventory-list-panel__controls` to the shared
`.inventory-collection__controls`; pagers hide/show every page after the first (`:not(:first-child)`), not only the
backpack page; the old keepnet summary grid, select styles and portrait summary rules are removed.

## Verification

Keepnet check: structure, filter rows and their filtering, two views, fish scale, pager swipes and edges. Inventory UI
check: CSS rules updated for the shared rules. Architecture, Quick, Full; game-cycle digest unchanged. No gameplay,
save or formula changes. Owner visual/touch check; no browser testing by Claude.
