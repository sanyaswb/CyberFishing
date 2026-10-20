# Tasks: Spine rod animation and Spine in the engine

**Input**: [spec.md](spec.md); contracts of [spec 047](../047-smart-asset-preloader/contracts/runtime-assets.md) and
[spec 083](../083-preloader-foundation/spec.md).
**Scope**: implementation plan; nothing below is done by writing this file. Tasks marked **[Dn]** wait for that owner
decision in spec.md. Each phase ends with focused checks; the release needs Architecture + Quick + Full, the unchanged
game-cycle SHA-256 and the owner's browser check (Claude does not drive the UI). Commits and pushes happen only after
the owner agrees (UI change rule).

## Phase 0: Owner inputs

- [ ] T001 Owner answers D1–D9 in spec.md. D2–D5 and D7–D9 answered 2026-10-17; D1 (rendering path) and D6
  (mirroring) open.
- [X] T002 [D5] Owner re-exported `bamboo-rod-v1` on 2026-10-17: skin `rod-1` and the `line-tip` bone on `bone30`
  (verified at the mesh tip). The texture stays `Linear` for now (D7, compared later through T023). File names stay
  `rod.*` (the atlas names its page).
- [X] T003 [D8] Moved on 2026-10-17 (not staged): `rod.json`, `rod.atlas`, `rod.webp` → `assets/animations/rods/bamboo-rod-v1/`;
  master `assets/items/rods/bamboo_rod--1.png` → `asset-sources/animations/rods/bamboo-rod-v1/`; `src/Animations/`
  removed. Stage these paths explicitly with the implementation commit (never `git add -A`), then `npm run struct`.
- [ ] T004 Add backlog entry G-063 "Rod is a static rectangle; animate it with Spine" (P3) to `docs/gameplay_backlog.md`
  with a link to this spec.

## Phase 1: Runtime in the repository

**Goal**: a pinned, reproducible spine-webgl 4.3.13 module the browser and Node can import.

- [X] T005 [D2] `package.json` devDependency `"@esotericsoftware/spine-webgl": "4.3.13"` (exact; lock brings
  `spine-core@4.3.13`). The package ships a self-contained ESM bundle `dist/esm/spine-webgl.min.mjs` (250 KB, no
  imports, no source-map comment, ASCII, LF), so no esbuild is needed.
- [X] T006 [D2] `utils/vendor-spine.js` copies that bundle byte for byte to `vendor/spine-webgl/4.3.13/spine-webgl.js`
  with the package LICENSE, writes `vendor/manifest.json` (name, version, npm integrity, bundled spine-core, source
  path, SHA-256 of both files, importer) and `vendor/package.json` (`"type": "module"`, so Node imports the `.js` as
  ESM). `--check` compares vendor/ with what the installed package would produce; it passes after a write.
  Spec 103 stage 0 replaced the script with `utils/vendor-libraries.js`, which writes this entry unchanged together with
  the Pixi scene bundle's entry (`node utils/vendor-libraries.js`, `--check`).
- [X] T007 [D2] `utils/checks/architecture/architecture-check.js` `vendor` rule: vendor files are read, not held to project rules; each
  is listed in the manifest with matching SHA-256 (module and licence); a vendor module has no imports; only its
  manifest importer may import it; `vendor/package.json` declares the module type; unlisted vendor files fail. Seven
  fixtures (valid set, wrong importer, hash mismatch, vendor import, missing manifest, unlisted file, missing licence,
  missing module type). The `release:pages` listing of the vendor file is confirmed with T014/T026, once the importer
  imports it and it is committed.
- [X] T008 The vendored file imports in Node without a DOM (205 exports). It parses the real export: version 4.3.26,
  skin `rod-1`, six clips; 4.3 bone world positions are `bone.appliedPose.worldX/worldY`, the setup pose is
  `skeleton.setupPose()`. `line-tip` world (1.21, 466.06) at setup, (−237.54, 326.65) at full left bend, (1.27, 328.27)
  at full front bend.

**Checkpoint** (2026-10-17): Architecture 4/4 (709 modules, production 542 / 835 imports unchanged, 28 negative
fixtures), Quick 26/26, game-cycle digest unchanged. Nothing in the game imports the runtime yet. Not committed.

## Phase 2: Engine and platform Spine capability

**Goal**: everything Spine-generic, independent of the rod.

