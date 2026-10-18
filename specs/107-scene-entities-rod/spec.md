# WebGL scene layer, stage 4: world entities, fight areas, line, float and rod

Stage 4 of [spec 103](../103-webgl-scene-layer/spec.md) (owner, 2026-10-18: "Тепер переходимо до 4"). Builds on
[spec 106](../106-scene-water/spec.md). Rules: [docs/rendering.md](../../docs/rendering.md) (mandatory).
Status: **implemented 2026-10-18 (records below): every world kind is on the scene; the owner's phone check and the
spine-webgl cleanup (D9) are pending.**

Spec 103's stage table: "Line, float and rod together: line as Pixi `Graphics` (same curve model), float sprite, rod
through spine-pixi-v8 behind the existing scene port (controller, tracks, anchor and DEV tools unchanged). Owner,
2026-10-18: the fight areas and the boats/chum zones lie between the background and the line and must not be drawn over
the rod, so they move to the scene first. Done when: WebGL → 2D copy gone; rod covers the line's start; fight areas,
boats and chum zones stay under the rod; Spine DEV section works."

## Decisions

Taken while implementing; the owner may revisit any of them.

| # | Question | Decision |
| --- | --- | --- |
| D1 | Order | Two parts, as the owner decided: **A** the `world-entities` kind (bait boats, chum zones, waypoints, sensor rays) and the `fight-areas` kind (last-dash band, catch zone, landing net band, pole sector, line radius); then **B** `line`, `rod` and `float` together. The router's depth rule (spec 104) puts a kind on the scene only when every kind under it is there, so after A the line, rod and float stay on the 2D canvas, above all of them, exactly as today. |
| D2 | How they are drawn | Pixi `Graphics` with the 2D renderers' shapes, colours, opacities and line widths (`BoatChumRenderer`, `FightAreaRenderer`; the fight area colours come from the same `FightAreaStyleResolver` instance, composed before the scene, so DEV config edits reach both layers). Pixi has no line dash: dashed lines are drawn as their dashes (`appendDashedLine`, the Canvas 2D pattern convention). The 2D clip to the castable water or the fight's water is a Graphics mask of the same rectangles. Pixi's text classes are not in the bundle: the boat emoji and the waypoint numbers are drawn once into small canvases at the scene's pixel ratio (`SceneTextTextures`, released with the scene) and shown as sprites. |
| D3 | When the scene presents a frame | The models are rebuilt every frame, so each kind keeps a fingerprint of what it draws (`SceneChangeFingerprint`: lengths rounded to 0.05 logical px, opacities to half an 8-bit step, the thresholds of spec 105 D3); its Graphics are rebuilt and a frame is presented only when the fingerprint changed. Still chum zones cost nothing; a moving boat or a fight presents a frame per change. |
| D4 | What stays on the 2D canvas above the scene | The DEV world debug drawing, the invalid-cast marker, the casting guides (depth limit, aiming zone, accuracy area, power aim: shown only while aiming, never together with the fight areas), the HUD and the outcome screens. After part B the casting guides lie above the rod: they are aiming UI, like the HUD. |

| D5 | Line and float | The line is one `Graphics` quadratic curve from the rod tip to the tackle, with the model's colour and width (the tension colours included), plus the plain rod bar of a rod without an animated skin, as `RodLineRenderer` draws them. The float keeps `FloatRenderer`'s shapes (hooked marker, lure dot, feeder ellipse, float body turned by its tilt). Canvas 2D's glow (`shadowBlur` in the tackle's colour) becomes a soft radial halo sprite tinted that colour and sized to the shape plus the blur's reach, under the shape: no filter pass. |
| D6 | The rod | spine-pixi-v8 behind the skeletal scene port (spec 099), as spec 103 D7 planned. `SpineScene` stays the one module that drives Spine: a runtime may declare a y-down world (`graphics.yDown`, spine-pixi-v8 sets `Skeleton.yDown`) and give a display object (`graphics.createView`: a Pixi `Spine` whose skeleton and state the scene drives; after each update the scene marks it changed, which spine-pixi-v8 4.3.13 does at the end of its own update). The controller is unchanged but for two anchor fields (`view`, `viewScale`). With the WebGL scene, its surface is `SceneSkeletalSurface` (a coordinate space sized like the GL surface, "lost" while the scene does not draw the rod) and its runtime is `createPixiSpineRuntime`, imported from the scene's own bundle once the scene is ready. `PixiRodRenderer` parents the view at the rod's depth, at the anchor's destination, surface pixels scaled to logical ones (where the GL surface used to be copied), and draws the static picture as an atlas-region sprite. A lost context or the DEV switch sends the rod to the 2D canvas, where the controller shows the static picture until the scene draws again. |
| D7 | Frames | A Spine pose changes every frame (the idle wind), so while the Spine rod shows the scene presents every frame, as the 2D canvas drew it every frame before; the line, float and static rod present only on change (fingerprints). |
| D8 | Bundle | The scene bundle also exports `Rectangle` (texture frames) and the spine-core classes `SpineScene` drives (`Skeleton`, `AnimationState`, `AnimationStateData`, `PointAttachment`, `CurveTimeline1`, `TextureFilter`) from spine-pixi-v8's own copy: 804 661 bytes, 145 more (they were already inside). |
| D9 | `?scene=canvas` and the cleanup | Until the owner's phone check of this stage, `?scene=canvas` keeps spine-webgl with its offscreen GL surface for a like-for-like comparison. Then spec 103's stage 4 cleanup removes spine-webgl (`vendor/spine-webgl/`, its runtime module and manifest entry, `SpineGlSurface`, the copy in `RodSpineRenderer`); the 2D canvas then shows the static rod, which only a device without WebGL or a lost context ever reaches. |

