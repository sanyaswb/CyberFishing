# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.49.51 - One fish image

- TK-180: each fish has one runtime image (the 768 px display art); keepnet cards and the aquarium show its generated low copy (~192 px), the hand-made `assets/fish-thumbnails/` are gone and the 2752 px masters moved to `asset-sources/fish/` (never released: -4.8 MB per release). Saves written earlier keep their master path and still find the same fish's image (recognised through the asset id scheme); new catches store the display image's path. `assets:sync` removes low copies whose image is gone. Game-cycle report unchanged.

## v0.49.50 - Loading overlay with the plan

- Spec 157 stage D6 (TK-177 item 8, TK-178 item 8): the DEV overlay «ЗАВАНТАЖЕННЯ» shows the asset load plan layer by layer (each group's state, priority, readyOn, time, compressed size and, for small groups, its files) and a duplicates row (one content under two ids), and the JSON report carries the plan; DevTools «Сервіс → ПЛАН ЗАВАНТАЖЕННЯ» exports the plan as the configuration module's text, takes an edited plan (validated) for the next start and resets it. Production unchanged. Game-cycle report unchanged.

## v0.49.49 - Loading bar with megabytes

- Spec 157 stage D5 (owner Q7): the release startup screen shows a bar and the loaded / total megabytes in compressed bytes; the release writes a startup manifest per page (the page, stylesheets, preloaded modules and the asset load plan's first layer with their gzip sizes) and its total into the screen; a tiny meter bundle the boot module imports first counts the transferred bytes until ready. The ?esm=1 module list moved out of the boot module into a JSON fetched only with ?esm=1. Game-cycle report unchanged.

## v0.49.48 - Background ready on its low copy

- Spec 157 stage D4b (TK-179, owner: readyOn "low" on): the game starts with the low-quality copy of the current background phase (13 KB instead of 223 KB); the full file loads right after the first frame and replaces it in the scene once decoded (the image store keeps the copy until then; the scene re-uploads the texture). Game-cycle report unchanged.

## v0.49.47 - Low copy first in the UI

- Spec 157 stage D4a (TK-179): inventory, keepnet and selector images whose file has not loaded show their low-quality copy first; once shown, the full file is requested ahead of the background and replaces the copy in the same element after decoding (a failed copy falls back to the full file, a failed full file keeps the copy). The background warm-up after the first frame now loads the small copies. Game-cycle report unchanged.

## v0.49.46 - Low-quality copies

- Spec 157 stage D3 (TK-179): `npm run assets:sync` makes a low-quality copy of every raster image except depth maps under `assets/low-copies/` with `utils/convert-images.js --low-copies` (a quarter of the longest side, at most 256 px, WebP Low; 122 copies, 0.52 MB) and records each image's width, height, copy and source hash in the registry; `--check` fails on a missing, untracked or stale copy. Nothing loads them yet (stage D4). Game-cycle report unchanged.

## v0.49.45 - Load priorities and pause

- Spec 157 stage D2: the asset load plan runs through one priority queue (`AssetLoadQueue`): the first layer blocks, the second and third are capped background work that waits in a hidden tab, offline or with save-data (`BrowserLoadConditions`), and what the player opens (`request`, today the equipped rod's art in the selector) loads ahead of them, promoting a queued job; loads retry once. Game-cycle report unchanged.

## v0.49.44 - Asset load plan

- Spec 157 stage D1 (TK-177): the asset load plan in configuration (`src/game/config/raw/assets/asset_load_plan.js`: three layers, groups by priority, entries by asset id, tag or game-state source; registry assets without a place form an `unassigned` group) runs through `GameAssetPreloadFacade` over the game's one image store, keyed by asset id; it replaces the scattered preloads (current background phase and depth map, float art, slot placeholders, later phases, depth icons, selector art, keepnet stages). Today's plan repeats the loads before stage D: the same files before the start. Game-cycle report unchanged.

## v0.49.43 - Fish art by id, no asset paths in code

- TK-178 / spec 157 R16 (c–d): fish name their art by asset-id patterns (`visual.imageAssetPattern`, `uniqueImageAssetPattern`); `FishVisualVariantResolver` hands out the registry's file (a caught fish keeps the same `imagePath` in saves) and `FishArtVariants` maps it to the thumbnail and display variants through the registry (`AssetRegistry.idOfPath`). The `asset-references` check now forbids `"assets/…"` literals in every source, stylesheet and page except the generated registry. Game-cycle report unchanged.

## v0.49.42 - Inventory art by id

- TK-178 / spec 157 R16 (c, inventory): item art (`iconAsset`, `switcherIconAsset`, `skin.thumbnail.asset`, rod `withLineAsset`/`withoutLineAsset`, boat `baitAsset`/`noBaitAsset`), slot placeholders, inventory sections and their sprite, keepnet fill stages and aquarium feed boxes are named by asset id; `InventoryDomFactory` (`image`, `svgIcon`, `assetUrl`), the keepnet views, selector, depth selector, landing net and chum buttons, House feed images and the DEV shop resolve the files through the registry. Same requests before the start. Game-cycle report unchanged.
