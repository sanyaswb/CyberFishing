# Presentation styles

Before design work, read [DESIGN_RULES.md](../DESIGN_RULES.md). It is the current owner policy for reuse, responsive behavior and component design; this document describes the existing style ownership and runtime boundaries. In particular, mobile inventory has four columns and mobile keepnet has two; earlier specifications retain their historical layouts.

Native HTML pages compose the stylesheet order. `index.html` loads 27 production assets;
`dev.html` reuses that exact prefix, appends the House stylesheet for its DEV House route and three DEV assets. `ui-catalog.html` reuses the
same prefix, appends the House component styles, catalog stylesheet and shared DEV clock/navigation styles. Every link uses the package
version. There are no CSS imports, runtime style installers or build requirements.

## Ownership

| Owner | Responsibility |
| --- | --- |
| `src/game/presentation/styles/tokens.css` | Shared DOM palette, font, radii and stacking roles |
| `styles/ui-surface.css` | One logical DOM coordinate surface and physical flow footprint; Canvas stays outside |
| `styles/modal-controls.css`, `auto-switch.css` | Shared close/switch appearance, documented custom properties and native interactive states |
| `styles/game-shell.css`, `version-badge.css`, `styles/hud/toolbar.css` | Page interaction policy, canvas stacking, badge and common bottom action row |
| `styles/inventory/theme.css` | Inventory palette and shared dimensions; portal scrollbar tokens |
| `styles/inventory/modal.css` | Backpack, modal lifecycle and screen layout |
| `styles/inventory/shared-controls.css` | Reusable panels/actions, warning, scrollbar appearance |
| Other `styles/inventory/*.css` | Their component, including its media/container/reduced-motion rules |
| `styles/hud/*.css` | Game controls, time, charges, depth, chum and shared drag feedback |
| `src/dev/styles/dev-tools.css` | DEV editor and toggle |
| `src/dev/styles/overlay.css`, `overlay-content.css` | Diagnostic window/interaction and diagnostic content |
| `styles/house.css`, `keepnet.css` | House/Keepnet composition and component-specific geometry; shared actions/meters/close/switch are reused |
| `src/dev/styles/ui-catalog.css` | Catalog page, fixture controls and external placement of examples |

Layout belongs to the component containing an element. Appearance shared across components belongs
to a reusable block. For example, an assembly action mixes `inventory-assembly-editor__button`
(placement) with `inventory-action inventory-action--primary` (appearance). Assembly, loadout,
saved-preview and list surfaces mix in `inventory-panel`.

## Pointer interaction and resize ownership

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
blend); HouseView writes phase opacities only on change and a linear transition lasting one refresh blends them. Vertical gestures
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
The catalog loads production HTML and exposes compact/expanded/open-section states through HouseView;
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
HouseView owns this transient UI state and disposes its two pointer bindings. CSS uses the adapter's
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
