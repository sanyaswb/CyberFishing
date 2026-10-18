# WebGL scene layer (hybrid renderer, staged)

Owner request, 2026-10-18: move the scene (background and parallax, water, float, line, the Spine rod and fish) to
WebGL as a separate layer under today's 2D canvas, step by step, without rewriting everything at once. HUD and
windows stay 2D/DOM. The owner asks for a ready library rather than hand-written shaders. Status: **specification;
decisions taken 2026-10-18 (below); stage 0 next, in a new session.** Rules:
[docs/rendering.md](../../docs/rendering.md) (mandatory).

Owner, 2026-10-18: **option C (PixiJS)**, with the 2D canvas for HUD text and the rest. The art will be **many image
layers, and almost all animation will be made in Spine**. The owner wants the most result for the least effort.
The rules in docs/rendering.md ("Scene layer and roles", "Many layers and Spine-first art") follow from this.

## Why

- Planned features need it: Spine parallax background, Spine fish, animated water, anomaly glow, weather and
  particles. On Canvas 2D every full-screen layer and per-pixel effect costs fill rate, the browser decides the
  filtering (spec 102), and Spine needs a WebGL → 2D copy each frame (spec 099).
- In WebGL we control filtering, mipmaps and texture resolution exactly. Layers become textures or render targets
  composited in one pass, Spine runs natively, and effects come from ready shader filters.
- Performance is not the trigger today: after spec 102 the owner's phone runs 60 FPS with 2–4 ms of game CPU. Each
  stage must keep or improve that, measured on the phone in both orientations.

## Scope and non-goals

In scope:
- a WebGL scene canvas under the 2D canvas;
- moving the background, water, float, line, rod and fish to it in stages;
- parallax layers, the effects listed above, and an adaptive scene resolution.

Not in scope:
- HUD, inventory, House, victory and game-over windows: they stay 2D canvas or DOM, because text and UI are where
  WebGL gives least;
- gameplay, input and save format: the game-cycle baseline stays unchanged;
- WebGPU: WebGL 2 first, WebGL 1 as fallback if the library supports it, WebGPU later as a library option.

## Library decision (D1)

Hand-written shaders are not the plan. The candidates:

| Option | What it gives | Against |
| --- | --- | --- |
| **PixiJS 8** (`pixi.js` 8.22.0) + **`@esotericsoftware/spine-pixi-v8` 4.3.13** + **`pixi-filters` 6.1.5** | Mature 2D WebGL/WebGL 2 renderer: sprite batching, containers, render textures, `cacheAsTexture` for static layers, mipmaps, `Graphics` for curves (the line), text if ever needed. **Official Spine runtime of the same 4.3 line as our export.** Ready filters with no shader writing: `DisplacementFilter` (water ripples), `ColorMatrixFilter` (time of day, tint), glow, bloom, god rays, shockwave, noise, blur. MIT licence | Size to be measured in stage 0 (estimate: a few hundred KB minified for core + Spine + used filters). Its own ticker, events and resize must be turned off so our loop, input and resolution rules stay in charge. A bundle step is needed (see D2) |
| Own renderer on the vendored spine-webgl 4.3.13 | Smallest code, everything ours | Batching, render targets, filters and every effect shader written and maintained by us: the work the owner wants to avoid |
| Phaser 4 | Complete game framework with Spine | Brings its own game loop, scenes, input and asset loader, which conflict with our architecture; much larger; overkill for one layer |
| Three.js | Excellent 3D engine | 3D-oriented; 2D sprites, Spine and 2D filters are second-class; larger |
| twgl / regl / OGL | Thin WebGL helpers | Still hand-written shaders and batching |

**Recommendation: PixiJS 8 with spine-pixi-v8 and pixi-filters,** used as a renderer behind our own ports, not as a
framework:
- `autoStart: false`; our `GameLoop` calls `renderer.render(stage)` once per frame (no second
  `requestAnimationFrame`);
