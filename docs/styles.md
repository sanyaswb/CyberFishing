# Presentation styles

Before design work, read [DESIGN_RULES.md](../DESIGN_RULES.md). It is the current owner policy for reuse, responsive behavior and component design; this document describes the existing style ownership and runtime boundaries. In particular, mobile inventory has four columns and mobile keepnet has two; earlier specifications retain their historical layouts.

Native HTML pages compose the stylesheet order. `index.html` loads 30 production assets;
`dev.html` reuses that exact prefix, appends the House stylesheet for the House screen it opens (spec 084) and three DEV assets. `ui-catalog.html` is an empty page. Every link uses the package
version. There are no CSS imports, runtime style installers or build requirements.

## Ownership

Spec 139/v0.47.1: rebuilding/reopening DevTools releases section subscriptions while retaining the active mesh draft.
Final tool disposal still stops it. DEV bootstrap alone attaches the bounded keyboard command transport; a local
server verifies commands and opens the panel idempotently. No code dictionary or offline matcher is shipped to the browser.

TK-075/v0.46.46: active mesh mode puts host geometry/shape/bounds and add/delete controls in the existing transparent
control group, using a disabled native fieldset with dimmed rows; mesh/number/opacity controls remain outside it.
Exiting/applying rebuilds the enabled group. A shared DEV mask-fill opacity (0–100%, default 30%) affects draft and
shown/hovered applied masks without changing topology/config. The editor's existing grid opacity drives cell,
mesh and perspective grid lines on both renderer paths; mask contours and outside-host dimming stay independent.

Spec 138: each ordinary zone has an optional applied mask and a separate DEV mesh draft (×2/×4).
Existing switch/select/action rows own the controls; raw mask arrays are excluded from the parameter tree.
LMB paints, RMB erases (click/drag), and only a side-connected nonempty draft can apply. Entering mesh mode immediately
dims the viewport outside the host rectangle; exit/selection/dependency changes remove focus and stale input.
Static, moving and mesh/focus annotation layers cache independently; the shared segment/fill commands serve WebGL and Canvas.
Masks control coordinate acceptance/contours and preserve normalized geometry across global-grid changes; depth stays separate. Applied castable masks also clip Pixi waves so excluded shore stays still.

Spec 137/v0.46.44: changing map cell size retains exact map-space zone rectangles, live moving-body positions and movement bounds. Authored coordinates remain in design cells; fractional runtime cell geometry is rasterized only for gameplay/depth queries. Water clipping uses design units. DEV geometry, pointer input, live-coordinate snapshots and depth overlays use the map's applied cell size while a config reload is pending. Subsequent snapped edits use one new cell; existing geometry is not snapped by a grid change.

TK-074/v0.46.43: editor on enables the cell grid; editor off clears both grid switches, leaving the independent depth display unchanged. Switches with unmet `requires` use a dimmed label/control, a not-allowed cursor and `aria-disabled`; explanation clicks still highlight the blocker, and switching an already-on value off remains possible. Availability updates on control changes, bound synchronization and panel opening, without polling; dependency rows are released with bindings and unchanged availability does not rewrite DOM state.

TK-073/v0.46.42: «Глибина в клітинках» is an independent display switch, usable while the editor is off. Its opacity and cached map do not depend on editing; enabling/disabling editing retains the chosen depth visibility. Editing controls keep their existing prerequisites.

TK-072/v0.46.41: the cell-grid controls are direct children of «РЕДАКТОР», immediately after background visibility; the former cell-grid subsection is removed. Visibility, opacity, cell size and depth controls retain their bindings and prerequisite behavior. Grid lines and snapped editing use one map cell; configurable line skipping and snap multipliers are removed. Dynamic-body and float translation remain continuous.

TK-065/v0.46.31: each zone-category dropdown retains its selected number. Only that number receives map hover/body input; clicking another body never selects it. Selection changes clear hover and cancel stale captures, including dynamic bounds; live targets also check their authored ID before writing.

Spec 135/v0.46.30: moving-zone creation reuses the existing select row for Circle/Square; the selected shape has one diameter/side input. Legacy unequal rectangles retain their dimensions and an explicit rectangle label. Circle annotations use the shared reusable geometry and native ellipse primitives in WebGL/Canvas; cardinal contour handles and input hit testing match the live body. No new CSS component or texture is introduced.

TK-013 (v0.45.33) groups DEV controls without changing config/override paths: top navigation and shop button,
then Overlay → CONFIG → DEBUG (one Inventory with Split), scene/zone editors, Database (locations/fish/items),
Spine (the skeleton name) and the final Service group (Runtime overrides / Item progression).
TK-035: the panel's last grid row `devtools__footer` (outside the scrolling body) shows the
`GameVersionBadge` text at UI-surface widths <=820 px, where the toolbar badge is hidden.
`DevToolsUI.createInfoRow` groups read-only rows in a collapsed `Опис` disclosure per parent. Its weak cache
preserves local expansion across refresh and rejects detached groups; editable controls remain in their original
parent and keep their bindings. Section titles are semantic buttons with `aria-expanded`. Hover/press on action
buttons changes only the background; keyboard focus keeps its outline. No polling or new global state.

TK-059: the location select is the first control in «РЕДАКТОР», followed by the editor controls without nested
«Локація»/«Редактор» disclosures. `DevToolsUI.createControlGroup` provides a `display: contents` refresh boundary
for location controls, so changing the location cannot remove the editor switches or other sections.