- [X] T009 `src/engine/animation/skeletal_scene_contract.js` (`SKELETAL_SCENE_METHODS`: setPlacement, setLoop,
  setSampled, clearTrack, setTrackTimeScale, update, render, getPoint, getLocalBounds, hasClip, clipDuration,
  getMissingClips, restoreContext, dispose) and `src/engine/animation/scalar_smoother.js` (`ScalarSmoother`,
  exponential approach with a time constant, no allocation).
- [X] T010 `src/platform/browser/assets/browser_asset_transport.js` (`BrowserAssetTransport`; in `assets/`, since it is
  generic): fetch text/JSON, decoded `HTMLImageElement`s (`Image.decode`). Not `ImageBitmap`: WebGL ignores the
  premultiply upload flag for ImageBitmaps, and spine-webgl 4.3 relies on that flag (`GLTexture` premultiplies straight
  pages on upload and always draws with PMA blending). A cancelled token drops the result. The same transport becomes
  083's browser transport.
- [X] T011 `spine_bundle_loader.js` (`SpineBundleLoader`) + `spine_atlas_text_reader.js` (`SpineAtlasTextReader`, pages,
  filters, PMA, region bounds/rotation without the runtime). Atlas text first, then each page and the skeleton JSON as
  their own `AssetLoadQueue` jobs; `pages` settles alone (static picture), `result` with the bundle `{ skeleton,
  version, atlasText, atlas, pages, skin, linePoint }`. Reasons: `atlas-failed`, `atlas-invalid`, `page-failed`,
  `skeleton-failed`, `cancelled`. No Spine `AssetManager`.
- [X] T012 `spine_gl_surface.js` (`SpineGlSurface`): offscreen canvas created on first `ensureContext()`, WebGL 2 then
  1 (`alpha`, `premultipliedAlpha: true`, `antialias`, no depth/stencil, `preserveDrawingBuffer: false`), integer
  `resize(width, height)` in game canvas pixels (1:1 with the game canvas, so no pixel ratio of its own),
  `maxTextureSize`, lost/restored listeners (lost is prevented so the context can return), `simulateContextLoss` for
  DEV, `dispose()`.
- [X] T013 `spine_scene.js` (`SpineScene`, the only user of the Spine API). Runtime namespace and graphics (texture
  factory, renderer factory, restore) are injected, so checks build it in Node with fake textures. 4.3 names:
  `getTrack`, `setAnimation`/`addAnimation` with an Animation, `setupPose`/`setupPoseBones`, `bone.appliedPose`,
  skin entries `placeholder`. Bones start from the setup pose every frame (`setupPoseBones`), so blended tracks are
  exact and never build on the previous frame. Bounds = union of the setup pose and 25 samples per clip
  (`getBoundsRect`). Reasons: `version-mismatch`, `page-missing`, `texture-too-large`, `skeleton-invalid`,
  `skin-missing`. A failure disposes the textures it made.
- [X] T014 `spine_runtime_module.js` imports `vendor/spine-webgl/4.3.13/spine-webgl.js`; `createSpineRuntime()` returns
  `{ version: "4.3.13", createScene(bundle, surface) }` with one `ManagedWebGLRenderingContext` per surface;
  `context-unavailable` without WebGL. `asset-preloader` now checks the provider over the real module (4.3 export →
  available, 4.2 export → version-mismatch) and keeps the not-installed case with a fake module.

**Checkpoint** (2026-10-17): new Quick check `spine-rod` (real export through the vendored runtime: line-tip at setup
(1.21, 466.06), pure left bend (−237.54, 326.65), front (1.27, 328.27), exact front/side weights, idle loop and time
scale, failures, bounds, restore, dispose; loader, surface, transport, smoother). Architecture 4/4 (716 modules,
production unchanged 542 / 835), Quick 27/27, game-cycle unchanged. Finding for Phase 3: front alpha must be
1 − |side| (spec "Pose mapping" updated). Nothing in the game uses Spine yet. Not committed.

## Phase 3: Rod in the game

**Goal**: the equipped rod draws and animates through Spine; the fallback stays bit-for-bit.

- [X] T015 Config. `ITEM_DB.rods.rod_test_float.skin.animation { skeleton, atlas, skin: "rod-1", linePoint: "line-tip" }`
  (no bundleId: the URLs are the key). `CONFIG.ui.rod.spine { heightRatio 0.25, sideRangeRatio 0.35, windClips
  { left, calm, right }, fightClips { front, left, right }, windMixSec 1, idleToFightSec 0.25, fightToIdleSec 0.4,
  bendSmoothingSec 0.12, windRainTimeScale false }`. `ConfigSchemaValidator` checks the ranges, clip names and
  project-relative `.json`/`.atlas` paths of every skin animation. heightRatio 0.25 keeps today's 200 px rod on an
  800 px canvas.