- Pixi's event system off (`eventMode: "none"`): input stays in `InputController`;
- `autoDensity` off and `resolution` set by our resolution owner (logical pixels, docs/rendering.md rules 1–2);
- textures created from images that our `AssetLoadQueue` loaded (`Texture.from(image)`): no Pixi `Assets` loader;
- Pixi types never leave `src/platform/browser/scene/`; presentation builds the same render models as today, and a
  platform scene renderer turns them into Pixi objects.

## Architecture

```text
DOM order (bottom → top):   scene canvas (WebGL, Pixi)  →  2D canvas (transparent)  →  DOM HUD / windows
logic, input, layout:       logical (CSS) pixels, unchanged
render models:              built by today's frame builders (one source of truth)

engine/scene/scene_layer_contract.js       port: beginFrame, render(model), resize(logical, ratio), loseContext,
                                            dispose; FRAME_SECTIONS gets "scene"
platform/browser/scene/
  vendor import module                      the only importer of the Pixi/Spine bundle (vendor rule, spec 099 D2)
  pixi_scene_renderer.js                    Application without ticker/events; layer containers; model → display objects
  scene_texture_cache.js                    images from AssetLoadQueue → Pixi textures (mipmaps), released with the scene
  pixi_spine_scene.js                       spine-pixi-v8 behind the existing scene port (setLoop, setSampled, getPoint, ...)
game/presentation/rendering/scene_layer_router.js
                                            per object kind: "scene" (WebGL) or "canvas" (2D); a DEV switch flips all
bootstrap/production/scene_layer_composition.js
                                            composes the layer, falls back to the 2D path without WebGL
```

- **One frame, two layers.** The coordinator builds one frame, the scene renderer draws the scene objects, and the 2D
  pipeline draws the rest. Each object kind is drawn by exactly one layer, chosen by the router. The 2D canvas
  becomes transparent (`alpha: true`, cleared each frame) once the background leaves it.
- **Depth order across layers** (docs/rendering.md rule 14). Everything in the scene layer is under everything in the
  2D layer. A kind may move to the scene only when every kind that must be under it is already there. The stage order
  below follows that: the rod moves together with the line and the float, so the rod still covers the line's start.
- **Resolution per layer.** Each layer has its own pixel ratio. The scene's is
  `min(art height / logical height, devicePixelRatio, cap)` for the background (art drawn about 1:1). The 2D layer
  keeps today's ratio. Static containers are cached as textures and redrawn only when they change (camera, parallax
  offset).
- **Fallback.** Without WebGL, or after a lost context, the router sends every kind back to the 2D path, which stays
  complete until the last stage is accepted (D5). The DEV switch `scene: webgl | canvas` compares the two.
- **Measurement.** The frame probe gets a `scene` section; the overlay shows it next to the 2D passes.

## Stages (each its own spec, commit and phone measurement in both orientations)

| # | Stage | Done when |
| --- | --- | --- |
| 0 | **Spike:** pinned vendor bundle of Pixi + spine-pixi-v8 + the needed filters (D2), guard rule, size measured; an empty scene canvas under the 2D canvas behind a DEV flag | Empty-scene cost on the phone (both orientations) measured and within budget; bundle size recorded |
| 1 | **Scene layer infrastructure:** composition, resolution owner for both canvases, loop-driven render, router, fallback, DEV switch, transparent 2D canvas | Game unchanged visually with everything still routed to 2D; switch and fallback work |
| 2 | **Background and time of day** in the scene, with background variants sized for the screen (spec 102 next step 1) and day/night blended in one pass (`ColorMatrixFilter` or two sprites) | Background routed to the scene; portrait art 1:1; FPS ≥ today |
| 3 | **Water:** ripple displacement (`DisplacementFilter`), reflections or glow where the art needs them | Effects within budget on the phone |
| 4 | **Line, float and rod together:** line as Pixi `Graphics` (same curve model), float sprite, rod through spine-pixi-v8 behind the existing scene port (controller, tracks, anchor and DEV tools unchanged) | WebGL → 2D copy gone; rod covers the line's start; Spine DEV section works |
| 5 | **Parallax and Spine background, Spine fish** | Parallax layers cached and redrawn only on offset change; budget holds |
| 6 | **Adaptive scene resolution** (spec 102 next step 3): pixel ratio steps down/up from measured frame time; Auto / Low / High setting (spec 047) | Weak phones keep the target frame rate |