## Record, part A (2026-10-18)

| Item | Where |
| --- | --- |
| World entities (D2, D3) | `platform/browser/scene/pixi_world_entities_renderer.js` (`PixiWorldEntitiesRenderer`: masked chum zones, waypoints with numbers, boat emoji sprites turned with the boat, energy bars, sensor rays; pooled sprites) |
| Fight areas (D2, D3) | `platform/browser/scene/pixi_fight_area_renderer.js` (`PixiFightAreaRenderer`: bands, catch ellipse or band, net band, sector and its dashed axis, line radius; mask) |
| Helpers | `scene_change_fingerprint.js` (`SceneChangeFingerprint`), `pixi_dashed_line.js` (`appendDashedLine`), `scene_text_textures.js` (`SceneTextTextures`) |
| Layer | `PixiSceneLayer` draws, bottom first: background, water, world entities, fight areas; each from the router's decision (`fight-areas` only while the fishing model is visible) |
| Composition | `SCENE_RENDERED_KINDS = ["background", "world-entities", "fight-areas"]`; `composeSceneLayer` gets `fightAreaStyles` (the root composes the style resolvers first) |
| Checks | `scene-layer` (fingerprint thresholds, dashes as Canvas 2D draws them, text texture reuse and release, world entities and fight areas over a fake Pixi: colours, clips, emoji rotation, energy bar, frames only on change, hide once, style edits) |

Parity, headless Chromium with the real Pixi bundle, ratio 2: the same world and fight models drawn by the 2D renderers
on a canvas and by the scene renderers side by side differ in 0.44% of the pixels by more than 24 of 255 and in 0.05% by
more than 64 (anti-aliased edges); dashes, clips, the emoji and the waypoint number line up.

Cleanup: nothing became unused (the 2D renderers remain the fallback until spec 103 stage 5).

## Record, part B (2026-10-18)

| Item | Where |
| --- | --- |
| Line, float (D5) | `platform/browser/scene/pixi_line_renderer.js` (`PixiLineRenderer`), `pixi_float_renderer.js` (`PixiFloatRenderer`, glow halo texture) |
| Rod (D6) | `animation/spine_scene.js` (`graphics.yDown`, `createView`, `viewUpdated`, `disposeView`, `getView()`), `scene/pixi_spine_runtime.js` (`createPixiSpineRuntime`), `scene/scene_skeletal_surface.js` (`SceneSkeletalSurface`), `scene/pixi_rod_renderer.js` (`PixiRodRenderer`), `pixi_runtime_module.js` (`createSpineRuntime()`), `RodAnimationController` anchor `view` / `viewScale`, the rod line model's `rodView` / `rodViewScale` |
| Composition | `SCENE_RENDERED_KINDS` lists every world kind; `composeRodAnimation({ scene })` picks the scene surface and runtime when the scene is WebGL (`scene: { layer, router, webgl }` from the root) |
| Checks | `spine-rod` (the same scene on spine-pixi-v8 and spine-webgl: line tip, bounds and every bone equal to 1e-6 over five track changes; the view is the scene's, updated once per update and destroyed with it; the scene surface), `scene-layer` (line bar and curve, rod region cut and turned, view placed and swapped, float shapes and halo, every kind on the scene, the lazy imports of Pixi) |

Parity, headless Chromium, ratio 2. The same bamboo rod run by two controllers, spine-webgl copied into a 2D canvas and
spine-pixi-v8 inside a Pixi scene: line tip and destination equal to 1e-13 at idle and under the fight bend, and no rod
pixel differs by more than 24 of 255 under the bend. In the game (`index.html`, a rod, line, hook, float and bait
equipped, a power cast): the Spine rod, the line from its tip and the float on the scene; DevTools shows every kind on
WebGL and the rod in Spine mode. A lost context sends the rod to the 2D canvas as its static picture, and a restored one
brings the Spine rod back.

Owner's check (pending): the rod, line and float on the phone in both orientations (look, the line under the rod, the
fight bend and tremble), FPS and the `scene` section; `dev.html?scene=canvas` still shows the old path for comparison.
