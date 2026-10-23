# Feature Specification: UI catalog as a compact landing page

**Created**: 2026-10-23
**Status**: Implemented in v0.47.7 (Q2 in v0.47.8, Revision 2 in v0.47.9); owner visual acceptance pending
**Input**: Власник 2026-10-23: каталог UI виглядає жахливо. Оформити як стилізовану landing page, просту в реалізації
й мінімалістичну: компоненти згруповані по секціях (кнопки окремо, інші групи окремо), сторінка не тягнеться донизу,
мінімум тексту (повзунок, список, що випадає, зрозумілі без пояснень), значення лише 0 / 50 / 100 %, розмір вікна
прикладу змінюється перетягуванням краю замість шаблонів ширин, без скролбарів у контейнерах, без порожнього місця
навколо маленьких компонентів.

## Problem

`ui-catalog.html` (spec 057) is one long column: every component has a title, a paragraph of description, a contract
line, a list of sources, a state list, a width list of 13 fixed widths and a tall stage inside a scrolling viewport.
Readings go through 0/1/34/67/100 % and free ranges (-10..110). Small controls sit in large empty stages.

## Decisions

- D1 Groups as tabs. Each definition names its `group`; `UI_CATALOG_GROUPS` gives the order and short names:
  Кнопки (close button + A switch, radial selector), Шкали (meters), Інвентар (inventory, keepnet), HUD, Будинок.
  A sticky top bar holds the return arrow, the name and one pill tab per group. Only the active group is shown, so the
  page stays within a screen or two. A group's examples are mounted when its tab is first opened and kept afterwards
  (hidden groups are never measured at zero size). The URL hash selects a group (`#hud`).
- D2 One card per example: a one-line bar (name, state list, value slider when the example has a reading, size
  readout) above a live frame. Description, contract and sources stay in the definitions (the check still requires
  them); the description is the name's tooltip, nothing else is printed. Examples no longer write explanatory status
  text; the status line shows only feedback of a clicked control or an error and disappears when empty.