TK-061…063: «Зони → Показати всі» updates the existing category visibility flags; its value is derived from all
four flags, with no separate stored state. Zone visibility and the two grids work outside edit mode without a drag
layer or hidden game controls. Entering edit mode selects the cell grid; enabling either grid disables the other
and synchronizes both switches. Both grids start off and may be off together. Physics flags remain independent.

TK-064: `DevToolsUI` inserts each parent's controls/actions first, nested sections next, and its single «Опис»
disclosure last. Relative order within each category follows creation order. DOM order is also keyboard/reading
order; CSS does not reorder it. Transparent control groups share their parent's description and release only
their own info rows during refresh. Automatic CONFIG trees and custom sections use this same insertion owner.

Spec 131: switch prerequisites are declared explicitly, never inferred from tree nesting. Rejected activation
restores the bound value and outlines the first unmet prerequisite with `devtools__row--blocked-prerequisite`
and `--ui-danger` without changing geometry or keyboard focus decoration. The injected DEV feedback owner
reveals collapsed sections and owns one 3000ms timer, cleared on parent activation or control lifecycle changes.
Editable zones and depth numbers require editor enablement; zone visibility and grids remain independent.

Spec 132 supersedes the separate editable-zone checklist: «Зони» starts with «Редагувати ігрову», «Редагувати
перешкоди», «Редагувати зачепи», «Редагувати рухомі», «Редагувати всі», «Показати всі», then the existing category
subsections. A category owns one editing flag for all its zones; no per-zone permission set remains. Editing
requires the editor and the category's physics (all four for edit-all), using spec 131 blocker feedback.
Dynamic zone bodies/handles and pointer selection use current map geometry, never an additional authored-start
rectangle. Category editing pauses dynamic motion at its current position and releases it on exit. Coordinate
fields read current snapshots on refresh; accepted config edits snapshot the category's positions so config reload
cannot reset untouched moving zones to their original starts. Movement boundaries retain their separate outlines.

Spec 133: pressing an editable dynamic body selects its movement area and reveals that area's handles only.
Areas use an unfilled outline, with a light fill only while their own drag target is hovered; body hover no longer
fills a large movement rectangle. The body remains the primary hit target inside its actual rectangle; selected
area targets take priority over unrelated static zones. Move/resize gestures snap and obey full-rectangle
containment; the containing area cannot exclude its body. Leaving editing, changing location or clearing selection
removes the area-editing context. Geometry writes keep the established config/export path and shared ownership.

DEV's zone editor (spec 110) composes existing `DevToolsUI` sections, rows, selects and switches. Spec 129 adds two DEV
elements in `src/dev/styles/dev-tools.css`: `devtools__swatch` (a category colour square before a label or beside a
select, colour from `--devtools-swatch`) and `zone-editor-drag-layer` (a transparent fixed layer under the DevTools
panel while the editor is on; `--x`, `--y`, `--xy` cursor modifiers), and Revision 2 `devtools__range` /
`devtools__range-value` (`DevToolsUI.createRangeRow`, a 0..100 slider for grid and depth opacity). The editor holds the
zone, cell-grid, perspective and overlay controls. `ZoneEditorSection` releases value bindings before rebuilding its selected geometry controls.
Scene metre-grid/zone annotations use cached WebGL Graphics; the same logical-pixel model feeds the Canvas fallback.
Spec 126 replaces the camera model with three primary controls: exact water length, artistic surface tilt and
far-size ratio. Default: 30 m, 30 degrees, 0.3. Angle/size edits never change authored metres or bounds. An optional
grid-width contraction switch remains off by default. Remove the camera-distance/reference controls and the ray
schematic, its state and styles. Status reports the configured water length and far-size percentage. Local reset
uses injected base config, with no second DEV default owner; export/import retain their existing override paths.
All rows reuse DevToolsUI and its collapsed descriptions. No per-frame DOM work or extra stylesheet is added.

