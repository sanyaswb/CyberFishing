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