## Cleanup per stage (DEVELOPMENT_RULES "Utils cleanup step", owner 2026-10-18)

Each stage ends by removing what it made certainly unused. Live checks are proposed to the owner, not deleted.

| Stage | Removed when the stage lands |
| --- | --- |
| 0 | `utils/vendor-spine.js` (replaced by `utils/vendor-libraries.js`) and every doc line that tells people to run it |
| 2 | the 2D background drawing path's tools and fixtures once the scene draws the background and the fallback is covered by the scene-layer check |
| 4 | `SpineGlSurface`, the spine-webgl `spine_runtime_module.js` / `SpineScene` adapter, `vendor/spine-webgl/` and its manifest entry, `utils/vendor-libraries.js` Spine part and the npm devDependency, once spine-pixi-v8 serves the rod (D7); `spine-rod` check parts that test the removed adapter are rewritten for the Pixi adapter |
| 5 | the 2D scene renderers (background, water, float, line, rod) and their test fixtures, once the owner accepts stage 5 (D5) |

## Requirements for every stage

- docs/rendering.md applies in full. Every stage's spec records FPS, game CPU, the scene section and "outside game
  CPU" on the owner's phone in portrait and landscape, before and after.
- Budget: the whole frame within 16.7 ms on the owner's phone. A stage that adds cost states what it costs and why.
- Production never depends on DEV, and the game-cycle baseline stays unchanged. Vendor files are pinned and checked
  by the manifest guard (spec 099 D2), and the release lists them (tracked files only, Pages).
- Context loss: the scene falls back to 2D and restores itself. Textures are released with the scene, with no leaks
  across sessions.