| Owner | Responsibility |
| --- | --- |
| `src/game/presentation/styles/tokens.css` | Shared DOM palette, font, radii and stacking roles |
| `styles/ui-glyph.css` | Shared text glyph (emoji) box: flex centring, size share and the measured ink shift written by `InventoryDomFactory.glyph()` ([spec 073](../specs/073-glyph-ink-centring/spec.md)) |
| `styles/ui-surface.css` | One logical DOM coordinate surface and physical flow footprint; Canvas stays outside |
| `styles/modal-controls.css`, `auto-switch.css` | Shared close/switch appearance, the transient `ui-hint` (spec 080), documented custom properties and native interactive states |
| `styles/game-shell.css`, `version-badge.css`, `styles/hud/toolbar.css` | Page interaction policy, canvas stacking, badge and common bottom action row |
| `styles/inventory/theme.css` | Inventory palette and shared dimensions; portal scrollbar tokens |
| `styles/inventory/modal.css` | Backpack, modal lifecycle and layout: persistent-help/wide-notice flow region and bottom-anchored phone warnings without a top footprint (TK-001.1); the `inventory-main__sidebar` parent (section content + tab bar, the only painter of the left column's background and frame; `display: contents` in portrait, spec 077) and the right content area; portrait collection paging (`--inventory-swipe`) and all-layout section navigation (`--inventory-section-swipe`), with native `pan-y` ownership |
| `styles/inventory/loadout.css`, `section-tabs.css` | Unit-based grey equipment composition and the transparent section tab bar (spec 067, 077); `--inventory-equipment-*` palette lives in the inventory theme. Separate containers in landscape or above 820px; the full-screen stacked layout (bottom tabs, list-only scrolling) applies only in portrait (spec 068) |
| `styles/inventory/shared-controls.css` | Reusable panels/actions, scrollbar appearance; the `inventory-collection` block (filters panel, gap, scrolling items panel, portrait backdrop) shared by backpack and keepnet, and the lists' `inventory-vertical-scroll` drag state (spec 076) ([spec 074](../specs/074-header-sections-and-collections/spec.md)) |
| `styles/inventory/resource-meters.css` | Shared meter tracks/fills, summary rounding and the `inventory-scale` icon/meter/reading composition (load, backpack and keepnet capacity, `InventoryScaleRenderer`; sprite icons via `inventory-scale__icon--sprite`, spec 088); header placement belongs to `header.css` |
| `styles/inventory/assembly-editor.css` | The item editor in every layout (spec 094) with its `inventory-editor-tabs` block (actions panel, preview panel, tab row joined to one parameter panel, `--inventory-editor-panel`; [spec 091](../specs/091-mobile-editor-parameter-tabs/spec.md)); hiding the section tabs while the editor is visible belongs to `modal.css` |
| Other `styles/inventory/*.css` | Their component, including its media/container/reduced-motion rules |
| `styles/hud/*.css` | Game controls, time, charges, depth, chum and shared drag feedback |
| `src/dev/styles/dev-tools.css` | DEV editor and toggle |
| `src/dev/styles/overlay.css`, `overlay-content.css` | Diagnostic window/interaction and diagnostic content |
| `styles/house.css`, `keepnet.css` | House composition; the inventory's keepnet section (`keepnet-section`, spec 067) and its cards; since [spec 088](../specs/088-keepnet-like-backpack/spec.md) its view (`keepnet-overview`) shares the backpack view's containers in `loadout.css` and its filters are the backpack's rows; shared actions/meters/close/switch are reused |

Layout belongs to the component containing an element. Appearance shared across components belongs
to a reusable block. For example, an assembly action mixes `inventory-assembly-editor__button`
(placement) with `inventory-action inventory-action--primary` (appearance). Assembly, loadout,
saved-preview and list surfaces mix in `inventory-panel`.

Editor tab thumbnails use the same skin `visibleHeight`/`focusX` scaling and bottom crop as backpack item cards,
owned by `item-cards.css`; their placement inside the tab belongs to `assembly-editor.css`.
The active empty socket's page in every layout adds `inventory-editor-tabs__candidates` (reused from spec 096): four columns of
the existing inventory cards in the editor's scroll flow, or the shared shop action. Its layout belongs to
`assembly-editor.css`; inventory card artwork, quantities and meters retain their existing owners.
Empty and filled cell taps use the same tab-opening handler. Only choosing a compatible card starts the existing
equipment command; viewing the tab never starts a backpack pick. No separate wide-screen picker is composed.
The editor's nearest vertical scroller declares `touch-action: pan-y` in every layout. `modal.css` hides section
navigation while the equipment editor is visible in either orientation. Re-rendering the same root retains its
scroll position; another editor starts at the top. `INVENTORY_EDITOR_CONFIG.scrollbar.enabled` defaults to `false`;
bootstrap injects it into the renderer, whose modifier lets `shared-controls.css` hide the scrollbar without
disabling scrolling. Enabling the setting restores the existing shared scrollbar appearance.
In portrait mode (TK-120), `.inventory-main__left` provides the `--inventory-mobile-inset` side padding: `.inventory-assembly-editor` clears horizontal and top padding (`padding: 0 0 var(--inventory-container-gap)`) and pins its sticky actions bar to `top: 0` so its width and margins align with the inventory header.

Since TK-009/v0.45.28 the inventory header itself owns the shared grey panel background, 14px radius and proportional inner padding in all orientations. Landscape and desktop keep their existing column layout; portrait retains its inset and gap. The header owns its spacing below the panel rather than painting that gap.

## Pointer interaction and resize ownership

Inventory behavior is defined in [inventory-behavior.md](inventory-behavior.md) and spec 072.
Header pills use separate consumable buttons and an automatic switch label. Empty
placeholders are muted without a tackle target and lighter when a hook/feeder slot exists. Each pill grows its
item side for every equipped slot, retaining the track on the right. Actual item art replaces placeholders.
Automatic mode shows matching reserves; manual mode shows equipped portions (one per filled icon).
Uniform filled slots hide their individual counts and retain only the deduplicated reserve/equipped total beside `A`.
The thumb slides through `transform`; numeric refresh retains its DOM node and keyboard focus.
The item artwork has a square 22px circle at the 320px baseline; transparent borders become visible only for
the selected item or keyboard focus. Counts sit outside/below this circle, and images use `contain` without clipping.
The pill, track and thumb keep opaque background colors in both modes. Their geometry/state rules have one
shared owner in `auto-switch.css`, including the House's compact variant.
The header bait hold (v0.45.35) reuses the `inventory-press` block from `inventory/shared-controls.css`.
Its artwork host supplies full-circle size, a thin radial mask and no shadow through documented
`--inventory-long-press-size` / `--inventory-long-press-mask` / `--inventory-long-press-shadow` properties.
Since v0.45.38 every inventory cell waits 300ms to distinguish a click from a hold, then fills progress
for 200ms and fires at 500ms, including backpack cards, saved kits, equipment and editor cells.
The delay schedules no progress frames and keeps the indicator hidden. Artwork-only updates preserve the
mounted progress node and deadline. Card appearance retains its existing owner.
The pill, its track and close button share `--inventory-header-control-height`: all are 36px at 320px, with
a 26px thumb and 22px artwork circle. There is no separate outer height or vertical pill padding; the track's
border aligns with the pill border. The same compact geometry applies in both phone orientations.
The shared header unit grows with `cqi` up to 2px in portrait; landscape caps the common row height at 44px.
Desktop controls are 44px high. Above 820px the header has two sections in one row over the content columns:
the load meter over the left panel, the switch group (centred) and close (right) over the right panel. Portrait keeps its composition through 820px, without a
520px jump. The existing UI surface scales the composition once below 320px. Only cast-tackle chum appears here; hand/boat
consumables keep their equipment views. Hook cards/craft panels omit bait compartments. Highlighting belongs
to the projected inventory pick state and keyboard focus remains visible; item presses never toggle the switch.

The load scale is `inventory-header__load`: on mobile the lower row inside `inventory-header`, below its
consumable/close row, spanning the header's content width; on desktop the left section of the single header row. Header and main share the
container-owned `--inventory-content-columns`/`--inventory-content-gap`, avoiding duplicated width formulas.
Its icon/readout composition is the shared `inventory-scale` block (`InventoryScaleRenderer`, also used by the backpack
capacity scale of [spec 075](../specs/075-backpack-pager-and-capacity/spec.md)), which reuses `InventoryResourceMeterRenderer`
and `resource-meters.css` (including the shared summary-track radius). `InventoryLoadRenderer` maps kilograms
to the fixed presentation config maximum of 100kg, so 1kg fills 1%. It does not compute gameplay load limits.

The backpack list (`inventory-list-panel`) and the keepnet content mix the shared `inventory-collection` block:
an `inventory-panel` with the filters, a gap, then an `inventory-panel` with the items. Only the items panel's
list scrolls vertically; in portrait it hides its scrollbar and shows the faded backpack/keepnet backdrop inside
the items panel, and the backpack's summary column is not shown. Portrait placement reserves outer insets in `modal.css`.

Backpack item and control miniatures use the full-size 2048px WebP with `contain` (spec 097).
`KeepnetFillImageResolver` selects one of six preloaded occupancy images for both overviews,
the list backdrop and the toolbar; the existing capacity read model supplies the percentage.
`toolbar.css` owns `game-toolbar-button__image`, `list-and-filters.css` owns the category image,
and `dev-tools.css` owns the free-shop image and label. Numeric updates keep their image nodes.
Landing-net miniatures crop the full artwork `assets/items/nets/net--1.webp` in CSS: its skin thumbnail has
`visibleHeight: 0.4`, `focusX: 0.5` and `anchor: "top"` (`inventory-item-card__visual--cropped-top`), so the upper 40%
fills the card height, centred and top-aligned. The item editor preview (`renderItem` with `wholeArt`) always shows the whole artwork (net, rod); editor tabs,
cells and backpack cards stay cropped.
The toolbar net button (`GameControls` `landingNetArt`, injected from the same skin thumbnail) applies that crop in
`toolbar.css` (`game-toolbar-button__art`, `--cropped-top`) inside the 85% image box of the other toolbar buttons. Explicit bounded toolbar grid tracks keep image intrinsic dimensions
from expanding the button's contents; thumbnail images fit within their track.
Landscape split inventory ([spec 098](../specs/098-landscape-split-inventory/spec.md), DEV switch `CONFIG.debug.inventorySplit`):
`GameStageLayout` sets the inline values; `game-shell.css` owns `game-shell--staged` (on the page shell, so the game canvas and the WebGL scene canvas under it are both the game strip; spec 104),
`modal.css` owns `inventory-surface` (the inventory's own `ui-surface` size container: its breakpoints and
orientation queries measure it) and `inventory-surface--split`/`--split-left`/`--split-right` (`--inventory-split-width`). Edge-anchored HUD follows the
`--ui-edge-*` values set on the UI surface root (content and portals, `UiSurfaceAdapter.setLayoutProperty`); centred HUD uses `--ui-stage-center-x` (default 50%).
The backpack collection also shows its faint open-backpack background in landscape, centred
inside the items panel. `shared-controls.css` owns its shared backdrop geometry and the landscape placement.

`UiSurfaceAdapter` exposes `hoverEnabled` and adds `ui-surface--desktop-hover` only for a UI and
landscape viewport wider than 1024px with a fine hover-capable pointer and no touch/coarse input.
Phones, tablets, portrait layouts and hybrid touch laptops have no hover effects. Every CSS
`:hover` selector uses this ancestor; inventory hover hints and DEV metric hover help follow the same policy.
TK-012 permits native `:active` under `.ui-surface:not(.ui-surface--desktop-hover)` for equivalent feedback
only while pressing a control. Component owners share declarations with their desktop hover states;
release/cancel restores the base style without timers, synthetic hover classes or extra input listeners.
Press decoration does not resize controls. Keyboard focus and actual selected/expanded states remain visible.
UI roots disable the browser tap highlight, including the catalog's outer navigation.

DEV injects the calendar control through a bootstrap factory. Its active root reserves clock width,
including the fullscreen neighbour. House reuses the same HUD components and shared `hud-control`
appearance; its single header row scales every control together when needed. A coalesced `HudRowSizer`
reads shared token sizes only for viewport/rate changes. The room artwork has its own horizontal
viewport, uses injected map pan settings and covers wide screens without side gaps.
Its day/evening/night art uses the location's `timeOfDayLayers` composition (one opaque base, at most one
blend); HouseRoomView writes phase opacities only on change and a linear transition lasting one refresh blends them. Vertical gestures
reveal the header/menu zones; sheets use a shared tap/swipe handle in place of a cross. Page navigation
actions share one compact Grid without the parameter rows' dashed separators.
An opposite scene gesture closes the visible zone before a later gesture can open the other. House
wheel bursts produce one vertical command and never pan horizontally. Sheets reach the bottom edge
and share the dock's outer width; dock side insets are 20px mobile / 40px desktop, with reserved content
space above its buttons. HUD/toolbar borders share `--ui-control-border-*` tokens. Index and DEV compose
`GameToolbar`; its version badge stays aligned with the bottom actions, keeps their height and clips
excess text while shrinking horizontally. Hidden actions consume no row space.
House's footer remains accessible as compact icon buttons. One upward gesture reveals all names;
choosing a section leaves the other buttons miniature and permits direct switching. A shared handle
supports up/down/tap for the footer, and the backdrop accepts downward dismissal of an open sheet.
Header/footer/sheets share glass-background and blur properties, with no footer gradient or button glow.
The translucent footer and open sheets omit their bottom borders.
The catalog builds the House screen markup module (spec 084) and exposes compact/expanded/open-section states through HouseView;
it defines no alternative markup, geometry or input behavior for these controls.
Sheet motion belongs to `SheetHeightController`: bottom anchoring stays fixed, height shrinks to the
compact footer, and pointer release never resets to a full/open value before dismissal. Its observer
watches intrinsic content, coalesces measurements and reuses cached drag geometry. The sticky handle
stays reachable during scrolling. Full/empty/unaffordable/no-feed aquarium examples use the same view.
Aquarium occupancy uses `InventoryResourceMeterRenderer` with free-capacity color semantics; unchanged
readings skip CSS writes. Upgrade labels show the target level/capacity once. The control variant of
`UiAutoSwitchRenderer` has only its slider track and is inactive without usable feed reserve.
Aquarium vector icons/counts share the existing parameter header above each scale: a level chevron or
fish outline with its counter immediately to the right. Both icons share one style using `currentColor`;
accessible group names preserve the parameter meaning. The shared `assets/ui/status-icons.svg` supplies
these glyphs to both status headers and the numeric upgrade button. House installation/upgrade buttons
fit their content in landscape and span their container only in portrait.
Feeding and its right-hand item replace reserve and separate active-feed text inside the status card.
`AquariumFeedPicker` creates/updates one shared row template for preview and available inventory items.
The preview holds artwork, quantity, name and a short countdown; warnings remain below the aligned
action/item row. Locked actions retain the Load label while reserve feed is available. Whole-row selection closes the
list while retaining the unconsumed draft; clicking the preview reopens it. Confirmation loads one pack,
and the service's half-time gate controls availability. The catalog injects the same `AquariumCareCalculator` for additive
time and gate states; no alternative picker markup, palettes or gameplay formulas are copied into DEV.
See [Aquarium loading contract](../specs/061-aquarium-feed-loading/spec.md) for v5 carry migration.
The dock handle opts out of the shared handle's hover background through
`--ui-sheet-handle-hover-background`. On permitted desktop mouse hover, entering a menu button holds
the button-container height until the pointer leaves the dock; gaps/handle areas never start the hold.
HouseNavigationController owns this transient UI state and disposes its two pointer bindings. CSS uses the adapter's
desktop-hover policy and shared motion tokens; touch gestures and selected-sheet states retain their behavior.
Production clocks are passive. DEV injects single-click acceleration and double activation for
day 12:00 → evening 19:00 → night 00:00 → day only while `debug.timeAccelerationEnabled` is true,
including in the House. Disabling cancels pending activation and hides the phase-action hint; the command
also rechecks the live flag. `DoubleActivationController` separates the pair from delayed single acceleration;
`TimePhaseControl` treats a partial dusk/night blend as evening until night is fully reached, so elapsed time
after 19:00 cannot skip midnight. It changes the shared `GameTimeClock` anchor without simulating elapsed time.
Hours/rate persistence stays v1. House/catalog use the passive production view unless DEV injects a control.
See [spec 116](../specs/116-clock-phase-switch/spec.md), owner correction 2026-10-20.

