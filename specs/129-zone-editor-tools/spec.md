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

## Revision 2 (owner, 2026-10-22, after v0.46.14)

Owner's corrections (TK-044…TK-048), DEV only:

1. **Редактор → Увімкнути** is the first item: on means the editor shows the zones, their edges can be dragged and the
   cell grid turns on; "Показати редактор" and "Перетягувати межі" disappear as separate switches. "Показати фон"
   stays.
2. **Сітка перспективи** (was "Метрова сітка") becomes its own section holding everything of "Геометрія й
   перспектива" for the water: show the grid, the projection's physics (on = the location has `waterProjection`,
   off = uniform water), grid step, water length, tilt, far scale, width contraction, status, reset/export/import.
3. **Several zones at once:** the selected zone is filled, the other visible zones are muted (faint fill and outline).
   The zone fill is no longer a separate switch: it works under the hood (`debugZones` is removed).
4. **Сітка клітинок** is its own section: show, opacity slider 0–100, line step (every N-th cell), snap step in cells,
   cell size in px (`locations.cellSize`, which defines the map grid of the game), and the depth numbers with their own
   opacity slider (`debugGrid`, `debugDepthText`, `debugOpacity` are removed from the config: the editor owns them).
5. **Зони** (was "Категорії в редакторі"): one collapsible list per category with its colour square: "Ігрова область
   (закидання)", "Перешкоди", "Зачепи", "Рухомі зони". The list's first switch turns the zone's physics on
   (`enableCastable`…); only then its items appear: show the zone in the editor, the zone number (selecting it for
   dragging), its coordinates (x/y/w/h, bounds), add and remove. "Зони в грі" disappears.

"Оверлеї гри" keeps its switches; its first one is the master `debugVisuals` ("Показувати оверлеї гри").

### Decisions

- **R1** `ZoneEditorState`: `enabled` (one switch, also enables dragging and turns `cellGrid` on), `background`,
  `grid` (perspective grid), `cellGrid`, `cellGridOpacity` (0..1), `cellLineStep` (1..10 cells), `snapCells`
  (1..10), `depth`, `depthOpacity` (0..1), `categories`, `selection`. `dragEdit` is removed.
- **R2** Geometry: every zone rect carries `fillAlpha` and `strokeAlpha`; the selected one 0.35 / 0.95 with handles,
  the others 0.04 / 0.35. Cell lines carry the model's `cellLineAlpha` and are drawn every `cellLineStep` cells.
- **R3** Depth numbers come from the location debug map built with the editor's state (depth only, its opacity) while
  the editor is on; without the editor nothing is drawn. `LocationMap` stops tracking the removed debug flags.
- **R4** Drag snaps to `snapCells` cells; it is active whenever the editor is on.
- **R5** Projection physics off writes `waterProjection: null` through the config path; the schema and the resolver
  treat `null` as "no projection" (uniform water); on adds the projection with the current uniform length and defaults.
- **R6** "Розмір клітинки" writes `locations.cellSize` (5..200 px) and says it changes the game's map grid.

### Revision 2 implementation (v0.46.15)

- `ZoneEditorState`: `enabled` (also turns `cellGrid` on), `depth`, `cellGridOpacity`, `depthOpacity`, `cellLineStep`,
  `snapCells` with `setNumber()` clamping; `dragEdit` removed.
- `ZoneEditorGeometryBuilder`: selected zone fill 0.35 / stroke 0.95 / width 3 with handles, others 0.04 / 0.35; a
  category is drawn only while its `enable*` physics is on; cell lines every `cellLineStep` cells at
  `cellLineAlpha`. Both annotation renderers read `strokeAlpha` and `cellLineAlpha`.
- `LocationDebugRenderFrameBuilder` draws only the editor (geometry, drag layer sync) and, with `depth`, the depth
  map at `depthOpacity`; `LocationDebugMapBuilder` writes only the water cells' depths. Moving zones are the editor's
  overlay.
- `ZoneEditorDragController` is active whenever the editor is on; it snaps to `cellSize × snapCells` pixels and stores
  design cells (`designCellSize`).
- `ZoneEditorSection` rewritten: Редактор, Зони (four lists, physics switch first, items only while on), Сітка
  клітинок, Сітка перспективи (show, projection physics → `waterProjection: null` when off, step, projection values,
  status, reset/export/import), Оверлеї гри (`debugVisuals` first). `DevToolsUI.createRangeRow` (0..100 slider,
  `devtools__range`).
