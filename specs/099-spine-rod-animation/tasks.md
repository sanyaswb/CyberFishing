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
- [X] T007 [D2] `utils/architecture-check.js` `vendor` rule: vendor files are read, not held to project rules; each
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

- [ ] T009 `src/engine/animation/skeletal_scene_contract.js`: the scene port method list (spec "Scene port") for
  `contracts.requireMethods`; `src/engine/animation/scalar_smoother.js`: frame-rate independent approach with a time
  constant, no allocation.
- [ ] T010 `src/platform/browser/animation/browser_asset_transport.js`: fetch text/JSON, decode images
  (`createImageBitmap`, `Image.decode` fallback), cancellation, used as the `AssetLoadQueue` loader. The same transport
  becomes 083's step-1 browser transport.
- [ ] T011 `spine_bundle_loader.js`: skeleton JSON + atlas text → page names parsed from the atlas header lines →
  page URLs relative to the atlas → one queue job each (`interactive`). Result `{ skeletonJson, atlasText, pages:
  Map<name, ImageSource> }` or a failure reason (`fetch-failed`, `atlas-invalid`, `page-missing`). No Spine
  `AssetManager`.
- [ ] T012 `spine_gl_surface.js`: offscreen canvas, WebGL context (`alpha: true`, `premultipliedAlpha` per bundle,
  `preserveDrawingBuffer: false`), `resize(width, height, pixelRatio)` capped at DPR 2, `MAX_TEXTURE_SIZE`, context
  lost/restored callbacks, `dispose()`.
- [ ] T013 `spine_scene.js` (the only module using the Spine API, 4.3 poses): `TextureAtlas` with `GLTexture` per page
  (PMA from the atlas page), `AtlasAttachmentLoader`, `SkeletonJson` (scale), `Skeleton`, `AnimationStateData` mixes,
  `AnimationState`, `SceneRenderer`/`SkeletonRenderer`; `setSkinByName(bundle.skin)` + `setSlotsToSetupPose()` when
  the bundle names a skin (the bamboo export has no `default` skin, so without it nothing draws). Implements the port: `setLoop`, `setSampled` (timeScale 0,
  trackTime = ratio × duration, alpha), `clearTrack`, `update` (`updateWorldTransform(Physics.update)`), `render`
  (orthographic camera on the surface size), `getPoint` (point attachment → surface px, else last chain bone tip),
  `getBounds` (union over setup and each clip's sampled extremes, computed once), `hasClip`, `clipDuration`,
  `restoreContext` (re-upload retained pages), `dispose`.
- [ ] T014 Replace the stub `spine_runtime_module.js`: import the vendor file, `createSpineRuntime()` returns
  `{ version: "4.3.13", createScene(bundle, surface) }`; `createScene` validates (version line, pages, texture size,
  clips) and returns the scene or a reason. Update the 083 provider checks (the stub case moves to a fake module).

**Checkpoint**: `asset-preloader` + the new `spine-rod` check (bundle/scene parts with the real export in Node) green.

## Phase 3: Rod in the game

**Goal**: the equipped rod draws and animates through Spine; the fallback stays bit-for-bit.

- [ ] T015 Config: rod skin `animation { bundleId, skeleton: "assets/animations/rods/bamboo-rod-v1/rod.json", atlas:
  ".../rod.atlas", skin: "rod-1", linePoint: "line-tip" }` for `bamboo-rod-v1` in
  `src/game/config/raw/items/item_database.js`; `ui.rod.spine` (heightRatio, pivot, clips, `windClips` keyed
  −1/0/1, `windMixSec`, optional `windRainTimeScale`, `sideRangeRatio`, `idleToFightSec`, `fightToIdleSec`,
  `bendSmoothingSec`) with validation in the config schema validator (numbers, clip names, project-relative paths).
- [ ] T016 `src/game/presentation/fishing/rod_animation_state_resolver.js`: pure mapping table from the spec (states,
  idle by wind direction [D4] with its mix, fish side blend, smoothed bend from `rodStressRatio`, reduced motion).
  It writes into a reused snapshot. The wind comes from the session's read-only `getEnvSnapshot().wind` (no RNG, no
  write).
