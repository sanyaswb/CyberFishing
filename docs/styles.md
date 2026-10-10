# Presentation styles

Native HTML pages compose the stylesheet order. `index.html` loads 22 production assets;
`dev.html` reuses that exact prefix and appends three DEV assets. Every link uses the package
version. There are no CSS imports, runtime style installers or build requirements.

## Ownership

| Owner | Responsibility |
| --- | --- |
| `src/game/presentation/styles/tokens.css` | Shared DOM palette, font, radii and stacking roles |
| `styles/game-shell.css`, `version-badge.css` | Page interaction policy, canvas stacking, badge |
| `styles/inventory/theme.css` | Inventory palette and shared dimensions; portal scrollbar tokens |
| `styles/inventory/modal.css` | Backpack, modal lifecycle and screen layout |
| `styles/inventory/shared-controls.css` | Reusable panels/actions, warning, scrollbar appearance |
| Other `styles/inventory/*.css` | Their component, including its media/container/reduced-motion rules |
| `styles/hud/*.css` | Game controls, time, charges, depth, chum and shared drag feedback |
| `src/dev/styles/dev-tools.css` | DEV editor and toggle |
| `src/dev/styles/overlay.css`, `overlay-content.css` | Diagnostic window/interaction and diagnostic content |

Layout belongs to the component containing an element. Appearance shared across components belongs
to a reusable block. For example, an assembly action mixes `inventory-assembly-editor__button`
(placement) with `inventory-action inventory-action--primary` (appearance). Assembly, loadout,
saved-preview and list surfaces mix in `inventory-panel`.

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
BEM naming, invalid inherited-font shorthand, forced focus removal and static style injection.
It contains 13 negative fixtures. Inventory/item/platform tests preserve interaction, rendering,
cached DOM/frame identity and disposal contracts. Architecture, Quick and Full checks remain
required, along with browser smoke for affected production/DEV UI and responsive layouts.

The earlier migration record (spec 018, archived at the `specs-archive-001-019` tag) is historical; this document
describes the current styling boundaries.
