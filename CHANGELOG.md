# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.49.64 - Overlay hidden scrollbar and separate containers

- TK-185: the DEV overlay scrollbar is hidden (`scrollbar-width: none`, `-ms-overflow-style: none`, `::-webkit-scrollbar: none`); the overlay forms a unified window with a scrollable content area containing the report and action buttons, logically separated by a divider from the bottom scale buttons (+ / -) so buttons never overlap text and remain always accessible; load plan layers and file/request groups are collapsible sections (`<details>`). Startup-load-report check asserts the behavior. Game-cycle report unchanged.

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

## v0.49.57 - VOLIA at 32 kbit/s

- Spec 157 F (owner: 32 kbit/s): the three VOLIA 77.2 recordings are AAC (.m4a), mono, 32 kHz, 32 kbit/s, re-encoded with utils/convert-audio.js: 68.80 -> 8.34 MB per release; the originals moved to asset-sources/audio/radio/volia/. Asset ids and the playlist are unchanged. Game-cycle report unchanged.

## v0.49.56 - No duplicate keys

- Spec 157: the 11 duplicate object keys esbuild warned about (fight diagnostics, game config, fish force, pressure fatigue) are removed; each pair held the same expression, so values and key order are unchanged. The release build now fails on any esbuild warning. Game-cycle report unchanged.

## v0.49.55 - Hidden names in build

- Spec 157: the release refuses a file GitHub Pages would hide (a name segment starting with _ or .) in build/ too, where esbuild names chunks after their modules; PagesReleaseBuilder.hiddenFile is checked by pages-release. Game-cycle report unchanged.


