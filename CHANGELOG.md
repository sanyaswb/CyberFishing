# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.49.81 - New VOLIA 77.2 recording

- TK-198: the first VOLIA 77.2 track plays the owner's new recording (8:34) under the same asset id, as 32 kbit/s mono AAC like the other tracks; the master is in `asset-sources/`, the old `RADIO_VOLIA.m4a` is removed. Radio-receiver check asserts the file. Game-cycle report unchanged.

## v0.49.80 - Vector icons outside the inventory

- TK-197: the chum and boat button, the net fallback, the clock and its speed use symbols of the shared sprite; the world boat without Spine is a vector shape from above; the `emoji` stat is gone.

## v0.49.79 - Mobile weight scale moves to the rod panel

- TK-196: up to 820 logical px the load scale with its icon spans the bottom of `inventory-loadout-panel__primary` and is hidden in the header; wide layouts keep it in the header. The panel keeps its height. Inventory-ui check asserts the behavior. Game-cycle report unchanged.

## v0.49.78 - Inventory vector icons instead of emoji

- TK-195 (spec 158): items without art, filters, sort directions and the subfilter arrow use outline symbols of the sections sprite (`ui-icon` block); an item's `icon` now names a symbol. The rod and hook slot icons are redrawn. `InventoryDomFactory.glyph()`, `GlyphInkMetrics` and `ui-glyph.css` are removed. Ui-components check rejects an icon the sprite does not draw. Game-cycle report unchanged.

## v0.49.77 - Inventory control follows the configuration from the first frame

- TK-194: the radial selector or the classic buttons show from the first frame as `ui.inventorySelector.radialEnabled` says; the classic buttons no longer stand in for the selector while its artwork loads. Sectors show sprite symbols until the artwork arrives and keep them if it fails. Inventory-selector check asserts the behavior. Game-cycle report unchanged.

## v0.49.76 - Overlay drag hold threshold unified to 500ms

- TK-191: unified overlay and draggable button hold threshold to 500ms (`dragHoldTimeMs: 500` in `CONFIG.ui` and drag controllers) so visual drag mode activates in direct synchronization with standard mobile phone haptic long-press vibration. UI surface check asserts the behavior. Game-cycle report unchanged.

## v0.49.75 - Depth selector equipped float with night glow, 50% default depth, full rod thumbnail and 45deg float rotation

- TK-192 / TK-193: depth selector button dynamically displays the equipped float (with additive green glow tip for `float_night`) instead of hardcoded day float; default float depth set to 50% of available max depth instead of 0.1m. Rod inventory thumbnail displays full rod (`visibleHeight: 1, focusX: 0.5`) and floats are rotated by 45 degrees in cards and depth selector button. Inventory-ui, inventory-selector and ui-components checks assert the behavior. Game-cycle report unchanged.

## v0.49.74 - Night float glowing tip in cards and assembly editor

- TK-192: night float (`float_night`) renders an additive green glowing tip overlay (`items.floats-scene.float-day-glow`, `.inventory-item-card__glow-image`) over the float antenna in inventory item cards, equipment slots and assembly editor preview, distinguishing it from the day float without duplicate raster assets. Inventory-ui check asserts the behavior. Game-cycle report unchanged.

## v0.49.73 - Float night glow only on tip

- TK-159: night float halo is disabled by default (`nightHalo: false` in `CONFIG.ui.float` and builder) so only the antenna tip glows green additively (`nightTipGlow`, `float-day-glow.webp`) at night as specified in spec 127; the full-body green radial halo / canvas shadow is no longer drawn over the float body. Float-pose check asserts the behavior. Game-cycle report unchanged.

## v0.49.72 - Isolate touch gestures and allow metric label drag hold

- TK-191: DEV overlay window dragging (`OverlayWindowDragController`) no longer aborts pointerdown on `.debug-overlay__metric-label`, allowing hold-to-drag initiation anywhere on the report; active dragging captures and prevents default on touchmove (`{ passive: false, capture: true }`) to block mobile browser vertical scroll takeover, raises movement slop threshold to 18px to prevent micro-wobble cancellations, and freezes content overflow/pointer-events during movement. Game-cycle report unchanged.
