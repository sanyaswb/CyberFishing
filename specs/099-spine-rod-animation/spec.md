# Spine rod animation and Spine in the engine

Owner request, 2026-10-17: animate the rod with Spine first, the preloader after it; the export (JSON + atlas) is
ready. Integrate Spine into the engine as fully as the project needs and list what the browser client and the Spine
export must provide. This spec changes the order of [spec 083](../083-preloader-foundation/spec.md): the Spine runtime,
adapter and bundle loading are delivered by the rod (this spec), the loading screen reuses them afterwards. Contracts
of [spec 047](../047-smart-asset-preloader/contracts/runtime-assets.md) ("Spine Surface Contract") still apply.
Tasks: [tasks.md](tasks.md). Status: **all decisions D1–D9 answered 2026-10-17; Phase 1 committed (7288d624); Phase 2 (engine/platform Spine
capability, `spine-rod` check) done, not committed; Phase 3 (rod in the game) next.**

## Starting point (verified 2026-10-17)

The export, re-exported by the owner on 2026-10-17 and moved (T003) to `assets/animations/rods/bamboo-rod-v1/`. The
files keep their exported names because the atlas names its page `rod.webp`; the folder carries the skin id. The
master page `bamboo_rod--1.png` (85 × 2735) is in `asset-sources/animations/rods/bamboo-rod-v1/`.

| File | Content |
| --- | --- |
| `rod.json` (55 KB) | Spine **4.3.26** skeleton, 60 fps. Bones `root → rod → bone1…bone30` (chain) + **`line-tip`** (child of `bone30`, x 104.92, y −6.00, not in the mesh weights; setup world position (1.21, 466.06), just under the mesh top edge at y 466.82). One slot `bamboo_rod--1`, one weighted mesh (64 vertices, 62 triangles, 85 × 2735 region, weights on `bone1…bone30`). **Skin `rod-1`** (no `default` skin, so the scene must set the skin by name: `animation.skin`). No IK, constraints, physics, events or audio. `skeleton.images: "./rod/"` is an editor path and is not used. |
| `rod.atlas` | One page `rod.webp`, 2739 × 89, `filter: Linear,Linear`, no `pma` line (straight alpha), region `bamboo_rod--1` rotated 90°. |
| `rod.webp` (34 KB) | The atlas page. |

Animations. Every clip starts and ends at the setup pose.

| Clip | Duration | Timelines | Meaning (as read from the keys) |
| --- | --- | --- | --- |
| `rod_idle-2` | 5.833 s | rotate, 29 bones | neutral idle sway, loops |
| `rod_idle-1--left` / `--right` | 4.167 / 5.0 s | rotate, 29 bones | idle sway leaning left / right, loops |
| `rod_fighting-1--left` / `--right` | 3.333 s | rotate, 29 bones | **bend ramp**: 0 → ±4.45° per bone (about 130° at the tip), not a loop |
| `rod_fighting-1--front` | 3.333 s | scale x, 30 bones | **foreshortening ramp** toward the viewer: 1 → 0.96 per bone |

The fight clips are bend curves over time, so they are **sampled by load** (time = bend × duration) rather than
played. The fight frame already has the load: `TackleStressSystem.getFightFrame().rodStressRatio`.

The game today:
- `RodLineRenderer` draws the rod as a black 3 × 200 px rectangle and the line from its top
  (`FishingEquipmentRenderModelBuilder.buildRodLine`: `rodTopY = rodBaseY - 200`). `FishingRenderFrameBuilder`
  repeats `rodBaseY - 200` when it fits the float into view.
- The rod is drawn only while a float entity exists, i.e. from the cast on (`FishingRenderFrameBuilder.buildInto`
  returns early without a float).
- The rod's X comes from `GameApplication.getRodScreenX()` (`RodVisualOffsetSystem` aim offset, playable clamp).
- One loop: `GameLoop` calls `onUpdate(dt)` and then `onDraw()` per `requestAnimationFrame`. The main canvas is a
  2D context wrapped by `Canvas2DSurface`.
