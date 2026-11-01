# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.49.54 - Radio after the start

- Spec 157 R12 step (b): the asset load plan names code modules ({ module }) and a new layer of features warmed up after the first frame through the same load queue (the player's first use asks for a module at once, without a second load); LazyFeature composes a feature when its module arrives. The radio is the first such feature: receiver, player, effects, stations, HUD indicator and editor controls load after ready (16 modules off the start; index.html 0.71 -> 0.70 MB); a radio left on starts once it arrives. New check lazy-features. Game-cycle report unchanged.

## v0.49.53 - Start-only preloads

- Spec 157 R12 step (a), TK-176 item 2: a release page preloads only the chunks its start loads (the bundle's static chunks and the start's own import() calls, START_IMPORTS in utils/build-release.js); spine-webgl (the rod engine of the 2D canvas scene mode) and dev.html's House screen load on demand. index.html start 0.78 -> 0.71 MB (Fast 4G 1235 -> 1160 ms, 3G 5131 -> 4726 ms). Game-cycle report unchanged.

## v0.49.52 - Item art 1024 px

- Spec 157 R6 step 2: one image per item at most 1024 px (WebP middle) for every place; measured, the editor preview draws an item at most 375 CSS px tall on phones in both orientations (748 device px at ratio 2), the toolbar net/boat buttons under 190 px and the scene boat is Spine. Briefcases, bait boats, net, float, rod, oil worms 100, batteries 3-4 re-encoded from masters now kept in `asset-sources/items/` (never released), bread 50 from its PNG master: item art 3.26 -> 2.24 MB per release. `convert-images.js --thumbnails` refuses two masters writing one file. Game-cycle report unchanged.
