# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.49.75 - Depth selector equipped float with night glow, 50% default depth, full rod thumbnail and 45deg float rotation

- TK-192 / TK-193: depth selector button dynamically displays the equipped float (with additive green glow tip for `float_night`) instead of hardcoded day float; default float depth set to 50% of available max depth instead of 0.1m. Rod inventory thumbnail displays full rod (`visibleHeight: 1, focusX: 0.5`) and floats are rotated by 45 degrees in cards and depth selector button. Inventory-ui, inventory-selector and ui-components checks assert the behavior. Game-cycle report unchanged.

## v0.49.74 - Night float glowing tip in cards and assembly editor

- TK-192: night float (`float_night`) renders an additive green glowing tip overlay (`items.floats-scene.float-day-glow`, `.inventory-item-card__glow-image`) over the float antenna in inventory item cards, equipment slots and assembly editor preview, distinguishing it from the day float without duplicate raster assets. Inventory-ui check asserts the behavior. Game-cycle report unchanged.

## v0.49.73 - Float night glow only on tip

- TK-159: night float halo is disabled by default (`nightHalo: false` in `CONFIG.ui.float` and builder) so only the antenna tip glows green additively (`nightTipGlow`, `float-day-glow.webp`) at night as specified in spec 127; the full-body green radial halo / canvas shadow is no longer drawn over the float body. Float-pose check asserts the behavior. Game-cycle report unchanged.

## v0.49.72 - Isolate touch gestures and allow metric label drag hold

- TK-191: DEV overlay window dragging (`OverlayWindowDragController`) no longer aborts pointerdown on `.debug-overlay__metric-label`, allowing hold-to-drag initiation anywhere on the report; active dragging captures and prevents default on touchmove (`{ passive: false, capture: true }`) to block mobile browser vertical scroll takeover, raises movement slop threshold to 18px to prevent micro-wobble cancellations, and freezes content overflow/pointer-events during movement. Game-cycle report unchanged.

## v0.49.71 - Scope overlay metric underline to desktop hover

- TK-190: DEV overlay metric labels (`.debug-overlay__metric-label`) display as clean unstyled text on touch devices without pseudo-link dotted underline or press highlighting; dotted underline decoration and help cursor are scoped exclusively to desktop pointer hover (`.ui-surface--desktop-hover`). Game-cycle report unchanged.

## v0.49.70 - Suppress long-touch vibration and configure 800ms hold

- TK-189: draggable overlay and child elements prevent native browser touch selection and context menu triggers (`.debug-overlay, .debug-overlay * { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }`), eliminating native vibration from Chrome text selection handles or context menu; drag hold duration is unified to 800ms (`dragHoldTimeMs: 800`) across game config and drag controllers. Game-cycle report unchanged.

## v0.49.69 - Scroll lock during active window drag

- TK-188: when long-click window drag activates (`.draggable-window--dragging`), content scrolling is completely locked (`overflow-y: hidden !important`, `touch-action: none !important`, `pointer-events: none !important`, and element `touchAction = "none"`) so pointer motion drags the window without scrolling the content; text selection and iOS/Android touch callouts are disabled on the overlay window. Game-cycle report unchanged.

## v0.49.68 - Visual feedback and blue outline for draggable windows

- TK-187: movable windows (`OverlayWindowDragController`, `.draggable-window`) provide tactile visual feedback when long-click drag activates (`.draggable-window--dragging`); plays a brief scale contraction and recovery animation (`draggable-window-pop`, scale 1 -> 0.96 -> 1), applies a 2px blue outline (`#2196f3`), and lightens the background (`rgba(30, 48, 68, 0.96)`) while dragging. Game-cycle report unchanged.

## v0.49.67 - Persistent scroll container in DOM patching

- TK-186: `OverlayDomAdapter.updateHtml` uses `#patchChildren` on the temporary wrapper instead of `#patchNode` on the container so `.debug-overlay__content` retains its CSS class, `overflow-y: auto`, and flex properties across updates; prevents the content container from expanding unconstrained and pushing the footer scale buttons (+ / -) out of view; verified visually in Chrome at 400px viewport. Game-cycle report unchanged.

## v0.49.66 - Clean overlay zoom and uncrushed mobile layout

- TK-186: DEV overlay scaling moves to container-level `zoom: var(--debug-overlay-scale, 1)` on `.debug-overlay` (`width: 320px`, `max-width: calc(100% - 20px)`, `max-height: calc(100% - 20px)`) so child metrics and scale buttons scale together cleanly; `.debug-overlay__label` uses `white-space: nowrap; flex-shrink: 0` to prevent metric labels from breaking into single vertical characters on narrow screens; verified visually in Chrome across multiple mobile viewport sizes. Game-cycle report unchanged.



