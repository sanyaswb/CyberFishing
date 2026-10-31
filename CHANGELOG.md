# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.49.35 - Trial release bundle

- Spec 157 R13 (trial, owner decides after Pages): the release is one self-contained folder built from a commit (`npm run build:release`): esbuild bundles with hashed chunks, minified, with source maps, a boot module per page (`?esm=1` runs the source modules), preloads in the pages; Pages and a game server serve the same folder (cold start on Fast 4G 2.3 → 1.55 s, 3G 10.9 → 6.3 s locally; 68 instead of 709 requests). Server requirements: docs/deployment.md. The repository and local work stay without a build. Game-cycle report unchanged.

## v0.49.34 - Sprite icons before start

- TK-174 / spec 157: until the game is ready the classic backpack and keepnet buttons (R11 stand-ins, and classic mode) show the sections sprite's icons instead of the 2048 px briefcase and the keepnet art (0.44 MB no longer requested before the start); the art replaces each icon once it has loaded after the first frame. Game-cycle report unchanged.

## v0.49.33 - Current background phase only

- Spec 157 R4: the game starts with only the background phase of the current game time (and its overlay at dusk or dawn); the other phases load right after the first frame, and until one arrives the nearest loaded phase is drawn (cold start on Fast 4G 2.7 → 2.3 s, 3G 12.8 → 11.0 s locally). Game-cycle report unchanged.

## v0.49.32 - Hidden UI images after start

- Spec 157 R6 (TK-172): images of the closed inventory and hidden toolbar buttons are lazy (loading before src) and no longer load before the game starts; after the first frame they warm up one at a time, so the inventory opens without a network wait; depth selector icons load after start too. The startup measurer takes --cpu N. Game-cycle report unchanged.

## v0.49.31 - Water visible again

- TK-171 fix: since v0.49.26 the startup screen's inline style set a background on `html`, so the page's grey body background was painted above the WebGL scene (z-index -1) and the water was a grey screen; the root background is removed (incident I-9). Game-cycle report unchanged.

## v0.49.30 - Owner style edits

- TK-169 (owner's edits): the inventory panel border is warm grey (rgba(218, 204, 201, 0.23) instead of the cool grey), the simple aquarium feed icon's box and circle outline are grey instead of brown; theme.css card/socket sizes reformatted, values unchanged. Game-cycle report unchanged.

## v0.49.29 - One bamboo rod art

- Spec 157 stage C: the bamboo rod's with-line and no-line fields point at one file (bamboo-rod-ecip-v1.webp); the byte-identical bamboo-rod-unecip-v1.webp is removed (owner: one art until a separate no-line art). The Pages release check rejects two item art files with the same bytes. Game-cycle report unchanged.

## v0.49.28 - Display-sized keepnet art

- Spec 157 stage C: the six keepnet fill stages are 768 px WebP middle (0.80 MB instead of 3.89 MB; largest phone view ~374 CSS px), masters in asset-sources/items/keepnet; convert-images --thumbnails takes --quality low|middle|high and sizes up to 2048 px. Game-cycle report unchanged.

## v0.49.27 - Module preload on Pages

- Spec 157 stage B: the Pages release writes `<link rel="preload" as="style">` for every stylesheet and `<link rel="modulepreload">` for every module of the page's graph into the root pages, so the browser requests them in parallel (request waves 24 → 4; cold start on Fast 4G 3.6 → 2.7 s, 3G 14.2 → 13.0 s locally). Game code unchanged. Game-cycle report unchanged.

## v0.49.26 - Static startup screen

- Spec 157 D0: a black startup screen with an inline SVG spinner paints straight from the HTML (game stylesheets now follow it in the body) and fades out at the first frame of play (data-game-ready); first paint on a cold Fast 4G start 2920 → 120 ms, 3G 12740 → 212 ms locally. Game-cycle report unchanged.
