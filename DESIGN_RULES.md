# CyberFishing Design Rules

Read this file before creating or changing any UI: markup, CSS, SVG, components, HUD, dialogs, pages or DEV tools. Also read the [development rules](DEVELOPMENT_RULES.md) and [style ownership guide](docs/styles.md). Before making changes, locate the existing component, its styles, consumers and configuration owner.

The owner's current explicit instructions take precedence. This file is the current source of design rules; completed `specs/` preserve historical decisions. Adding a rule for future changes does not automatically authorize redesigning every existing screen.

## 1. Reuse components and styles

- Prefer an existing component, BEM block, token or renderer. Do not copy a button, meter or declaration group merely because another page needs it.
- Each component has one owner for its base styles. Express appearance variants through explicit modifiers or documented component custom properties.
- Internal geometry, content alignment, typography, colors, borders, radii and interaction states belong to the component.
- External placement belongs to the container or page: coordinates, `inset`, grid position, order, external spacing and screen-edge anchoring. These coordinates do not belong in the base button or meter template.
- Avoid universal components with many unrelated settings. Extract shared behavior only when actual consumers justify it.

For example, `ui-modal-close` defines appearance and internal centering; a header element class determines its placement in a particular dialog.

## 2. BEM and structural nesting

Use `block`, `block__element`, `block--modifier` and `block__element--modifier`. Names use lowercase words separated by hyphens.

- An element belongs logically to its block, regardless of DOM nesting depth. Do not create names such as `block__element__child`.
- A modifier supplements the base class: `ui-button ui-button--primary`.
- State belongs to its block, for example `inventory-modal--open`. Avoid global state classes such as `is-open`.
- BEM mixes may combine a shared appearance block and a container element on the same DOM node.
- Style through classes. Do not couple appearance to IDs, arbitrary DOM depth, child order or global selectors such as `button`.
- Keep specificity low. Resolve conflicting ownership instead of covering duplicated rules with `!important`.

## 3. Design tokens and CSS custom properties

- Shared semantic values have one source: colors, typography, spacing, radii, animation durations, control dimensions and layers.
- Shared DOM tokens use `--ui-*`; component or subsystem settings use their own prefix, such as `--inventory-*` or `--keepnet-*`.
- Reuse values that serve the same purpose. Do not merge unrelated values just because their numbers happen to match.
- Define defaults in tokens or the component owner. Local variants override custom properties instead of repeating the whole component.
- Static styles belong to CSS. JavaScript supplies dynamic values, coordinates and state classes; it must not inject duplicate static CSS blocks.
- Use `var()` in declaration values. Ordinary CSS custom properties cannot be substituted into `@media` conditions; coordinate breakpoint values across components instead of inventing unrelated breakpoints for each screen.

## 4. Responsive layout: a 320px logical baseline

Design the smallest composition for **320 CSS px**. Adapt wider screens from that baseline. Prefer mobile-first rules for new styles where this preserves existing contracts.

At **320px and above**, grids may change column counts, regions and spacing through coordinated media/container queries. Elements should distribute the available width evenly; fixed card widths must not leave unintended space on the right.

Below a physical width of **320px**, preserve the composition established at 320px:

- Keep the same regions, element order and column counts. Do not introduce another layout or wrapping rule.
- Scale the UI proportionally with one factor, `s = W / 320`, where `W` is the available physical UI width. At 280px, `s = 0.875`; at 240px, `s = 0.75`.
- Scale geometry, icons, fonts, borders and spacing together. Do not shrink only text or card widths.
- Apply scale once at the UI surface root. Nested components must not scale again. Returning to 320px must restore scale `1`.
- Account for logical surface dimensions, scrolling, fixed/portal placement, tooltips and drag/input coordinate conversion. A scaled control must respond where it is visibly displayed.
- Preserve vertical scrolling. Do not conceal unreachable content with `overflow: hidden`.

This is a behavior contract, not permission to apply an arbitrary transform to `body`. Use a shared UI adapter. Do not scale the game Canvas or world coordinates together with DOM UI without a separately agreed contract. Validate the below-320px fallback separately; this rule does not claim that every existing screen already implements it.

## 5. Grid for pages and large containers

- Use CSS Grid for the main structure of a page, large panel or dialog.
- Use explicit columns, `gap` and grid areas where useful. Column counts and spacing belong to the container and may change at coordinated breakpoints.
- Use `repeat(N, minmax(0, 1fr))` for equal flexible columns. Set `min-width: 0` on children where needed to prevent long content from expanding the grid.
- On wider screens, `auto-fill`/`auto-fit` with `minmax(...)` may let cards grow until another column fits. Choose between them according to whether empty columns should remain in an incomplete row.
- Coordinate internal and external spacing through tokens. Do not align a grid with arbitrary margins on individual cards.
- Reserve scrollbar space and separation from adjacent regions when sizing scroll containers.