- D3 Resizing (owner: "подумай як це краще"). The frame is the existing `UiSurfaceAdapter` host; dragging its right
  edge, bottom edge or corner changes the host's size, and the components follow their existing logic (the surface
  scales below 320 px, the inventory's container queries react to the surface). No iframes or one canvas per window:
  one DOM tree per example is already how production lays out; an iframe per card would load the whole style set again
  for each card. Arrow keys on a focused handle change the size by 10 px, a double click restores the card's default
  size. Size is bounded (120..the page's width, 48..1600 px) and written only when it changes.
- D4 Default sizes per definition (`size: { width, height }`), small for small controls: the buttons card is 320 x 72,
  the meters card 320 x 64. No fixed width list.
- D5 Readings take three values: the slider runs min..max in two steps (0 / 50 / 100 %; keepnet live bait 0 / 300 /
  600 s). The value is applied after every state change, so the slider and the example agree. The meters card shows one
  row (resource, condition, occupancy) driven by the slider instead of five fixed rows.
- D6 No scrollbars on the catalog page: scrolling still works (wheel, touch, drag), only the bars are hidden
  (`scrollbar-width: none` and `::-webkit-scrollbar`), for the page and inside previews. Catalog-only rule; production
  styles are not changed. **Owner question Q1:** keep hidden bars inside previews, or show the production bars there?
- Q2 (owner 2026-10-23: shorten to 3-5 main states per card, v0.47.8): selector normal/open/equipment/classic;
  controls normal/enabled/disabled/empty; meters normal/zero/missing; inventory normal/empty/locked/assembly/error;
  keepnet normal/empty/reserved/over/error; house normal/section-open/empty/renovating/night; HUD
  normal/open/active/aiming/night. The examples still handle the removed states (the house check drives them directly).

## Revision 2 (owner 2026-10-23)

Owner: still bad. Show only the chosen part, windows centred, default 320 x 640; the keepnet is not separate from the
inventory; split the inventory into blocks (left panel, section tab row, filters, item list, header); the owner chose a
crop window per block and one block at a time through a second tab level.

- R2-D1 Second tab level: a group with several cards shows a row of card tabs; only the chosen card is on the page,
  centred. The hash is `#group/card`.
- R2-D2 Every frame starts at 320 x 640 (`UI_CATALOG_FRAME_SIZE`); the per-definition sizes are removed.
- R2-D3 Block crop: a block card builds the whole production inventory on a surface of the resizable size; the window
  takes the block's rectangle (the first visible match of the block selector) and the surface is shifted so only the
  block shows. `UiCatalogBlockCrop` re-measures on surface, content and block size changes and after a state change,
  and writes only changed values. Without a visible block the whole surface shows.
- R2-D4 Inventory cards: Весь, Ліва панель (`.inventory-main__sidebar`: loadout panel or backpack plus the section
  tabs), Вкладки (`.inventory-section-tabs__list`), Фільтри (`.inventory-list-panel__controls`), Список
  (`.inventory-list-panel__items`), Заголовок (`.inventory-header`), Садок (the same inventory opened at its keepnet
  section, keepnet states and live-bait time). The standalone keepnet view and its example are removed.

## Requirements

- FR-001: Every definition belongs to exactly one known group; every group has at least one definition.
- FR-002: Opening a group mounts its examples once; switching back does not mount them again; disposal releases all.
- FR-003: Edge dragging changes only the dragged axis, stays within bounds, writes styles only on a change, and its
  listeners are released with the page. Double click restores the default size.
- FR-004: Readings offer exactly three values and are re-applied after a state change.
- FR-005: Production components, styles and fixtures stay the only sources of what a card shows (spec 057).

## Checks

`ui-catalog` (Architecture): groups/definitions coverage, lazy group mounting and disposal with a DOM double, the
resizer's axis/bounds/no-op writes/reset/keyboard/disposal, three-step readings, the meters example's one row. Full.

## Owner acceptance

- [ ] dev.html → DevTools → каталог UI (and `ui-catalog.html` directly): tabs switch groups, cards are compact, a card
  resizes by its right/bottom edge and corner, double click restores it, sliders have three positions, no scrollbars.
  No visual check was done by the agent.

## Implementation evidence

- `UI_CATALOG_GROUPS` + `group`/`size` per definition (`ui_catalog_definitions.js`); the fixed width list is removed.
- `UiCatalogPage` builds the tabs, mounts a group on first opening (`selectGroup`), cards with name (description as
  tooltip), state list, three-step range and size readout; the hash follows the open group (`history.replaceState`).
- `UiCatalogFrameResizer`: right/bottom/corner handles, pointer capture, arrow keys, double-click reset, bounds
  120..page width x 48..1600 px, writes `--ui-catalog-frame-width/height` only on change and asks the surface to measure.
- Meters example: one row driven by the slider. Inventory, keepnet, house and HUD examples write no explanatory status.
- `ui-catalog.css` rewritten (sticky bar, pill tabs, cards, hidden scrollbars); the example placement rules are kept.
- `ui-catalog-check`: groups coverage, lazy mounting/disposal, readings, resizer axis/bounds/no-op/keys/reset/disposal.
- Revision 2 (v0.47.9): `UiCatalogPage.select(group, card)` with card tabs (`ui-catalog__cards`), one card shown and
  mounted once; `UI_CATALOG_FRAME_SIZE` 320 x 640; `UiCatalogBlockCrop` (frame `--ui-catalog-crop-*`, stage
  `ui-catalog-card__stage` at the surface size); inventory cards built by one factory (`example: "inventory"`,
  `focus`, `section`) with the keepnet attached through `InventoryUiBootstrap.createKeepnet`; the standalone keepnet
  example and its placement CSS removed. `ui-catalog-check`: tab levels, crop, inventory-with-keepnet scenario.