TK-001.1 limits `ui-hint--sheet` and its shared handle to UI-surface widths <=820 logical px, in either orientation.
`HintSheetController` reads the injected surface metrics and subscribes to width changes; no per-frame DOM reads.
Phones use a 5000ms timer, drag/cancel/capture and a 10% initial-height dismissal threshold. Only the phone sheet
removes its bottom border. Inventory's top-region padding/margin selectors exclude sheet children, leaving zero
top footprint. Long phone text scrolls without dismissing from the middle. Above 820px the sheet modifier is removed,
the handle is hidden, drag is inactive and the original full frame/top flow returns. House reuses its active panel's
hint region or reveals the header region; empty regions reserve no space. Original inline timers remain inventory
5000ms and House `ui.noticeDurationMs`=4000ms, owned by the same controller. Resize cancels stale motion/capture
and reparents the same House node. Persistent help stays in flow; Catalog normal/error/long use production views.

TK-003 editor navigation stores one temporary return context in `InventoryUiState`, including backpack filters/sort,
and reveals equipment-host when opening an editor. Updates to the same root retain the route; Back restores it.
Whole socket tabs own their rounded highlight layer; their inner wells do not duplicate it. Parameter-list top
dividers are removed only in editor pages. Sticky action children are clipped to the panel radius. Native artwork
dragging is suppressed on scroll/pager surfaces, and a child losing capture never cancels its parent scroller.
TK-003.3.1 applies the same full-container footprint to the two success flashes after equipping. `InventoryUI`
adds the `inventory-equipment-feedback` mix to the complete field or outer editor tab, with one inert child overlay;
an existing tab highlight layer is reused. `slots.css` owns its unchanged two-flash animation and reduced-motion
behavior; field/tab owners supply their radius. The active tab's free width and inset are included. Inner wells
never receive an additional flash, and the existing feedback revision prevents replay on ordinary refresh.
TK-010/v0.45.30 reuses this same whole-field overlay for missing consumable prerequisites through the error
modifier and `--inventory-danger`; warning sheets keep their existing behavior. Header placeholders accept an
explanatory press while retaining aria-disabled and their unavailable appearance. Empty editor tabs start the
same cancellable pick in portrait without leaving their inline page. The delegated cancellation controller uses
a 200ms hold or right-click only on a highlighted target, consuming the following click and freeing timers/listeners
on cancellation/disposal. The browser's context menu is disabled globally, including on editable controls.