- The `SpineRuntimeProvider` and the stub `spine_runtime_module.js` exist from spec 083. `AssetLoadQueue` exists but
  nothing in the game uses it yet.
- npm: `@esotericsoftware/spine-webgl` and `spine-core` **4.3.13** (latest; `v4.2-latest` is 4.2.120). The editor
  4.3.26 export and the 4.3.13 runtime share the 4.3 line that `SpineRuntimeProvider` checks.
- The architecture guard analyses only `src/**/*.js`. It rejects bare specifiers, more than one class per module,
  host globals outside platform, and imports it cannot resolve. A third-party bundle cannot live in `src/` under the
  current rules (D2).
- `npm run release:pages` copies the module graph (literal dynamic imports included) and every tracked `assets/`
  file, so a tracked bundle under `assets/` and the runtime module reach Pages without script changes.
- Wind exists: `EnvironmentSystem` keeps `wind.direction` ∈ {−1, 0, +1} (changed `changesPerDay` times from the
  location's `environment.wind`, rain multiplier `rainMult`). `GameApplication` exposes it read-only through
  `getEnvSnapshot()`. Reading it consumes no RNG, so the game-cycle report cannot change.

## Goal

1. The equipped rod is a Spine skeleton: it sways in the wind while waiting and bends with the real rod load during
   the fight, leaning toward the fish (left / front / right).
2. The line starts at the rod's animated tip, so the line and the rod never separate.
3. Spine is an engine capability, not rod-only code. One runtime, one bundle loader through `AssetLoadQueue`, one
   scene adapter and one GL surface. The preloader, fish, the House or UI can reuse them later.
4. Spine is optional (D9). If the runtime, WebGL or the context is missing, the animated skin draws as a static rod
   picture (its atlas region in the setup pose, drawn by Canvas 2D). Only if that picture is missing too, or for a
   rod without an animated skin, does the game draw today's black rectangle. The gameplay, the game-cycle report and
   the save bytes are unchanged.

Out of scope: the loading screen (next spec, from 083), cast and bite clips (none exist yet), rod breakage effects,
fish skeletons, Spine in DOM/UI.

## Architecture

```text
engine/animation/                       no browser, no Spine, no CyberFishing
  skeletal_scene_contract.js           the scene port every adapter satisfies (method list for contracts.requireMethods)
  scalar_smoother.js                   frame-rate independent approach (time constant), no allocation

platform/browser/animation/
  vendor or assets path (D2)           pinned spine-webgl 4.3.13 ESM bundle + LICENSE + manifest (hash)
  spine_runtime_module.js              real factory: { version: "4.3.13", createScene(bundle, surface) }
  spine_runtime_provider.js            unchanged (083): lazy import, version line, reasons
  spine_gl_surface.js                  one offscreen <canvas> + WebGL context: size, DPR, context lost/restored, dispose
  spine_bundle_loader.js               skeleton JSON + atlas text + atlas pages through AssetLoadQueue (no Spine AssetManager)
  spine_scene.js                       the only module that touches the Spine API (4.3 poses): atlas → GLTextures →
                                       AtlasAttachmentLoader → SkeletonJson → Skeleton + AnimationState; tracks,
                                       sampled poses, update(dt), render(transform), point/bounds queries, dispose
  browser_asset_transport.js           fetch text/json + decode image (createImageBitmap / Image.decode), cancellable

game/config/raw/items/item_database.js rod skin: animation { bundleId, skeleton, atlas, skin, linePoint }
game/config/raw (ui.rod.spine)          screen size, pivot, clip names, wind clips, side range, mix and smoothing times

game/presentation/fishing/
  rod_animation_state_resolver.js      pure: (state, stress, fish side, wind direction, reduced motion) → pose snapshot
  rod_animation_controller.js          per session: loads the equipped skin's scene, applies snapshots,
                                       update(dtSec), exposes RodAnchorFrame { baseX, baseY, tipX, tipY } and the mode
                                       spine | static | rectangle
  rod_spine_renderer.js                draws the scene into the GL surface and composites it into the 2D surface
  rod_static_renderer.js               D9 fallback: the atlas region in the setup pose via Canvas 2D (no Spine runtime)
  rod_line_renderer.js                 rectangle only in mode "rectangle"; line from the anchor's tip
  fishing_equipment_render_model_builder.js   line start from the anchor (rectangle mode = today's numbers bit for bit)

bootstrap/production/rod_animation_composition.js   provider + surface + loader + controller + renderer
dev/fishing/rod_animation_dev_section.js            DevTools: status, clip/bend/side overrides, anchor/bounds overlay
```

Layers keep their rules. The engine knows only a scene port and generic smoothing. The Spine API lives in one
platform module (`spine_scene.js`). Presentation decides what the rod shows and never imports Spine. Bootstrap wires
the concrete browser pieces. DEV only adds overrides and an overlay.

### Scene port (engine contract, adapter implementation)

```text
setLoop(track, clipName, mixSec)          looping clip on a track (idle); same clip → no restart
setSampled(track, clipName, ratio, alpha) clip held at ratio × duration, timeScale 0, blended with alpha (fight bend)
clearTrack(track, mixSec)
update(dtSec)                             AnimationState.update + apply + updateWorldTransform(Physics.update)
render(transform)                         transform: { x, y, scale, flipX, pixelRatio } in surface pixels
getPoint(name, out)                       point attachment, else bone of that name, else last chain bone tip, in surface
                                          pixels; false when the skeleton has no bones
getBounds(out)                            precomputed max bounds over all clips (canvas size never thrashes)
hasClip(name), clipDuration(name)
dispose()                                 textures, buffers, listeners
```

The adapter samples each clip's bounds once at load (setup pose plus clip extremes) and keeps the union. The GL canvas
is sized to that union times the rod scale, padded, and resized only on viewport or DPR change.

### Rendering path (D1)

The rod renders with **spine-webgl into one offscreen WebGL canvas**. In the same frame, at the rod's render order,
`Canvas2DSurface.drawImage(glCanvas, …)` composites that canvas into the 2D game canvas. Why:
- the WebGL renderer supports every Spine feature (weighted meshes, PMA, clipping, tint black, blend modes) without
  seams;
- the 2D game keeps one canvas and its draw order (fight areas → rod → line → float → HUD);
- one draw call and one GPU copy per frame.

`preserveDrawingBuffer: false` is fine because the copy happens in the same task as the GL draw. The alternative,
spine-canvas triangle rendering into the 2D context, shows anti-aliasing seams on a thin mesh and lacks tint black
and clipping. It stays a rejected option unless D1 says otherwise.

### Pose mapping (D3, D4)

`RodAnimationStateResolver` is pure and allocation free (it writes into a reused snapshot):

| Game state | Track 0 (loop) | Track 1 (sampled) | Track 2 (sampled) |
| --- | --- | --- | --- |
| no float (before the cast) | rod not drawn, as today (D3) | — | — |
| casting / waiting / biting | idle by wind (D4): direction −1 → `rod_idle-1--left`, +1 → `rod_idle-1--right`, 0 (calm) → `rod_idle-2`; a wind change mixes over `windMixSec` (default 1.0 s) | — | — |
| playing | idle faded out (mix `idleToFightSec`) | `rod_fighting-1--front`, ratio = bend, alpha = 1 − abs(side) | side clip (`--left` / `--right` by fish side), ratio = bend, alpha = abs(side) |
| landing / victory / game over / line lost | idle by wind, fight tracks cleared (mix `fightToIdleSec`) | — | — |

- Wind (D4, owner 2026-10-17): the `--left` / `--right` idles are the rod swaying in a wind blowing that way. The
  mapping of direction to clip is config (`ui.rod.spine.windClips` keyed −1 / 0 / 1), so the owner can swap the
  sides after the browser check if the sign reads the other way. Optional `windRainTimeScale` (default off): the idle
  plays faster by `rainMult` in rain.

- `bend = smoother(clamp01(rodStressRatio))`, time constant `bendSmoothingSec` (default 0.12 s). Rod stress is
  already 0..1 against the rod's effective max load, so a weak rod bends more for the same fish.
- `side = clamp((fishScreenX − rodTipX) / (canvasWidth × sideRangeRatio), −1, 1)`. Fish screen X is the float/hook
  position the line already targets. The front clip keys only scale and the side clips only rotation, and the
  bones start from the setup pose every frame. So front alpha 1 − abs(side) plus side alpha abs(side) is an exact
  weighted blend of the two poses, verified in Phase 2: full side weight gives the pure side bend. Front alpha 1
  under a side alpha 1 would keep the front foreshortening.
- Reduced motion (`prefers-reduced-motion: reduce`): idle clips hold at time 0. The bend still follows the load,
  because it is gameplay feedback.
- Clip names come from config (`ui.rod.spine.clips`), so an export with other names or more variants (`rod_idle-3`,
  `rod_fighting-2`) needs no code. A configured clip missing from the export is reported once (DEV log) and the
  controller uses the setup pose for that track.

### Rod anchor and the line

`RodAnchorFrame { baseX, baseY, tipX, tipY }` is the single source of the rod geometry for the frame:
- Spine ready: base = skeleton root at the configured pivot; tip = `getPoint(linePoint)`. That is the point
  attachment or bone `line-tip` (D5), or else the end of the last bone in the chain (`bone30` + its length).
- Static picture (D9): the same placement and scale as the skeleton, so the picture is the rod's setup pose. The
  size comes from the JSON header bounds (`skeleton.x/y/width/height`), the region from the atlas text; neither needs
  the Spine runtime. Tip = the `line-tip` position in the setup pose (read from the JSON bone/point data), else the top
  centre of the bounds. Only the atlas text and page are needed, so the static picture appears even when the runtime
  is unavailable.
- Rectangle (no animated skin, or the page failed): `baseX = rodBaseX`, `baseY = rodBaseY`, `tipX = rodBaseX`,
  `tipY = rodBaseY − 200`, exactly today's values. `FishingEquipmentRenderModelBuilder` and the float fit in
  `FishingRenderFrameBuilder` read the tip from the anchor instead of `rodBaseY − 200`. For a rod without an
  animated skin, the render model is bit-for-bit what it is now (check).

Order in a frame: `onUpdate(dt)` advances the controller (resolver → scene tracks → `update(dt)` → anchor). Then
`onDraw()` builds the render model from that anchor and renders. The line and the rod therefore come from the same
skeleton pose. The controller runs from the session update path next to `RodVisualOffsetSystem` (viewport facade),
not from a second `requestAnimationFrame`.

### Loading and lifetime

- The skin's `animation` names a bundle: skeleton JSON, atlas text, and pages parsed from the atlas and resolved
  relative to the atlas URL. `SpineBundleLoader` requests each one as its own `AssetLoadQueue` job (`interactive`;
  `prefetch` for skins in the backpack later). Spine's `AssetManager` is never used.
- Loading starts when a rod with an animated skin is equipped (session start, equip, skin change). The atlas text and
  page load first (they serve both the static picture and the scene), the skeleton JSON and the runtime after. The
  order of what is drawn is rectangle → static picture → Spine scene, never backwards except on context loss
  (scene → static). A skin change disposes the old scene after the new one is ready, so nothing flickers.
- Validation before the scene is built: `skeleton.spine` major.minor equals the runtime line; the atlas parses; every
  page loaded; `MAX_TEXTURE_SIZE` ≥ page size; the configured clips and `linePoint` exist (missing clips → setup
  pose, missing point → bone tip). Any failure → static picture plus one DEV log with the reason.
- WebGL context lost → static picture immediately. Restored → textures are re-uploaded from the retained decoded pages and
  the scene resumes with its track state. Session dispose → scene, textures and surface disposed.
- Hot loop: no allocation per frame in the resolver, controller, renderer or transform objects (reused); the skeleton
  updates only while the rod is visible.

### Rod placement on screen

Config `ui.rod.spine`, editable in DevTools:
- `heightRatio`: rod height as a share of the canvas height; default chosen so the tip sits where today's
  200 px top is on the reference 1280 × 800 view.
- `pivot` (root at the base point), `flipX` when the rod is on the right half (D6).
- The X offset comes from `getRodScreenX()` as now. Aim offset, playable clamp and the split inventory keep working
  unchanged.

## Requirements for the browser client

- **WebGL 1 or 2** (spine-webgl supports both). Without it the rod is the static picture; no error is shown
  to the player.
- **Texture limits**: page ≤ `MAX_TEXTURE_SIZE` (the current 2739 px page needs ≥ 4096, which every WebGL device
  reports). Above the limit → static picture.
- **Memory**: the current page is about 1 MB on the GPU (2739 × 89 × 4). The decoded page stays retained for context
  restore. The bundle is about 90 KB over the network. The runtime module loads lazily, only when an animated skin is
  equipped, never on the minimum start path.
- **DPR**: the GL canvas uses the game canvas pixel scale, capped at 2.
- **Hidden tab**: the game loop stops, so Spine stops too; nothing extra runs.
- **Reduced motion** as above.
- **Context loss** (mobile Safari/Chrome under memory pressure): static picture and restore as above.
- **Pages / offline**: runtime module and bundle are tracked files with relative paths, no CDN, no globals. Every
  bundle path must be in `git ls-files` before a release (rule from 78d5d7af).
- **Licence**: the Spine Runtimes licence requires a Spine Editor licence for the integrating party (the owner) and
  ships its LICENSE text with the runtime file.

## Requirements for the Spine export (owner)

1. **Spine 4.3.x**, JSON skeleton + `.atlas` + pages. The runtime is pinned to 4.3.13. If an export from a newer
   4.3 editor fails to parse, the pinned runtime is updated (a manifest change), not the export downgraded.
2. **Root at the rod butt (hand point)**, rod pointing up in the setup pose, as now.
3. **A line point named `line-tip`** at the tip ring (D5): either a bone `line-tip` (child of `bone30`, length 0)
   or a point attachment `line-tip` in a slot on `bone30`. It must not be added to the mesh weights, and it needs no
   keys. The mesh's tip vertices are weighted 100 % to `bone30`, so a point on `bone30` follows the drawn tip exactly.
   Without it, the end of the last bone is used.
4. **Clip naming**: `rod_idle-<n>[--left|--right]` (loops, start = end), `rod_fighting-<n>--left|--front|--right`
   (bend ramps from the setup pose to full bend at the last key, monotonic, since the game samples them by load).
   Optional later: `rod_cast-<n>`, `rod_bite-<n>`. They are mapped in config when they exist.
5. **Texture**: the rod is drawn about 5× smaller than its 2735 px region. The first build keeps the current
   `Linear,Linear` page so the owner can see the difference (D7). The DEV filter switch (T023) then compares it with
   mipmaps without a re-export. Note: WebGL 1 cannot mipmap a non-power-of-two page (2739 × 89), so the switch shows
   mipmaps on WebGL 2 only. A re-export with `MipMapLinearLinear` or pack scale 0.5 is decided after the comparison.
   Keep a page ≤ 2048 px where possible. State PMA in the atlas (`pma: true` when premultiplied); the adapter reads it.
6. **Folder = skin id** (`assets/animations/rods/<skin-id>/`). The files keep their exported names: the atlas
   references its page by name, so renaming is done only in the export dialog, never afterwards.
7. **Skin name**: any name, written into the rod skin's `animation.skin` (`rod-1` today). A future default skin needs
   no config.
8. **No pages edited outside the export**: atlas pages are converted only together with their atlas (spec 047
   `atlas-bundle` policy). The image converter never rewrites a page alone.

Location (D8): runtime files in `assets/animations/rods/bamboo-rod-v1/`, the source project and master PNG in
`asset-sources/animations/rods/` (never released). `src/` holds code only, so `src/Animations/` goes away after the
move.

## Owner decisions needed

| # | Question | Recommendation |
| --- | --- | --- |
| D1 | Rendering path | **Owner, 2026-10-17: agreed.** Offscreen spine-webgl composited into the 2D canvas (above) |
| D2 | Where the third-party runtime lives and how the guard treats it | **Owner, 2026-10-17: agreed.** `vendor/spine-webgl/4.3.13/spine-webgl.js` + `LICENSE` + `vendor/manifest.json` (npm integrity, file SHA-256). The guard gains a strict `vendor` rule: not analysed for project rules, importable only by `src/platform/browser/animation/spine_runtime_module.js`, hash must match the manifest, no imports of its own. This is stricter than today, not an ignore list. Produced by `utils/vendor-spine.js` from the pinned npm package (its prebuilt ESM bundle, or esbuild if none), never by hand. |
| D3 | Rod before the cast | **Owner, 2026-10-17: not shown.** Today's visibility stays (the rod appears from the cast on). |
| D4 | What idle `--left` / `--right` mean | **Owner, 2026-10-17: the rod swaying in the wind.** Mapped from `EnvironmentSystem` `wind.direction` (−1 / 0 / +1), sides swappable in config. |
| D5 | Line point | **Owner, 2026-10-17:** adds `line-tip` (bone or point attachment) in the re-export; bone-tip fallback stays |
| D6 | Mirroring | **Owner, 2026-10-17: agreed.** No flip: the side clips already lean; flip only if a future clip needs it |
| D7 | Texture quality | **Owner, 2026-10-17:** first with the current `Linear` page to see the difference; DEV filter switch to compare with mipmaps; re-export decided afterwards |
| D8 | Asset location | **Owner, 2026-10-17:** `assets/animations/rods/<skin-id>/` + masters in `asset-sources/`; the move happens after the owner re-exports the JSON with the skin and `line-tip` |
| D9 | Fallback art | **Owner, 2026-10-17: a static rod picture.** The skin's atlas region in the setup pose (Canvas 2D, no runtime); the black rectangle only for rods without an animated skin or when the page is missing. |

## Verification

- New check `spine-rod` (Quick):
  - real export through the pinned runtime's spine-core classes in Node (no WebGL): version line, clips, the 30-bone
    chain, `linePoint`/tip position at setup and at full bend, bounds union;
  - atlas parsing, PMA flag and page paths tracked in git;
  - resolver table (every state, wind −1/0/+1 and its mix, side blend weights, reduced motion, smoothing at
    30/60/144 fps; no rod before the cast);
  - controller with a fake runtime: every unavailable reason → static picture, context lost/restored, skin swap,
    dispose, draw order rectangle → static → spine;
  - static picture geometry from the JSON header and atlas (size, tip) equal to the skeleton's setup pose;
  - rods without an animated skin: render model bit-for-bit equal to today's;
  - no per-frame allocation (counted by a fake surface).
- Architecture: the vendor rule (D2) with fixtures for a wrong importer, a hash mismatch and a vendor import.
- `asset-preloader` stays green (provider over the real module: `available`, line 4.3).
- Architecture + Quick + Full green; game-cycle SHA-256 unchanged (`7b9baea3…`); production module count recorded.
- The owner checks the browser in dev.html and on Pages. Claude does no UI driving or screenshots (owner rule).
  What the owner checks: wind sway for each direction (DEV wind override), bend under load with a weak and a strong
  rod, lean left/right/front, the line fixed to the tip, the static picture with `?spine=off` (DEV flag), context loss
  from DevTools ("Lose context" button in the DEV section), and Linear versus mipmaps (D7).

## Next: the preloader on the same Spine

After this spec, the preloader steps of 083 need only:
1. the store and facade (083 step 1), reusing `browser_asset_transport.js` from here;
2. the loading layer in `index.html` + `StartupLoaderView`;
3. the loader Spine scene on its own visible GL canvas (a second `SpineGlSurface` instance owned by the loader,
   disposed with it), loaded through the same `SpineBundleLoader` after the minimum barrier.

The runtime, adapter, validation, context handling and export rules are already in place.