- Removed `locations.debugZones`, `debugGrid`, `debugDepthText`, `debugOpacity` from the config and their tracking in
  `LocationMap`; the schema accepts `waterProjection: null`.
- Checks: `zone-editor` Revision 2 block, `config-runtime` (map flags), `config-schema` (null projection).
  Full 66/66, game-cycle unchanged.

## TK-049 defaults (v0.46.16)

Owner 2026-10-22: zone physics of every category is on by default (`CONFIG.locations.enable*` = true), the editor's
"Показати зону" switches and the depth numbers start off. Gameplay entry G-117; game-cycle report unchanged.

## TK-050 perspective grid default (v0.46.17)

Owner 2026-10-22: turning the editor on must not show the perspective grid. `ZoneEditorState.grid` defaults to false;
enabling still turns the cell grid on.

## TK-051, TK-052 (v0.46.18)

Owner 2026-10-22: deleting a zone removes it even when it is the last one, and the delete button disappears with no
zones left (LocationMap keeps whole-map bounds without castable zones, G-118). While the editor is on, the game's UI
(`.ui-surface__content`: toolbar, controls, windows) is hidden through the body class `game-shell--zone-editor`;
DevTools, its toggle and DEV overlays stay.

## TK-053 DevTools from the left edge (v0.46.19)

Owner 2026-10-22: while the editor is on, the DevTools button hides too; the panel opens from a 16 px strip at the
left screen edge (`DevToolsEdgeOpener`, owned by DevToolsUI): a mouse entering it with no button held, a mouse press,
or a finger swiping right at least 24 px. The strip is shown only under `game-shell--zone-editor` and sits under the
open panel. Note: it also covers zone edges within 16 px of the screen's left side.

## Revision 3 (owner, 2026-10-22, after v0.46.19)

Owner: "кнопка на весь екран не клікабельна під час редагування - її прибери теж"; an invisible selected zone could be
dragged ("я тільки що невидимі зони порухав"), which is not intuitive; the whole zone should move from its middle.

- **R3-1 (TK-054) Fullscreen button.** Hidden with the rest of the game UI while the editor is on. Cause: its own
  rule sets `visibility: visible`, which overrides the hidden `.ui-surface__content`; the editor rule now hides every
  descendant.
- **R3-2 (TK-055) Editable zones and hover.** The "Редактор" section lists, right after "Увімкнути", every zone of each
  category whose physics is on ("Зони для редагування": one switch per zone, the category colour, "<category> N").
  A checked zone is editable: it always shows a 2 px outline of its colour, and only editable zones can be dragged.
  The pointer over an editable zone (inside it or within the edge band) fills it while it stays there; every hovered
  editable zone fills, so a small zone inside a large one fills together with it; leaving clears the fill. A permanent
  fill is the category's "Показати зону". Zones neither editable nor shown are not drawn. By default no zone is
  checked; a zone added with "Додати зону" is checked; deleting a zone shifts the checks of the later ones. When several
  editable zones are under the pointer, the smallest one that offers an edge or its middle is taken, and the drag
  selects it in its list. The "Редагувати цю зону на мапі" button is removed (the list's "Номер зони" picks the
  parameter tree).
- **R3-3 (TK-056) Move.** The middle 30% of a zone (30% of its width and height, centred) takes the whole zone: it
  moves snapped to the cell step without changing its size (an adaptive-width zone moves only vertically). The middle
  wins over the edges, so even a small zone can be moved. A hovered editable zone shows its move area and corner handles.

Implementation (v0.46.20): ZoneEditorState.editable/hovered (keys "<category>:<index>", zoneRemoved shifts them,
setHovered rebuilds only on change), MOVE_SHARE; geometry builder draws editable/hovered/shown looks; drag controller
scans editable zones (smallest hit wins, middle before edges, pointerleave clears the hover, the taken zone is selected);
ZONE_PHYSICS_KEYS shared in zone_category_colors.js; CSS hides every .ui-surface__content descendant.

## TK-057, TK-058 (v0.46.21)

Owner 2026-10-22: the move area is not drawn (it distracted); the middle still moves the zone. A zone moved by its
middle stays inside the game window (the canvas in map coordinates); a zone larger than the window along an axis only
slides while it still covers the window. Travel is limited in whole snap steps from the start, so the zone keeps its
offset to the cell grid. Resizing by the edges is not limited.