## 6. Flex for internal composition

Use Flexbox for small one-dimensional groups: an icon with a number, card actions, button content or a row of controls. Use Grid for major regions and two-dimensional layouts. Do not build an entire screen from successive flex containers merely to imitate columns.

## 7. Inventory and keepnet grids

| Container | Mobile composition | Below 320px |
| --- | --- | --- |
| Inventory items | 4 equal columns | Preserve 4 columns and scale proportionally |
| Keepnet fish | 2 equal columns until the owner changes this rule | Preserve 2 columns and scale proportionally |

Use equal gaps between cards. Internal spacing and icon dimensions should be consistent within each card type. Earlier specifications describing four keepnet columns remain historical; the current keepnet rule is two columns.

## 8. Illustrations, proportions and minimal text

- Identify empty compartments with recognizable minimalist vector icons in closely related light-grey tones. Selected-item artwork replaces the placeholder.
- Use `currentColor` for vector themes where the SVG embedding method supports it: `stroke` for outline icons and `fill` for filled icons. An external SVG loaded through `<img>` does not inherit `currentColor` from its HTML parent; do not rely on that inheritance.
- Control and equipment illustrations must fit without cropping (`contain`). Use `cover` for photos/thumbnails only when cropping is explicitly allowed; keepnet fish thumbnails permit it with small, consistent edge insets.
- The rod compartment preserves **width:height = 9:16** at every scale. Its contents stay within the compartment.
- On mobile, the keepnet illustration container is at least as tall as it is wide. The image fits the available width and preserves its intrinsic proportions; portrait images increase the container height.
- Add permanent text only when it communicates useful state, quantity or action consequences. The keepnet occupancy counter uses `0 / 100` above the meter.
- Keep icon names and instructions available through accessible names, contextual hints and help popovers. Minimal text does not remove accessibility, errors or necessary confirmations.

## 9. Shared parameter-meter semantics

- Reuse the existing renderer and color-configuration owner. Do not define a separate palette, thresholds or interpolation formula for every screen.
- Remaining resources and condition use the injected `DegradationColorResolver` with runtime `degradationColors`: more remaining value is safer; exhaustion is more dangerous.
- A filling occupancy meter derives its color from the remaining free capacity. Fill amount and danger level are different readings; changing direction does not create a new palette.
- DOM resource/capacity meters use the shared `InventoryResourceMeterRenderer`. Canvas HUD uses its existing injected descriptors and functions. New templates must not duplicate these color owners.
- Do not merge different meanings, such as item rarity and resource exhaustion, merely because their indicators look similar.
- Read values from their authoritative model. Filters and grouping do not change occupancy; include capacity reserved for a hooked live bait's return.
- Clamp graphical fill to its valid range and expose accessible numeric readings. Define behavior for zero capacity, empty storage and overcapacity.

## 10. States, accessibility and motion

- Define normal, hover, focus-visible, active, disabled, selected and error states once per component where applicable.
- Use semantic buttons, switches and meters with accessible names/values. Keyboard focus must remain visible.
- A green `A` indicates enabled automatic mode; disabled mode retains a visible muted `A`. This indicator is separate from resource-meter color semantics.
- Reuse animation duration/easing tokens and support `prefers-reduced-motion`.
- Dialogs preserve focus, Escape handling, focus restoration and hint dismissal. Numeric updates must not reset scrolling or recreate every image.

## 11. Sass examples and the current implementation

The owner's `page-grid`, breakpoint/adaptive-padding and SVG-theme mixins describe the intended principles: one grid scheme, coordinated spacing, icon themes and reuse. The current project uses native CSS. Implement those principles through custom properties, BEM mixes, shared blocks and media/container queries without adding a Sass build pipeline.

Adopt SCSS only through a separate justified decision. Then shared mixins belong in common partials, CSS is generated by one reproducible build and generated CSS must not be edited independently. Breakpoint names and ranges must be unambiguous.

## 12. Component catalog and validation

The future [UI catalog](specs/057-modular-ui-catalog/spec.md) demonstrates the same production components and styles used by the game. Catalog-specific styles only arrange examples. Editing a component's source updates its consumers and catalog examples. The catalog belongs to DEV; game-specific UI does not belong in engine.

Before finishing a change, validate relevant contracts, CSS usage/BEM, Architecture, Quick and Full. Cover empty, populated, long-content and boundary states. Responsive changes require planned checks at 240, 280, 319, 320px and wider widths, including illustration proportions, input and scrolling. When the owner performs visual acceptance, do not open a browser and explicitly report that visual verification was not performed.
