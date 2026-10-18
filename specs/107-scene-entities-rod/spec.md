# WebGL scene layer, stage 4: world entities, fight areas, line, float and rod

Stage 4 of [spec 103](../103-webgl-scene-layer/spec.md) (owner, 2026-10-18: "Тепер переходимо до 4"). Builds on
[spec 106](../106-scene-water/spec.md). Rules: [docs/rendering.md](../../docs/rendering.md) (mandatory).
Status: **part A (world entities, fight areas) implemented 2026-10-18; part B (line, float, rod) in progress.**

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
