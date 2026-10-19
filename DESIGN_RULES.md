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
- A visual block has one parent that paints its background and frame. Its children (switchable sections, tab bars, toolbars) paint no outer background or radius of their own and only lay out their content; matching colours between siblings is not a substitute for a parent ([spec 077](specs/077-inventory-sidebar-parent/spec.md): `inventory-main__sidebar`). When a layout must dissolve the parent (portrait), use `display: contents` rather than duplicating the frame on the children.

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

Before changing inventory interactions, read [inventory behavior](docs/inventory-behavior.md): section shortcuts,
consumable slot selection/replacement, automatic/manual counts and equipment feedback are part of the UI contract.

| Container | Mobile composition | Below 320px |
| --- | --- | --- |
| Inventory items | 4 equal columns | Preserve 4 columns and scale proportionally |
| Keepnet fish | 2 equal columns until the owner changes this rule | Preserve 2 columns and scale proportionally |

A browsable collection (backpack items, keepnet fish) is two containers of the shared `inventory-collection` block: filters in their own panel, a gap, then the scrolling items panel. Decorative illustrations lie inside the items panel; do not stack filters and items in one panel or layer a separate column underneath ([spec 074](specs/074-header-sections-and-collections/spec.md)). A pick never switches sections when the item list is already visible; read visibility from the rendered layout, not from duplicated breakpoints.

Touch gestures follow `touch-action`, which the browser resolves from the touched element up to its nearest scroll container only. Every scroller therefore declares the native pan axes it owns through its shared drag-scroll class (`inventory-horizontal-scroll`: `pan-x pan-y`; `inventory-vertical-scroll`: `pan-y`); a gesture on another axis must reach a JS controller (the backpack pager) instead of the browser, which otherwise turns a horizontal swipe into history navigation. A rule on an ancestor above the scroller never applies inside it ([spec 079](specs/079-pager-touch-axis/spec.md)).

Every scrolling list or row whose children are pressable (cards, chips) attaches the shared drag-scroll controller (`HorizontalScrollController`, `axis: "y"` for vertical lists): a drag scrolls and never activates the child under the pointer, touch keeps native panning. Likewise a game-world drag that cannot perform its action (casting without a cast-ready rod) must pan, not fall back to the action and its warning ([spec 076](specs/076-scroll-input-fixes/spec.md)).

A scrolling region needs a bounded height. Every box between the container that owns the height and the element with `overflow: auto` must pass it down: a flex/grid item with `min-height: 0` (and `flex: 1` or a `minmax(0, 1fr)` track). Never insert an unstyled wrapper into that chain; it grows with its content, the list stops scrolling and the overflow is clipped. When one component hosts another's content (a pager page holding a list), the host takes the nodes as its direct children instead of wrapping them again. The inventory UI check asserts the list's height chain.

A grid row or column template describes the container's children. When a child moves into or out of a grid container, update its `grid-template-rows`/`-columns`/`-areas` in the same change: a leftover track shifts the remaining children into the wrong tracks (G-061: a removed warning row left the inventory's main area in a content-sized row and collapsed the equipment section to 0 px). The inventory UI check compares the modal's row tracks with its children.