- [ ] T017 `rod_animation_controller.js`: per session. Watches the equipped rod skin; requests atlas + page first,
  then the runtime + skeleton; mode `rectangle → static → spine` (never backwards except context loss → static);
  keeps the previous scene until the new one is ready; applies snapshots to tracks; `update(dtSec)`; computes
  `RodAnchorFrame` for each mode; handles context lost/restored and `dispose`. The session update path calls it next
  to `RodVisualOffsetSystem` in `game_viewport_facade.js` (no second `requestAnimationFrame`).
- [ ] T018 `rod_spine_renderer.js`: at `GameRenderOrder.FISHING_EQUIPMENT`, render the scene into the GL surface and
  `drawImage` it into the 2D surface at the anchor; it draws only in mode `spine`. `RodLineRenderer` draws the
  rectangle only in mode `rectangle` and always the line from `tipX/tipY`.
- [ ] T019 [D9] `rod_static_renderer.js` + a small atlas-text reader (region bounds, rotate flag) and JSON-header
  reader (`skeleton.x/y/width/height`, setup position of `line-tip`): draw the region in the setup pose with Canvas 2D
  at the skeleton's placement and scale, in mode `static`. No Spine runtime import.
- [ ] T020 `FishingEquipmentRenderModelBuilder.buildRodLine` and the float fit in `FishingRenderFrameBuilder` take the
  tip from the anchor instead of `rodBaseY - 200`. For rods without an animated skin, the render model equals today's
  (check). D3 (owner): no rod before the cast, so today's early return without a float stays unchanged.
- [ ] T021 `src/bootstrap/production/rod_animation_composition.js`: provider, surface, loader over `AssetLoadQueue`
  (scheduler from the platform), controller, renderers; registered in `GameRenderComposition` and the session;
  `contracts.requireMethods` on the scene port. Production never imports DEV.
- [ ] T022 `prefers-reduced-motion` source in platform (media query listener), injected into the resolver.

**Checkpoint**: `spine-rod` complete; game-cycle SHA-256 unchanged; production module/import counts recorded.

## Phase 4: DEV tools

- [ ] T023 `src/dev/fishing/rod_animation_dev_section.js` in DevTools: runtime/scene status and reason, current
  mode/clips/weights/bend, overrides (clip, bend 0..1, side −1..1, wind −1/0/+1 for the rod only, without touching
  `EnvironmentSystem`), live `ui.rod.spine` edits, anchor dot + bounds box
  overlay, "Lose context" / "Restore context" (`WEBGL_lose_context`), reload bundle, and a texture filter switch
  "atlas (Linear) | mipmaps" (D7): the scene re-sets the page filters and generates mipmaps; on WebGL 1 with a
  non-power-of-two page the switch is disabled with the reason shown.
- [ ] T024 DEV flag `?spine=off` forces mode `static` (DevFlagsProvider), to see the static picture.

## Phase 5: Checks and acceptance

- [ ] T025 `utils/spine-rod-check.js` in the Quick suite (`utils/testing/suites/check_manifest.js`): every case listed
  in spec "Verification", including the zero-allocation count, the static picture geometry and the bit-for-bit
  model for rods without an animated skin.
- [ ] T026 Every runtime path (vendor file, bundle json/atlas/page) is in `git ls-files`; `release:pages` dry run lists
  them.
- [ ] T027 Architecture + Quick + Full green; game-cycle digest unchanged; update `docs/architecture.md`
  (`engine/animation`, platform Spine modules, vendor rule) and `project-structure.txt` (`npm run struct`).
- [ ] T028 Owner browser check in dev.html and on Pages (list in spec "Verification"); performedBy = owner, recorded in
  spec.md with the date.
- [ ] T029 CHANGELOG line and version bump only on the owner's command; commit + push develop and gh-pages together
  after the owner agrees.

## Phase 6 (after this spec): preloader on the same Spine

- [ ] T030 New spec for the 083 remainder: store and facade (reusing T010), the `index.html` loading layer +
  `StartupLoaderView`, a loader Spine scene on its own `SpineGlSurface` through `SpineBundleLoader` after the minimum
  barrier, poster fallback, disposal on fade-out. The owner provides the loader export under the same export rules.
