# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.49.38 - Location assets by id

- TK-178 / spec 157 R16 (b): `AssetRegistry` (engine, pure: `pathOf`, `spineOf`, `has`, `idsByTag`) composed once in the composition root; locations name their background phases and depth map by asset id (`backgroundAssets`, `depthAsset`), and the location loaders resolve the files where they load them; new check `asset-references`. Same requests before the start. Game-cycle report unchanged.

## v0.49.37 - Asset registry

- TK-178 / spec 157 R16 (a): `npm run assets:sync` keeps a generated registry of every tracked asset under a stable id (`src/game/config/generated/asset_registry.js`, 156 assets; a Spine export is one asset); moved files keep their id (same content, git rename or `--moved`), ambiguous or vanished referenced files stop the sync; `--check` runs in Full. Code and configuration move from paths to ids in the next steps. Game-cycle report unchanged.

## v0.49.36 - Version badge label

- TK-167: the version badge's `aria-label` in `index.html` / `dev.html` was double-encoded UTF-8 since v0.48.45 (a rewrite in the ANSI code page); it reads «Поточна версія гри» again, and the new `text-encoding` check rejects double-encoded or invalid UTF-8 in shipped text (incident I-10). Game-cycle report unchanged.

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
