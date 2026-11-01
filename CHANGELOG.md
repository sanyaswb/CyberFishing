# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.49.51 - One fish image

- TK-180: each fish has one runtime image (the 768 px display art); keepnet cards and the aquarium show its generated low copy (~192 px), the hand-made `assets/fish-thumbnails/` are gone and the 2752 px masters moved to `asset-sources/fish/` (never released: -4.8 MB per release). Saves written earlier keep their master path and still find the same fish's image (recognised through the asset id scheme); new catches store the display image's path. `assets:sync` removes low copies whose image is gone. Game-cycle report unchanged.

## v0.49.50 - Loading overlay with the plan

- Spec 157 stage D6 (TK-177 item 8, TK-178 item 8): the DEV overlay «ЗАВАНТАЖЕННЯ» shows the asset load plan layer by layer (each group's state, priority, readyOn, time, compressed size and, for small groups, its files) and a duplicates row (one content under two ids), and the JSON report carries the plan; DevTools «Сервіс → ПЛАН ЗАВАНТАЖЕННЯ» exports the plan as the configuration module's text, takes an edited plan (validated) for the next start and resets it. Production unchanged. Game-cycle report unchanged.

## v0.49.49 - Loading bar with megabytes

- Spec 157 stage D5 (owner Q7): the release startup screen shows a bar and the loaded / total megabytes in compressed bytes; the release writes a startup manifest per page (the page, stylesheets, preloaded modules and the asset load plan's first layer with their gzip sizes) and its total into the screen; a tiny meter bundle the boot module imports first counts the transferred bytes until ready. The ?esm=1 module list moved out of the boot module into a JSON fetched only with ?esm=1. Game-cycle report unchanged.

## v0.49.48 - Background ready on its low copy

- Spec 157 stage D4b (TK-179, owner: readyOn "low" on): the game starts with the low-quality copy of the current background phase (13 KB instead of 223 KB); the full file loads right after the first frame and replaces it in the scene once decoded (the image store keeps the copy until then; the scene re-uploads the texture). Game-cycle report unchanged.
