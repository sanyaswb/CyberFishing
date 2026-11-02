# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.49.62 - Pixi and waves after start

- TK-183: the 2D canvas draws the first frame, the Pixi bundle is excluded from release preloads and loads via the asset load plan's features layer after ready, and PixiWaterRenderer scales waves against the registry's full image width so waves are never stretched when the background starts from a low-quality copy. Scene-layer and lazy-features checks assert the behavior. Game-cycle report unchanged.

## v0.49.61 - Overlay scroll and viewport bounds

- TK-182: the DEV overlay is bounded by the screen height (`max-height: calc(100% - 20px)`, `overflow-y: auto`, `touch-action: pan-y`) and its scale buttons stick to the bottom, so long reports scroll and remain accessible on phones. Startup-load-report check asserts the contract. Game-cycle report unchanged.

## v0.49.60 - Rod picture from the start

- TK-181: the rod is no longer a rectangle until its Spine export arrives: a small upright picture of the atlas region (9.9 KB, first layer of the load plan) stands in the export's setup pose at the same scale and line tip. Start 0.70 -> 0.71 MB. Game-cycle report unchanged.

## v0.49.59 - Rod towards the centre

- TK-157: a cast aimed to one side no longer puts the rod straight under it: the target is chosen as before, then the rod (and the line's origin) moves towards the screen centre as far as the longest cast still reaches the target, never past the centre; a cast at the full line length keeps the rod under the target. Game-cycle report unchanged.

## v0.49.58 - Float under the rod

- TK-158: depth order is float, line, rod (the rod is nearest the camera and covers the float where they meet), on the 2D canvas and in the WebGL scene; render-resolution checks both. Game-cycle report unchanged.





