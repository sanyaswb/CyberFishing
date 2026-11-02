# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.49.65 - Scaled overlay width and mobile viewport constraints

- TK-186: the DEV overlay width scales responsively with `--debug-overlay-scale` (`width: calc(340px * var(--debug-overlay-scale, 1))`, `min-width: calc(180px * var(--debug-overlay-scale, 1))`, `max-width: calc(100% - 20px)`); row labels and values wrap breaking long text anywhere so the unzoomed intrinsic content no longer stretches the window to full viewport width on mobile phones; drag clamping enforces dynamic maxWidth within the UI surface so scaling down contracts the window bounds smoothly instead of keeping it pinned against the right screen edge. Game-cycle report unchanged.

## v0.49.64 - Overlay hidden scrollbar and separate containers

- TK-185: the DEV overlay scrollbar is hidden (`scrollbar-width: none`, `-ms-overflow-style: none`, `::-webkit-scrollbar: none`); the overlay forms a unified window with a scrollable content area containing the report and action buttons, logically separated by a divider from the bottom scale buttons (+ / -) so buttons never overlap text and remain always accessible; scale buttons layout within window padding without straddling borders, viewport drag/clamp prevents taskbar overlap; keyed DOM diffing preserves collapsible load plan sections without flicker or toggle race conditions. Startup-load-report check asserts the behavior. Game-cycle report unchanged.

## v0.49.63 - Boat, editor and victory in layer-three

- TK-184: the bait boat, item assembly editor, and victory screen presentation modules are deferred to the asset load plan's third layer (start "after:layer-two"); a first action requesting any of them loads the module interactively without startup delay, while the game core remains at the start. Lazy features check asserts the behavior. Game-cycle report unchanged.








