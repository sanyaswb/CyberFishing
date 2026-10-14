# House review cleanup

Owner decision: 2026-10-14, the "minor" list from the House/DESIGN_RULES review (items 4–8). Each section is one
commit; behavior is unchanged unless a section says otherwise; the game-cycle baseline stays unchanged.

## 1. View texts in HOUSE_LABELS; unused presenter argument

- `HouseView` receives `labels` (HOUSE_LABELS) through its constructor like the presenter and feed picker; every
  player-facing literal moved from the view to the catalog (DEVELOPMENT_RULES "player-facing text lives in
  presentation catalogs injected through constructors").
- Fish counters use Ukrainian plural forms (1 риба, 2–4 риби, 5–20 риб, 21 риба …): previously "1 риб". This is the
  only visible text change; the automatic-feeder switch's initial name equals the label rendered right after it.
- Removed catalog entries no consumer reads (`speciesCount`, `emptyAquarium`, `feedNext`, `allFed`,
  `feedRequired`, `starvation`, `selected`, `success.buyFeed`, `success.selectFeed`); the empty-list and lost-bait
  labels now hold the texts the view displayed.
- House startup no longer passes `now` to `HousePresenter`, which never read it.

Evidence: house-check covers the plural table; House/catalog checks render through the injected labels.

## 2. Aquarium canvas: resize guard, injected colors, one visual rule set

- `AquariumFishView` assigns the canvas size only when the device-pixel size or ratio changes (DESIGN_RULES §13: an
  unchanged assignment resets the bitmap). 100 unchanged observer deliveries write nothing.
- Its Canvas colors (DEV zone grid, placeholder fish) come from the injected `AQUARIUM_FISH_VIEW_STYLE` descriptor.
- `CONFIG.liveBait.visual` has one rule set, `game/config/validation/aquarium_visual_issues.js`: the config schema
  reports it and bootstrap injects `isUsableAquariumVisual` into `AquariumFishMotion`, which used to repeat the
  rules inline. Numeric settings must be real numbers (a numeric string is rejected by both now).

Correction to the review: the schema already validated `liveBait.visual`; the defect was the duplicated rule set.

Evidence: house-check resize counters; live-bait shared-feed scenario rejects the same invalid settings the rule set
reports and accepts a valid grid edit; catalog and schema checks pass.

## 3. House stacking scale and redundant colors

- The eight House layers (room navigation 3, scrim 4, sheet 5, dock 6, renovation 10, notice 12, header 20, skip
  link 30) are `--house-layer-*` component properties in the `.house` block: one ordered list instead of numbers
  spread over the file. Values are unchanged; z-index inside one element (sticky handle, renovation controls) stays
  local. The House page has no `--ui-layer-*` overlays, so its scale stays component-owned.
- Removed House overrides equal to the inventory theme defaults (`--inventory-danger-background/-text`); the primary
  action's hover/text reference the control values they duplicated; the inventory theme's danger text uses
  `--ui-danger-text` (same value and meaning).

Correction to the review: most House colors already live in the `.house` theme block; the remaining literals have a
single consumer and stay local (docs/styles.md). No visual value changes.