- Licences: PixiJS MIT; Spine Runtimes licence (requires the owner's Spine Editor licence) shipped with the bundle.
- Checks: models and routing in Node (no WebGL there). The renderer stays behind the port, with a fake for checks, and
  its real behaviour is measured on the phone.

## Owner decisions needed

Answered 2026-10-18. D1 and D6 explicitly by the owner; D2–D5 and D7 accepted with the decision to proceed as
recommended ("зафіксувати рішення ... розпочинати етап 0").

Effort weighed before D1, in stages of one spec each: own renderer from scratch ~10–14; own on spine-webgl ~7–10;
PixiJS ~5–6 up to stage 5. Own code would save ~300–500 KB of lazily loaded JS but costs 2–3× the work and owns
mobile GPU driver bugs. With many layers and Spine-first animation, the owner chose PixiJS.

| # | Question | Decision |
| --- | --- | --- |
| D1 | Ready library or own renderer | **Owner: PixiJS 8** + spine-pixi-v8 4.3.13 + pixi-filters, as a renderer behind our ports |
| D2 | How the library reaches `vendor/` | Pinned npm devDependencies and a deterministic `utils/vendor-pixi.js` that bundles them with **esbuild** (a new devDependency, used only to produce the vendor file) into one self-contained ESM file plus licences and the manifest hash; same guard rule as spec 099 |
| D3 | WebGL only or WebGPU too | WebGL 2 (WebGL 1 fallback); WebGPU later |
| D4 | Stage order | As in the table (background first, then water, then line + float + rod together) |
| D5 | How long the full 2D path stays | Until stage 5 is accepted on the phone; then the 2D scene renderers are removed in their own spec |
| D6 | HUD and windows | **Owner: stay 2D canvas (HUD text and the rest) and DOM (windows)** |
| D7 | Our spine-webgl runtime (spec 099) after stage 4 | Replaced by spine-pixi-v8 behind the same scene port; vendor file removed when nothing imports it |

## Stage 0 brief (for the next session)

Goal: the library is in the repository, guarded and measured; an empty WebGL scene renders under the 2D canvas
behind a DEV flag. No visible change in the game without the flag.

1. Pin exact devDependencies: `pixi.js` 8.22.0, `@esotericsoftware/spine-pixi-v8` 4.3.13 (peer `pixi.js` ^8.16;
   depends on spine-canvas 4.3.13), `pixi-filters` 6.1.5, `esbuild` 0.28.2.
2. Replace `utils/vendor-spine.js` with `utils/vendor-libraries.js`, which writes **both** manifest entries.
   - The current script rewrites `vendor/manifest.json` with the Spine entry only; a second script would drop it.
   - Spine stays a byte copy.
   - The Pixi entry is an esbuild bundle (format esm, minified, no splitting, target es2022) of an entry module that
     re-exports only what the scene uses: `Application`, `Container`, `Sprite`, `Texture`, `Graphics`,
     `RenderTexture`, the spine-pixi-v8 `Spine` classes, and `DisplacementFilter` / `ColorMatrixFilter`. It is
     extended per stage.
   - Output: `vendor/pixi/8.22.0/pixi-scene.js`, plus one licence file concatenating PixiJS (MIT), pixi-filters (MIT)
     and the Spine Runtimes licence.
   - Deterministic; `--check` mode.
   - Confirm that the bundle has no `import` / `import()` left (the guard requires that) and record its size,
     minified and gzip.
   - Docs that mention `vendor-spine.js` (architecture.md, spec 099 tasks) are updated.
3. Architecture guard: the manifest already supports several entries. The Pixi entry's single importer is
   `src/platform/browser/scene/pixi_runtime_module.js`.
4. Port in the engine: `src/engine/scene/inactive_scene_layer.js` with `SCENE_LAYER_METHODS`
   (`render(frame)`, `dispose()`) and `InactiveSceneLayer`, composed by bootstrap like the frame probe (no
   constructor defaults). `GameRenderCoordinator` calls `sceneLayer.render(frame)` before the 2D pipeline. The frame
   probe gets a `scene` section.
5. Platform: `pixi_runtime_module.js` (`createPixiRuntime()` → `{ version, createSceneLayer(options) }`), a lazy
   provider like `SpineRuntimeProvider`, and `PixiSceneLayer`:
   - an `Application` on a new `<canvas class="game-shell__scene">` inserted right before `#gameCanvas`, CSS in
     `game-shell.css` (same box as the game canvas, under it);
   - `autoStart: false`, no shared ticker, events off (`eventMode: "none"`), `autoDensity: false`;
   - resolution and size from `CanvasMetricsProvider`, resized only when the logical size or ratio changes;
   - async init; renders nothing until ready; context loss leaves the 2D game unchanged.
6. DEV flag `dev.html?scene=webgl` composes the Pixi layer (an empty stage with the background colour); without it,
   `InactiveSceneLayer`. Production composes the inactive layer. The 2D canvas stays opaque in stage 0: making it
   transparent and routing kinds is stage 1.
7. Check `scene-layer` (Quick): the inactive port, `PixiSceneLayer` with a fake Pixi namespace (resize on change only,
   one render per frame, dispose), the coordinator calling the layer before the 2D passes, the manifest entry and the
   bundle without imports.
8. Cleanup: delete `utils/vendor-spine.js` once `utils/vendor-libraries.js` replaces it, with every doc line that
   names it (DEVELOPMENT_RULES "Utils cleanup step").
9. Architecture + Quick + Full, game-cycle unchanged. Commit, push, Pages. The owner measures `dev.html` against
   `dev.html?scene=webgl` on the phone in both orientations (FPS, game CPU, `scene`, "поза CPU гри") and the result
   goes into this spec.

## Shaders

Most effects come ready from `pixi-filters` and Pixi itself (displacement, colour matrix, glow, bloom, god rays,
shockwave, noise, blur, alpha masks), and Spine renders through its official runtime. A custom effect, if one is ever
needed, is a small fragment shader on Pixi's `Filter` API, written and checked in its own spec. That is not a
prerequisite for any stage above.
