# Zone editor: one place, colours, map grid and edge dragging

Owner request, 2026-10-22 (tasks TK-040…TK-043). Status: implemented in v0.46.14; owner acceptance pending.
DEV only: production never composes the zone editor, the location debug map or the drag layer.

## Requests

1. A colour square next to every zone category name, matching the colour the zone is drawn in.
2. In "Locations / Zones" the white grid and the depth numbers do not appear when switched on: check every switch.
3. Move "Locations / Zones" into the zone editor and structure it clearly.
4. In the zone editor, take any edge of the selected zone with the mouse (or a finger) and drag it, snapped to the
   map grid; the map grid is not shown today.

## Findings (verified in the code)

- **Hidden master switch.** The location debug map (`LocationDebugRenderFrameBuilder`) draws only while
  `isDebugEnabled()` is true, which needs the DEV overlay, debug events or a console module. With the overlay off
  (its default) `debugVisuals`, `debugGrid` and `debugDepthText` do nothing, and nothing says why.
- **Editor hides it.** While the zone editor is on, the builder returns before the debug map
  (`if (target.annotations) return;`), so the grid and depth numbers vanish exactly when they are needed.
- **The grid is almost invisible.** Cell lines are `rgba(255,255,255,0.05)` under the map's `debugOpacity` 0.7:
  about 3.5 % white on a dark picture.
- **Duplicated switches.** The zone editor already has the overlay switches (`showChumZones`…); "Locations /
  Zones" in DEBUG repeats them, and its keys are shown as raw config names.
- **Selection lives in the section.** The chosen category and zone index are private to `ZoneEditorSection`, so
  neither the drawn geometry nor an input tool can know which zone is selected.
- Colours: castable `#00ff80`, collisions `#ff4444`, snags `#ffcc00`, dynamic `#ff66ff` (editor geometry); the debug
  map uses the same hues with transparency.

## Decisions

- **D1 Colours (TK-040).** One frozen colour table in `src/dev/location/zone_category_colors.js` used by the editor
  geometry, the debug map fills and the swatches. `DevToolsUI` gets an optional swatch for a row label
  (`swatch: "#rrggbb"`, a small square before the text, `devtools__swatch`); the category select shows the swatch of
  the selected category beside it.
- **D2 Debug map (TK-041).** The location debug map follows `debugVisuals` and its own switches and no longer the
  global DEV debug flag. `debugVisuals` keeps its default (on): it also gates the game's fight-area overlays. The
  map is built only while one of `debugZones`, `debugGrid`, `debugDepthText` is on, and the moving (dynamic) zones
  are drawn with `debugZones`, so nothing new appears by default. The map also draws while the editor is on (depth
  numbers under the editor's outlines). Grid lines become `rgba(255,255,255,0.35)`. Every switch is exercised by the
  zone-editor check.
- **D3 Structure (TK-042).** The DEBUG section loses "Locations / Zones"; the zone editor holds, in this order:
  - **Редактор** — show editor, background, metre grid, map cell grid, minimum metre spacing, drag editing;
  - **Категорії в редакторі** — the four categories with swatches (visibility in the editor only);
  - **Зони в грі** — `enableCastable`, `enableCollisions`, `enableSnags`, `enableDynamicZones` with swatches
    (these change gameplay; the description says so);
  - **Оверлеї гри** — the `show*` switches (once);
  - **Налагоджувальна карта** — `debugVisuals`, `debugZones`, `debugGrid`, `debugDepthText`, `debugOpacity`;
  - **Геометрія й перспектива** — as today (zone select, tree, add/remove, metres and perspective).
  Labels are Ukrainian; each row keeps its config path (tooltips, bindings, export/import unchanged).
  `LocationDevToolsSchema` is replaced by the editor's own groups (no second owner of the same switches).
- **D4 Selection in the state.** `ZoneEditorState` owns `selection { category, index }` (with `select()` and
  revision), used by the section, the geometry (the selected zone is outlined thicker with corner handles) and the
  drag tool.
- **D5 Map cell grid.** `ZoneEditorState.cellGrid` (default on) draws the map's cell lines (`locations.cellSize`) over
  the whole map in the editor geometry, so snapping is visible; at most cols + rows lines, rebuilt only on change.
- **D6 Edge dragging (TK-043).** `ZoneEditorDragController` (DEV, `src/dev/location/`) listens on a transparent DOM
  layer over the game canvas that exists only while the editor and "drag editing" are on, so the game receives no
  input during editing (the DevTools panel stays above it). A pointer within 10 logical px of an edge of the selected
  zone takes that edge (a corner takes both); the edge follows the pointer and snaps to whole cells; the zone keeps
  at least one cell. Adaptive-width zones move their top and bottom only. Each change of the snapped value writes the
  zone array once through the same validated config path as the tree (`CONFIG.locations.map.<id>.zones.<category>`),
  so the map, physics and export follow at once. Hover shows a resize cursor. Moving the whole zone is out of scope.

## Checks

`zone-editor` (extended): swatch rows and select swatch; every debug-map switch changes the drawn map (zones, grid,
depth numbers, opacity) with the overlay off and with the editor on; grid alpha; the structured sections and their
paths; selection drives the outline; cell grid count and rebuild-on-change only; drag: edge and corner hits, snap to
cells, minimum one cell, adaptive zones vertical only, one config write per snapped change, no layer without drag
editing, layer removed on dispose. Full; game-cycle unchanged (DEV only).

## Owner acceptance

`dev.html`, desktop and phone: DevTools → 🗺️ РЕДАКТОР ЗОН. Colour squares next to categories; the debug map grid
and depth numbers appear when switched on (also with the editor open); the new structure reads clearly; with
"Перетягувати межі" on, drag each edge and a corner of the selected zone — it snaps to the visible cell grid and the
game does not react meanwhile. No visual check is done by the agent.

## Implementation (v0.46.14)

- `src/dev/location/zone_category_colors.js` (one table); `DevToolsUI` swatch option for switch rows and the select;
  `devtools__swatch` style.
- `LocationDebugRenderFrameBuilder`: follows `debugVisuals` + its map switches, draws under the editor, ignores the
  global DEV debug flag; moving zones only with `debugZones` and without the editor's own outlines. Map grid 35 %.
- `ZoneEditorSection` holds the six sections; `LocationDevToolsSchema` and DevTools' "Locations / Zones" were removed
  (no other consumer). `ZoneEditorState`: `cellGrid`, `dragEdit`, `selection`/`select()`, `subscribeZonesEdited`.
- `ZoneEditorGeometryBuilder`: shared colours, selected outline (width 3) with 8 px handles, cell lines in a separate
  list (`cellLines`), drawn by `PixiAnnotationRenderer` and `WorldDebugRenderer` under the zones.
- `ZoneEditorDragController` (DEV composition, `development_game_startup.js`): layer in the DEV mount, synced once per
  frame by the location debug builder, writes through the new public `DevTools.updateConfig`; disposed with the
  session and when the builder is rebuilt.
- Checks: `zone-editor` spec 129 block, `config-runtime` (drag tool wiring and disposal). Full 66/66, game-cycle
  unchanged. Utils cleanup: nothing became unused.