TK-007 owner clarification (v0.43.1): section navigation works in wide/landscape inventory too. Internal collection
pages remain portrait-only; in wide layouts `InventoryCollectionPagerRenderer` forwards its gesture directly to
the neighbouring section instead of selecting a hidden page. Filter rows retain horizontal scrolling and the visible
editor disables section navigation. `SwipePagerController.getGestureSurface` measures the touched column at
start/end so the 20% commit threshold is relative to that column, with no geometry reads on pointermove.

Resize bursts share one pending measurement; unchanged measurements do not rewrite layout variables
or notify subscribers. The game applies a pending Canvas/viewport resize before its next update,
and Canvas dimensions are assigned only when changed. See [design performance rules](../DESIGN_RULES.md#13-ui-performance-and-resize)
and the [inventory resize audit](audits/2026-10-14-inventory-resize.md).

## BEM and reusable values

Use `block`, `block__element`, `block--modifier` and `block__element--modifier`, with lowercase
hyphenated words. An element retains its base class when a modifier is applied. States belong to
their block: `inventory-modal--open`, `inventory-list-item--selected`, `devtools--open`.
Avoid generic writable state classes such as `is-open` or `has-rarity`.

`item-rarity`, `item-condition`, `game-control` and `draggable-control` are intentional block mixes
used by browser adapters. Their modifiers describe presentation state; they do not own gameplay
state. DOM IDs remain available for existing lookup contracts, but CSS uses classes.

Reuse semantic custom properties when values have the same purpose. Shared DOM values use `--ui-*`;
inventory-specific values use `--inventory-*`. Keep a value local when it has only one consumer or
has a different meaning. Shared button/panel rules are defined once, rather than copied between
component files. Component-specific structure remains explicit.

## Runtime boundary

TK-032/033 (v0.46.6): toolbar buttons and selector sector shapes share `--ui-control-background`,
`--ui-control-hover-background` and `--ui-control-active-background` from tokens.css. Sector highlight
uses the toolbar accent border at its normal width; keyboard focus uses `--ui-info`, with no yellow
stroke or highlight-only stroke widening. The sprite's inventory symbol is a four-square outline menu
with softer outer corners. The suitcase source is archived under asset-sources/ui/archive and has no
runtime consumer. Section symbols, measured geometry, motion and pointer ownership are unchanged.

TK-034/v0.46.7 supersedes TK-031's separate selector row. `GameToolbar.dock` (`game-toolbar-dock`) owns
fixed screen anchoring and is the `game-toolbar` width container; the action row `game-toolbar` (the mount
for actions) can therefore change its own layout by that width. At toolbar widths <=820 logical px with a
visible radial selector, `toolbar.css` turns the row into a grid (TK-036/v0.46.9): columns free | selector |
actions, rows 1-3 above the bottom row 4, the row's gap between rows. The selector stays centred in the bottom
row without a reserve for its open fan. Every other action stands in one column at the right edge, packed up
from the bottom corner: the float/depth slot spans the bottom row (float in the right corner, its track opening
leftwards over the selector, which fades out while the track is open), then the net, then the chum and other
actions; each drops a row when an action below is absent.
TK-037/v0.46.10 makes the placement a DevTools choice (`ui.inventorySelector.compactPlacement`: `center`
default, `right` or `left` bottom corner with the quarter fan, the left one mirrored as the `corner-left`
layout) and, for the centre, the column side (`compactActionsSide`: `right` default, `left`). A corner
selector always puts the column on the other side. The renderer names both on the selector root
(`inventory-selector--slot-*`, `inventory-selector--actions-*`); `toolbar.css` reads them with `:has()`.
A left column puts the float in the left corner with its track opening rightwards (`--depth-selector-direction:
row`, `--depth-selector-reveal: depth-selector-reveal-end`, documented in `depth-selector.css`); a corner fan
grows from its corner. The fades apply to every placement.
`:has()` on the visible actions decides placement; no JS enumerates or measures siblings. The selector host
sets `--inventory-selector-layout: compact`; the controller reads it once per opening and the renderer
applies the configured compact fan (`CONFIG.ui.inventorySelector.compactShape`: `half` or `arc`, DevTools
toggle, existing override paths). The root keeps its closed footprint through negative margins and grows
centred and upwards over its neighbours (`z-index` on the host); its drawing unit is capped by the toolbar
width (`100cqw`) and the fan's extent. While the fan is open the other actions fade out completely and take
no pointer input, and a press beside the fan only closes it. While the player aims a cast (body
`game-shell--pointer-hold`) the whole game UI fades out, the toolbar with it (TK-092, `game-shell.css`: every
child of `ui-surface__content` except the split inventory, plus the DevTools button). Fades animate opacity and then drop
visibility over `--game-toolbar-fade` (0s with reduced motion). The open half-disk central button keeps
vertical radii equal to its height (no bottom rounding), so it stays concentric with the petals' inner arc and
every gap is equal. Wider toolbars keep the corner fan, its reserve and the existing row unchanged.
`InventorySelectorGeometry` builds one geometry per layout (`corner`, `half`, `arc` in
`INVENTORY_SELECTOR_CONFIG.layouts`: fan origin as a share of the central box, angles, radii); the renderer
writes each layout's boxes, clip paths and art positions as custom properties and a block modifier
(`inventory-selector--corner|half|arc`) that shapes the open central button (quarter disk, half disk, disk).

TK-008/spec 117 adds `inventory-selector.css`: a morphing central toolbar control and three rounded annular sectors.
`InventorySelectorGeometry` supplies one polygon per sector to SVG, CSS clipping and coordinate hit testing.
`InventorySelectorRenderer` owns DOM/expansion/highlight; the injected browser controller owns pointer capture,
keyboard, readiness and cancellation. Since v0.45.14 toolbar placement permanently reserves the open fan's width,
including while closed, so neighbouring actions do not move on expansion. Native `wrap-reverse` places overflow
rows above the bottom actions; bottom alignment keeps their baseline fixed as the selector grows. Its unit is capped to
available logical width/height and safe areas. The shared UI surface
applies the only below-320 scale and desktop-hover policy. Existing inventory/keepnet shortcuts remain mounted
and are hidden only by the composed activation mode; their views and gameplay state are not reconstructed.
TK-014/v0.45.37 separates pending, ready and failed artwork preload in that composition. Pending radial
keeps classic shortcuts hidden until radial is ready. Explicit classic mode is immediately available;
an actual preload failure restores classic controls. Pending mode changes use the latest configuration,
and late success/failure after disposal never changes control visibility.
`CONFIG.ui.inventorySelector` has `radialEnabled=true`, initial `size=1` and expanded `openSize=3` by default.
DEV switches the mode and both independent sizes 1/2/3 (scale 1/1.35/1.7) live.
Existing overrides own persistence/export/import/reset; invalid selector settings
are rejected before mutation. Opening readiness follows computed motion duration, with instant reduced motion;
coordinate bounds are cached per interaction. Ancestor lifecycle attributes are observed only while expanded.
Owner refinement v0.45.3 introduced a true quarter-disk centre. v0.45.6 replaces its SVG/clip with the shared
`game-toolbar-button` frame: closed it has the common rounded-square shape; the open modifier animates
the large upper-left arc and moves its upright symbol from the square centre to the quarter-disk centroid.
Owner correction v0.45.9 keeps only the small bottom-right corner rounded: the open endpoint is
`100% 0 var(--ui-radius-panel) 0`, with sharp upper-right and lower-left corners. The inner visual stage scales the
whole composition between independent initial/open presets, anchored at bottom right. Since v0.45.26 it is drawn
at the larger of the two sizes and scaled down for each state; neither endpoint enlarges a smaller painted layer.
The shared toolbar frame's `--game-toolbar-render-scale` compensates border/radius/shadow for the central button,
preserving its original appearance and the open border's match with the sectors. The layout root takes its
final slot immediately; the controller caches its final open bounds once and waits for scaling/reveal before
pointer selection, without layout reads on movement. Both directions reuse `--ui-duration-fast` and reduced motion, including the catalogue
modifier. Native border geometry owns central hit testing, including the closed upper-left corner; browser
transitions reverse smoothly without a frame loop. The outer sector arc remains derived from centre radius and gap.
Highlighting translates a candidate outward through a native animation. Its cached animation timing supplies the
current translation to release hit tests, without frame loops or per-move layout reads. Finished movement no longer
fills a compositor effect; the highlighted CSS state owns its final translation, and hit tests retain the final
offset even when finished native animation timing reports null progress. Hover additionally retains
the original footprint and the full padded fan, including gaps. Unrelated/unchanged ancestor attributes do not
cancel it. Real visibility or cached geometry changes do. v0.45.4 removes global cursor tracking and the
coordinate-only pointerleave override: the actual obstacle was the depth control's transparent hit region.
The catalogue reuses the production composition for closed/open/highlighted/classic/reduced-motion and size states.
Since v0.45.17 the equipment sector uses the equipped rod's existing thumbnail metadata through the shared toolbar
art crop; artwork remains upright. Bootstrap reads PlayerInventory.getEquipped() and subscribes to its inventory
change port. Unchanged artwork does not reload; a revision rejects late preload results after rod replacement,
removal or disposal. The renderer keeps one image node and the SVG fallback; hidden artwork cannot receive input.
Empty/unillustrated rods and failed preloads retain the SVG. The main inventory symbol stays distinct. Fresh/reset
configuration enables radial; explicit classic overrides remain supported and no gameplay save format changes.

v0.45.16 supersedes depth's normal-flow width expansion. The transparent `game-toolbar__tackle` uses
`display: contents`; its `game-toolbar__depth` child is a permanent flexible left slot shared by float and badge.
The slot's minimum reserves the float, shared gap and a usable 40px slider in both states. Native wrapping depends
on viewport/visible actions, never depth open/close. A hidden float with no visible badge consumes no row space.
Toolbar anchors the actual depth frame to the slot's right/bottom edges. The closed float sits left of all actions;
opening grows its frame left within the slot. Since v0.45.23 the toolbar caps the slider panel at 200 logical px;
the full frame adds the ordinary button width and shared gap, and shrinks to available slot width on small screens.
The width transition animates to the capped width itself. The button stays on the frame's right through both
transitions. The badge uses free slot width while closed and becomes invisible while open without changing flow;
it remains hidden at toolbar widths <=820 logical px. Production, DEV and catalogue inject the same depth mount.

The float and horizontal track form one `game-toolbar-frame` container, sharing ordinary button appearance in
toolbar.css. Its inner button/panel have no independent frame. Width expands/contracts over `--ui-duration-normal`;
the panel fades/reveals leftwards with matching timing. Reduced motion disables both effects. Drag starts wait
until the native width transition stops, so the existing single cached track rect never describes moving geometry.
Resize cancels depth capture. No timer, observer, frame loop or per-move layout reads added. The removed
`ui-control-pill` mix stays removed; the bait switch retains its original auto-switch.css appearance.

Depth keeps horizontal min-left/max-right and X-based selection, ordinary button size and upright optimized art.
The rail occupies the panel's full height, placing its stripe and thumb at the frame's vertical midpoint.
Endpoint labels sit below the stripe, vertically centred between its lower edge and the frame's inner bottom
edge (owner correction v0.45.24). The track spans the whole panel; the stripe-thickness row separates equal
upper/lower spaces, so the labels neither shift the stripe nor intercept pointer input. The current-value bubble
sits above the frame.
Closed content is hidden/inert; only the painted frame receives input. Transparent slots/gaps never shield Canvas.
`UiEventShield.blockEvents` shields descendant input without imposing a solid rectangle; existing makeSolid
consumers retain their behavior. Scene gestures started on Canvas keep pointer ownership through release/cancel,
including over HUD. Catalogue reuses production depth composition and toolbar mounts. No section image rotates.
There is one CSS placement owner: depth/selector bootstrap do not enumerate siblings, measure badge/free widths,
dispatch layout events or set upward-placement classes. The UI surface remains the only below-320px scale owner.

JavaScript creates markup, applies BEM state classes and supplies dynamic values such as position,
progress, resource percentage and injected rarity/configuration colors. Static layout, typography,
hover/focus and visual state rules belong to CSS. DEV template colors use a custom property when
the color comes from diagnostic data. Domain/Application do not depend on CSS or browser styling.
Canvas styles keep their existing injected descriptors and resolvers; DOM tokens do not become
gameplay configuration.

Keyboard focus must remain visible. Do not add a global `outline: none !important`. Component focus
styles may use their own visible border or shadow. Font inheritance is written as `font-family:
inherit` alongside explicit size/weight; `font: 700 12px inherit` is invalid CSS.

## SCSS decision

CSS remains the authoritative source for this refactor. Native custom properties and block mixes
solve the current duplication without adding compilation or generated copies to the repository.
Adopt SCSS when repeated declaration combinations or an existing build pipeline justify it:
organize tokens and component partials under the same ownership boundaries, use mixins only for
repeated combinations, and compile separate production/DEV entrypoints. Generated CSS must have
one reproducible build and must never be edited independently from SCSS.

## Validation

`utils/checks/architecture/css-usage-check.js` validates native composition, ownership, linked assets, class reachability,
BEM naming, invalid inherited-font shorthand, forced focus removal, ungated hover/press decoration
and static style injection. It contains 20 negative fixtures, including rejection of touch-branch hover. Inventory/item/platform tests preserve interaction, rendering,
cached DOM/frame identity and disposal contracts. One Full run includes Architecture and Quick; use focused
checks while iterating. Follow utils/UTILS_RULES.md: appearance and browser acceptance belong to the owner.

The earlier migration record (spec 018, archived at the `specs-archive-001-019` tag) is historical; this document
describes the current styling boundaries.