Stack optional rows (filters, sorting) with flex or auto-placed rows, never with fixed empty grid tracks: a hidden row must reserve no gap. Space neighbouring containers with the one `--inventory-container-gap` token (the column gap on wide layouts, the mobile inset on phones). Alternative views of one container on a phone (the backpack's items and backpack pages) use `InventoryCollectionPagerRenderer` with tabs in the main tab style and `SwipePagerController`; wide layouts show both views without a pager ([spec 075](specs/075-backpack-pager-and-capacity/spec.md)).

Use equal gaps between cards. Internal spacing and icon dimensions should be consistent within each card type. Earlier specifications describing four keepnet columns remain historical; the current keepnet rule is two columns.

## 8. Illustrations, proportions and minimal text

- Identification tabs of items and cells use recognizable icons instead of permanently repeated names; text is added for a value, a count, an action or an explanation. Accessible names, hints, warnings and required confirmations stay ([spec 091](specs/091-mobile-editor-parameter-tabs/spec.md), the phone item editor).
- Identify empty compartments with recognizable minimalist vector icons in closely related light-grey tones. Selected-item artwork replaces the placeholder.
- **Scale and meter icons are interface, so they are SVG.** The icon beside a scale or meter (backpack capacity, load, keepnet capacity and similar) is a vector UI icon from `assets/ui/` (`assets/ui/inventory/*.svg` or a sprite symbol such as `status-icons.svg`), never raster item artwork (WebP/PNG). Item artwork may illustrate the item itself (cards, previews, the backpack view, toolbar buttons), but it does not replace the interface icon of a scale, even when the scale belongs to that item.
- Use `currentColor` for vector themes where the SVG embedding method supports it: `stroke` for outline icons and `fill` for filled icons. An external SVG loaded through `<img>` does not inherit `currentColor` from its HTML parent; do not rely on that inheritance.
- Control and equipment illustrations must fit without cropping (`contain`). Use `cover` for photos/thumbnails only when cropping is explicitly allowed; keepnet fish thumbnails permit it with small, consistent edge insets.
- The equipment container follows the owner's grey reference ([spec 067](specs/067-inventory-sections/spec.md)): one container-relative unit sizes the rod cell, the dependent column (three units tall, shared by any number of dependent slots) and the four auxiliary wells, so the composition keeps its proportions and stays centered at every scale. When its container is at least as wide as tall (wide and landscape layouts), the four wells stand in a column left of the primary panel and as tall as it, so the composition grows with the width instead of shrinking to the height; the column takes the free width and uses the primary panel's inset as its padding and as its gap to it. The rod cell takes the remaining width (no fixed 9:16 proportion) and spans the panel when no rod is selected. Its contents stay within the cell; the equipped rod's condition meter sits under it in its own stats container, styled like the backpack's stats container (an `inventory-panel` with the meter inside).
- On mobile, the keepnet illustration container is at least as tall as it is wide. The image fits the available width and preserves its intrinsic proportions; portrait images increase the container height.
- **Text glyphs (emoji) are icons, not text** ([spec 073](specs/073-glyph-ink-centring/spec.md)). Fonts draw them outside their layout boxes: Segoe UI Emoji is 1.373em wide and its ink sits 0.06em below a `line-height: 1` box centre; other platforms differ. Create every emoji icon with `InventoryDomFactory.glyph(text, className)`. The consumer class only sizes its square box (`width`/`height`) and may set `--ui-glyph-scale` (share of the box, default 1) or `--ui-glyph-max-size`; `ui-glyph.css` owns centring, font and line height, and the measured ink shift corrects the font. Never:
  - centre a glyph with Grid in a box narrower than its advance (the implicit `auto` column grows to the advance and starts at the box's left edge, so `place-items: center` shifts the ink right);
  - size the font as the box (`font: <box>/1 …`) and expect the ink to fit, or set `display`, `font`, `line-height` or alignment on a glyph consumer class (the UI components check rejects it);
  - correct a misaligned glyph with pixel offsets or per-glyph constants: find the layout cause and measure the ink instead.
  Inline symbols inside a sentence (tooltip titles, labels) stay text. Item artwork and SVG icons remain the preferred visuals; glyphs are their fallback.
- Add permanent text only when it communicates useful state, quantity or action consequences. The keepnet occupancy counter uses `0 / 100` above the meter.
- Keep icon names and instructions available through accessible names, contextual hints and help popovers. Minimal text does not remove accessibility, errors or necessary confirmations.
- **Transient notices use a bottom sheet** (owner TK-001, v0.43.0, supersedes the transient-placement rule of spec 086). Inventory warnings and House notices reuse `UiHintRenderer` with the injected `HintSheetController`: one message, rounded top corners, the shared keyboard-accessible handle, a five-second timer and downward dismissal at 10% of the initial sheet height. The active screen owns bottom/safe-area placement; split inventory keeps the sheet inside its own surface. Notices do not push the header/content down or create another modal focus trap. Long text scrolls inside the bounded sheet; dragging from scrolled text scrolls it, while downward dragging from its start dismisses. Persistent help and validation retain their own flow locations; pointer tooltips retain their existing placement and shared surface tokens. Motion follows reduced-motion preferences; timers, handlers and capture are disposed with the screen.

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
- Hover is disabled on phones, tablets, UI widths up to **1024px**, every portrait viewport and any device with touch input, including a touch laptop with a mouse. Enable it only when the UI and viewport are wider than 1024px, the viewport is landscape, the primary pointer is fine and supports hover, there is no coarse pointer and `navigator.maxTouchPoints` is zero. If capabilities are unavailable, leave hover disabled.
- The injected `UiSurfaceAdapter` owns this policy through `hoverEnabled` and the root modifier `ui-surface--desktop-hover`. Every CSS `:hover` and decorative `:active` selector must be scoped to that modifier. JavaScript hover hints use the same policy and dismiss an open hover hint when it becomes disabled. Do not emulate hover with touch events or cover conflicting rules with a universal reset or `!important`.
- On mobile, portrait and touch devices, links and link-like controls must not acquire a background, glow or transform merely from tapping/pressing them. Disable the browser tap highlight with inherited `-webkit-tap-highlight-color: transparent` on each UI/page root. Actual selected, expanded, disabled and gameplay states remain meaningful states; keyboard `:focus-visible` remains visible.
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

## 13. UI performance and resize

- Keep one game loop with update separate from render. Resize handlers mark pending work; coalesce a burst into at most one Canvas/viewport resize before the next game update. A DOM-only UI surface may schedule one pending measurement with `requestAnimationFrame`. Do not create another continuous render loop or render for every resize/observer event.
- Apply CSS variables, classes and DOM readings only when the represented value changes. Compare Canvas dimensions before assigning `width`/`height`: even an unchanged assignment resets the bitmap and context. Unchanged measurements must produce zero layout writes and zero subscriber updates.
- ResizeObserver feedback must settle. A viewport surface observes its external frame, never the content whose dimensions it sets. A flow surface may observe content to maintain its scroll footprint, but only writes a changed footprint. Do not make a size observer continually change its own observed size.
- Group layout reads and writes. Avoid repeated write/read/write cycles, repeated DOM queries and DOM geometry reads in the game loop. Cache nodes and reuse descriptors/callbacks where their lifecycle allows it; measure only the geometry needed for the change.
- Update numeric text, meter values and changed item state in place. Preserve scrolling, focus and images; do not rebuild the entire inventory, equipment tree or image list for each reading, pointer movement or frame. Keep existing update timing unless a separate behavior change is authorized.
- On mobile, equipment and inventory items occupy separate container rows. Content-driven equipment uses `max-content`/automatic height and does not shrink beneath its contents. Explicitly place categories, optional filters, sorting and item lists in their rows; hiding a control must not put two regions into the same row. Constrain scrolling on the item region, without overlapping equipment or inheriting desktop percentage heights into a content-driven mobile layout.
- Dispose scheduled frames, observers, media-query listeners and event listeners with their owner. Reopening a panel must not accumulate handlers, subscriptions or render loops.
- For resize changes, add meaningful regression counters: a burst of 100 resize events produces one pending resize; repeated unchanged measurements/observer deliveries produce zero CSS/Canvas dimension writes and leave no continuously scheduled work. Cover an open populated inventory, repeated open/close, widths 240/280/319/320/1024/1025px, portrait, touch and hybrid input. These counters prove bounded work; FPS/latency claims require an actual performance profile. Preserve the owner's visual acceptance workflow.