- [X] T016 `RodAnimationStateResolver` (pure, reused snapshot): idle clip by wind −1/0/+1, idle time scale (reduced
  motion 0, optional rain), side from the fish's offset to the rod base, front weight 1 − |side|, side weight |side|,
  bend target = clamped `rodStressRatio` while playing. Wind: `EnvironmentSystem.getSnapshot().wind` read-only, so no RNG
  is consumed.
- [X] T017 `RodAnimationController`: `setSkin` every frame (string compare, a change releases the old load and ignores
  stale results), bundle then runtime then scene; modes rectangle → static → spine, lost context or DEV force → static;
  the new skin's bundle drops the old scene; `advance(context)` smooths the bend (`ScalarSmoother`), drives tracks 0
  (idle, fades out on fight start, back with `fightToIdleSec`), 1 (front) and 2 (side), and keeps the last side while
  the bend relaxes after a fight. Sizes the GL surface from the scene's local bounds and writes the `RodAnchorFrame`
  (mode, base, tip, scale, GL destination, static image/region/bounds). It runs at frame build (spec "Order in a
  frame"), not next to `RodVisualOffsetSystem`.
- [X] T018 `RodSpineRenderer` (order FISHING_EQUIPMENT − 1): `controller.renderScene()` then `drawImage(glCanvas)` at
  the anchor, Spine mode only. `RodLineRenderer` draws the rectangle only in mode `rectangle` and the line from
  `lineStartX/Y` (the tip).
- [X] T019 [D9] `RodStaticRenderer` (order FISHING_EQUIPMENT − 2) + `SpineSetupPoseReader` (platform, no runtime: header
  bounds, `line-tip` setup position through plain bones, the one drawn region; the bundle carries it as `staticPose`).
  A 90° region (stored counter-clockwise; the page probe shows the thin tip at the page's left) is drawn through a
  canvas rotation over the header bounds.
- [X] T020 `FishingRenderFrameBuilder` calls `prepareRod` before the line frame and passes the anchor tip as the line's
  rod top. `buildRodLine` starts the line at the tip. Without an animated skin the model is bit for bit today's
  (check). D3: today's early return without a float is unchanged.
- [X] T021 `src/bootstrap/production/rod_animation_composition.js` (`composeRodAnimation`: queue with the window
  timers, loader, transport, provider, GL surface from the document, controller, dispose). `GameCompositionRoot`
  composes it, checks its methods, passes it to the pipeline and keeps it in `runtime.rendering.rodAnimation`.
  `GameApplication.dispose()` disposes it. The test render composition gets a rectangle stub.
- [X] T022 Reduced motion: `windowTarget.matchMedia("(prefers-reduced-motion: reduce)").matches` read per frame in the
  composition. A platform class was not needed, since the query object is live.

**Checkpoint** (2026-10-17): `spine-rod` covers the setup pose, resolver, controller modes (unavailable runtime, context
loss, DEV static, stale loads, spring-back), the three renderers and the bit-for-bit rectangle model. Architecture 4/4
(722 modules; production 558 / 851, it was 542 / 835), Quick 27/27, Full 53/53. Game-cycle baseline unchanged
(SHA-256 7b9baea3…). Not checked automatically: allocation per frame (objects are reused by construction, not
measured), WebGL drawing itself and the look. Owner browser check in dev.html, 2026-10-17, performed by the owner:
"everything renders well". The Pages check stays with T028.

## Phase 4: DEV tools

Owner request, 2026-10-17. A DevTools section "🎣 SPINE ВУДКА" (`src/dev/tools/spine_rod_dev_section.js`) over a DEV
port of the controller, injected like the item grant. Production composes the controller but never calls the port.

- [X] T023 (owner 1) Spine on/off switch: `RodAnimationController.setSpineEnabled(false)` shows the static picture, so
  the fallback can be checked live. Replaces the planned `?spine=off` flag (old T024); the constructor's
  `forceStatic` goes away. A status row shows the mode and the last unavailability reason.
- [X] T024 (owner 2) Every clip of the loaded skeleton with its duration and an on/off switch. A disabled clip is not
  played (its track stays empty, so the setup pose shows there) and is not reported as missing.
- [X] T025 (owner 3) Scale and the other `CONFIG.ui.rod.spine` values (heightRatio, sideRangeRatio, mixes, smoothing,
  wind clips) edited live through the runtime override store, so "Export overrides" keeps them.
- [X] T026 (owner 4) Bone editor: a bone picker (default `rod`), setup x / y / rotation / scaleX / scaleY editable live
  (`SpineScene.setBoneSetup` changes the bone data, re-measures the bounds); world position on the game canvas for
  the bone and for `line-tip`, refreshed on demand. Edits also update the static picture's line point
  (`SpineSetupPoseReader` injected into the controller).
- [X] T027 (owner 5) "Export rod.json": downloads the whole skeleton JSON of the file that changed, the loaded export
  with the bone edits written into its `bones` entries (defaults omitted as Spine writes them), under its own file
  name, for Import Data in the Spine editor. One section and one export per Spine file: a later background or loader
  scene gets its own.
- [ ] T028 Still open from the plan, not in the owner's list: texture filter switch Linear | mipmaps (D7), lose/restore
  context buttons, anchor overlay. Added only if the owner asks.

**Checkpoint** (2026-10-17): `SpineRodDevSection` (src/dev/tools) over the controller's DEV port
(`setSpineEnabled`, `getClips`/`setClipEnabled`, `getBones`/`setBoneSetup`/`getBoneEdits`, `exportSkeleton`);
`SpineScene.getClips/getBones/setBoneSetup`; `DevToolsUI.createSelectRow`; `forceStatic` removed. Canvas coordinates
are those of the last drawn frame and refresh with ↻. The clip list and bones appear once the scene is loaded (after
the cast). Owner's dev.html check 2026-10-17, performed by the owner: accepted ("Чудово").

## Phase 4b: critical clips and bend source (owner, 2026-10-17)

- [X] T035 Owner re-export: `rod_fight--left-critical` / `--right-critical` (0.15 s loops, near-full bend with a ±0.1°
  per bone tremble), `bone30` removed (`line-tip` on `bone29`), skin `default` (the config keeps `skin: "default"`
  at the owner's request). New check values: line-tip (1.16, 466.10) at setup, (−93.68, 388.16) full left,
  (1.23, 325.83) full front.
- [X] T036 Critical = the HUD's second bar (tackle STRESS): `TackleStressBarVisibility` shared by
  `FightHudFrameBuilder` and `FishingRenderFrameBuilder`; config `criticalClips { left, right }`, `criticalMixSec 0.15`.
- [X] T037 Owner report: entering critical made the rod jump to full bend and twist. The critical clip now plays on
  track 3 as an additive tremble, its change from its own first frame (`SpineScene.setLoop(..., additive)` rewrites
  single-value timeline keys and Bezier samples once; 4.3 `TrackEntry.additive`). No jump at its start.
- [X] T038 Owner: a full tension bar is the full bend. `bendSource: "tension"` (default, `tension / 100` as the HUD
  bar) or `"rodStress"` (the rod's own load, the earlier rule); validated by the config schema.
- [X] T039 Owner tuning kept: `heightRatio 0.5`. `docs/rod_animation_reference.md` (owner's/other tool's reference)
  updated for the bend source.

Checks after 4b, over develop with ad1796f9/58f3ec84: Architecture 4/4 (729 modules; production 564 / 865),
Quick 29/29, Full 55/55, game-cycle baseline unchanged (SHA-256 7b9baea3…). The owner checked the
fight bend and the critical tremble in dev.html, 2026-10-17.

## Phase 5: Checks and acceptance

- [X] T029 `spine-rod` covers the DEV port: spine off/on, clip disable, bone edit (scene tip, static tip, bounds),
  export JSON (edits written, everything else byte-equal after parse, file name).
- [ ] T030 Every runtime path (vendor file, bundle json/atlas/page) is in `git ls-files`; `release:pages` dry run lists
  them.
- [ ] T031 Architecture + Quick + Full green; game-cycle digest unchanged; `docs/architecture.md` and
  `project-structure.txt` updated.
- [ ] T032 Owner browser check in dev.html (DEV section) and on Pages; recorded in spec.md with the date.
- [ ] T033 CHANGELOG line and version bump only on the owner's command; commit + push develop and gh-pages together
  after the owner agrees.

## Phase 6 (after this spec): preloader on the same Spine

- [ ] T034 New spec for the 083 remainder: store and facade (reusing T010), the `index.html` loading layer +
  `StartupLoaderView`, a loader Spine scene on its own `SpineGlSurface` through `SpineBundleLoader` after the minimum
  barrier, poster fallback, disposal on fade-out. The owner provides the loader export under the same export rules.
