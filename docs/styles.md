# Presentation styles

Before design work, read [DESIGN_RULES.md](../DESIGN_RULES.md). It is the current owner policy for reuse, responsive behavior and component design; this document describes the existing style ownership and runtime boundaries. In particular, mobile inventory has four columns and mobile keepnet has two; earlier specifications retain their historical layouts.

Native HTML pages compose the stylesheet order. `index.html` loads 29 production assets;
`dev.html` reuses that exact prefix, appends the House stylesheet for the House screen it opens (spec 084) and three DEV assets. `ui-catalog.html` reuses the
same prefix, appends the House component styles, catalog stylesheet and shared DEV clock/navigation styles. Every link uses the package
version. There are no CSS imports, runtime style installers or build requirements.

## Ownership

DEV's zone editor (spec 110) composes existing `DevToolsUI` sections, rows, selects and switches; it adds no markup
or stylesheet. `ZoneEditorSection` releases value bindings before rebuilding its selected geometry controls.
Scene metre-grid/zone annotations use cached WebGL Graphics; the same logical-pixel model feeds the Canvas fallback.
Specs 111/112 add independent tilt/distance fields, explicit validation feedback and existing export/import/local-reset actions
beside them. DEV labels keep their full text and wrap within a flexible column; info values have their own flexible
column and numeric inputs/switches keep their control width. The status shows the selected angle/distance and automatic
fitting, without a minimum-distance restriction. No per-frame DOM measurements or writes are added.

| Owner | Responsibility |
| --- | --- |
| `src/game/presentation/styles/tokens.css` | Shared DOM palette, font, radii and stacking roles |
| `styles/ui-glyph.css` | Shared text glyph (emoji) box: flex centring, size share and the measured ink shift written by `InventoryDomFactory.glyph()` ([spec 073](../specs/073-glyph-ink-centring/spec.md)) |
| `styles/ui-surface.css` | One logical DOM coordinate surface and physical flow footprint; Canvas stays outside |
| `styles/modal-controls.css`, `auto-switch.css` | Shared close/switch appearance, the transient `ui-hint` (spec 080), documented custom properties and native interactive states |
| `styles/game-shell.css`, `version-badge.css`, `styles/hud/toolbar.css` | Page interaction policy, canvas stacking, badge and common bottom action row |
| `styles/inventory/theme.css` | Inventory palette and shared dimensions; portal scrollbar tokens |
| `styles/inventory/modal.css` | Backpack, modal lifecycle and screen layout: the hint region above the header (spec 086), the `inventory-main__sidebar` parent (section content + tab bar, the only painter of the left column's background and frame; `display: contents` in portrait, spec 077) and the right content area; portrait's `--inventory-swipe: on` flag and `pan-y` touch axis for the section swipe ([spec 087](../specs/087-portrait-section-swipe/spec.md)) |
| `styles/inventory/loadout.css`, `section-tabs.css` | Unit-based grey equipment composition and the transparent section tab bar (spec 067, 077); `--inventory-equipment-*` palette lives in the inventory theme. Separate containers in landscape or above 820px; the full-screen stacked layout (bottom tabs, list-only scrolling) applies only in portrait (spec 068) |
| `styles/inventory/shared-controls.css` | Reusable panels/actions, scrollbar appearance; the `inventory-collection` block (filters panel, gap, scrolling items panel, portrait backdrop) shared by backpack and keepnet, and the lists' `inventory-vertical-scroll` drag state (spec 076) ([spec 074](../specs/074-header-sections-and-collections/spec.md)) |
| `styles/inventory/resource-meters.css` | Shared meter tracks/fills, summary rounding and the `inventory-scale` icon/meter/reading composition (load, backpack and keepnet capacity, `InventoryScaleRenderer`; sprite icons via `inventory-scale__icon--sprite`, spec 088); header placement belongs to `header.css` |
| `styles/inventory/assembly-editor.css` | The item editor in every layout (spec 094) with its `inventory-editor-tabs` block (actions panel, preview panel, tab row joined to one parameter panel, `--inventory-editor-panel`; [spec 091](../specs/091-mobile-editor-parameter-tabs/spec.md)); hiding the section tabs while the editor is visible belongs to `modal.css` |
| Other `styles/inventory/*.css` | Their component, including its media/container/reduced-motion rules |
| `styles/hud/*.css` | Game controls, time, charges, depth, chum and shared drag feedback |
| `src/dev/styles/dev-tools.css` | DEV editor and toggle |
| `src/dev/styles/overlay.css`, `overlay-content.css` | Diagnostic window/interaction and diagnostic content |
| `styles/house.css`, `keepnet.css` | House composition; the inventory's keepnet section (`keepnet-section`, spec 067) and its cards; since [spec 088](../specs/088-keepnet-like-backpack/spec.md) its view (`keepnet-overview`) shares the backpack view's containers in `loadout.css` and its filters are the backpack's rows; shared actions/meters/close/switch are reused |
| `src/dev/styles/ui-catalog.css` | Catalog page, fixture controls and external placement of examples |

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
`:hover`/decorative `:active` selector uses this ancestor; inventory hover hints and DEV metric
hover help follow the same policy. Keyboard focus and actual selected/expanded states remain visible.
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
The production clock remains passive. See [DEV time/House contract](../specs/058-dev-time-controls/spec.md).

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

`utils/css-usage-check.js` validates native composition, ownership, linked assets, class reachability,
BEM naming, invalid inherited-font shorthand, forced focus removal, ungated hover/press decoration
and static style injection. It contains 18 negative fixtures. Inventory/item/platform tests preserve interaction, rendering,
cached DOM/frame identity and disposal contracts. Architecture, Quick and Full checks remain
required, along with browser smoke for affected production/DEV UI and responsive layouts.

The earlier migration record (spec 018, archived at the `specs-archive-001-019` tag) is historical; this document
describes the current styling boundaries.
