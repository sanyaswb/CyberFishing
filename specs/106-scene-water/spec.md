# WebGL scene layer, stage 3: water

Stage 3 of [spec 103](../103-webgl-scene-layer/spec.md) (owner, 2026-10-18: "приступай до наступного кроку"). Builds on
[spec 105](../105-scene-background/spec.md). Rules: [docs/rendering.md](../../docs/rendering.md) (mandatory).
Status: **implemented 2026-10-18 (record below); the owner's look and phone measurement are pending.**

Spec 103's stage table: "Water: ripple displacement (`DisplacementFilter`), reflections or glow where the art needs
them. Done when: effects within budget on the phone."

## Decisions

Taken while implementing; the owner may revisit any of them. Every value below is a live setting in DevTools.

| # | Question | Decision |
| --- | --- | --- |
| D1 | What the water shows | **Ripples only:** the art's own water (its reflections, the green swirl, the ink lines) wobbles gently, as if the surface moved. No added reflections or glow: the location art already paints both, and a second copy would compete with it. Either can follow in its own step if the owner asks for it. |
| D2 | How the ripples are made | Pixi's ready `DisplacementFilter` (already in the vendored bundle: no bundle change, no hand-written shader, spec 103 "Shaders"). Its map is a small procedural image (`WaterWaveField`, 192×48): crossing sine waves on the water plane, in art pixels, shorter and calmer toward the far edge (perspective, far edge drawn at 0.35 of the near one) and fading to nothing over the outer 18% (far), 8% (shore) and 3% (sides), so the moving water meets the still art without a seam. Each step refills it (a rotation per row instead of a sine per texel: ~0.15 ms of JavaScript on a desktop, identical to the direct formula to the byte) and uploads 36 KB. A scrolling noise texture was not used: it slides as one rigid pattern and cannot carry the perspective or the edge fades. |
| D3 | Where the water is | The location's castable zones (`world.clipRegions`, already in the world model): on the test location they cover the art's water exactly, from under the far wall to the pier. The filter works only on the visible part of that area (clipped to the screen), and the map spans the whole area, so the waves stay fixed to the water when the camera moves. A location whose water differs from its castable zones gets its own outline when one exists. |
| D4 | What is filtered | A copy of the background's layers (both time-of-day phases, same textures and positions) inside the water area, drawn through the filter over the unfiltered background. It belongs to the `background` kind: no new router kind, since the 2D canvas has no water; on the 2D fallback the water stays still. Scene order: background, water, then the 2D canvas above. |
| D5 | When the scene presents a frame | The water steps `frameRate` times a second (30 by default) and each step presents one scene frame; between steps nothing new is presented (spec 105 D3 still holds for everything else). This is the stage's cost: portrait used to present once and keep the picture; now it presents 30 frames a second while water is on screen. |
| D6 | Settings | `CONFIG.canvas.water`: `enabled` (true), `frameRate` 30, `amplitude` 8 (art pixels of shift at the shore; the filter's scale is twice that, times the art's drawn scale), `verticalShare` 0.35 (vertical shift as a share of the horizontal), `wavelength` 140 and `speed` 24 (art pixels and art pixels per second). Art pixels keep the look the same at every screen size. Validated by `ConfigSchemaValidator`, labelled in `parameter_labels.json`, read every frame, edited live in DevTools "🖼️ СЦЕНА WebGL" → "Брижі на воді". |
| D7 | Animation clock | The game clock (`GameClock.now`, the frame's time): the coordinator does not fill `frame.dt`. |
| D9 | The current | **Owner, 2026-10-18: the water flows with the location's current** ("саме так варіант 1": the current was added for this). The world model carries `environment.current` of the location (the one that drifts the tackle and the bait boat) as a velocity in art pixels per second (`world.current`, virtual pixels are art pixels); the water carries its whole wave pattern by that velocity times `currentScale` (3 by default: the physical 5 px/s is barely visible; 1 = as in physics, 0 = no drift). The drift accumulates step by step, so a changed current or scale changes the speed without a jump; the far water drifts slower on screen (perspective). Left or right comes from the location's `direction.x`. DEV shows "течія … пікс/с". |
| D8 | Production | Water on (production already runs the scene since spec 105 D6). If the phone measurement does not hold, `enabled: false` turns it off without touching anything else. |

## Record (2026-10-18)

| Item | Where |
| --- | --- |
| Wave field (D2) | `platform/browser/scene/water_wave_field.js` (`WaterWaveField`: RGBA map, perspective and edge fades, row rotation) |
| Water (D3-D5, D7) | `platform/browser/scene/pixi_water_renderer.js` (`PixiWaterRenderer`: two mirrored sprites in a container with `DisplacementFilter` and `filterArea`, the map canvas and texture, steps at `frameRate`, `status` for DEV) |
| Layer | `PixiSceneLayer` creates the water after the background, updates it every render with the logical size and `clock.now`, reports `water` in `getStatus()`, releases the map texture on dispose; `composeSceneLayer` passes the game clock and `getWaterSettings: () => config.canvas?.water` |
| Settings (D6) | `CONFIG.canvas.water` in `game_config.js`, `#validateSceneWaterConfig`, seven labels |
| Current (D9) | `world.current` in `GameRenderFrame`, filled by `WorldRenderFrameBuilder` from the location's `environment.current`; `PixiWaterRenderer` accumulates the drift; `WaterWaveField.write` takes `driftX` / `driftY` |
| DEV | "🖼️ СЦЕНА WebGL": "вода: анімується · карта 192×48 · крок … мс" and the live editor of `CONFIG.canvas.water` |
| Checks | `house` (the world model carries the location's current), `scene-layer` (wave field: deterministic, moving, still at speed 0, a drift of one texel's width moves the row one texel, edge fade, perspective; water: the current × `currentScale` moves the pattern even with still waves, none at scale 0; filter area clipped to the screen, map over the whole zone, both phases mirrored, scale from art pixels, one present per step at the frame rate, live settings, hidden once when off or off screen, map released), `config-schema` (bounds) |

Visual check, headless Chromium: with `amplitude` 40 the swirl and the ink lines wave clearly, the far edge under the
wall and the pier edge stay still (no seam); at the default 8 the shift is about 4.5 logical px at the shore in portrait,
a gentle wobble. The look is the owner's to judge on the phone.

Headless Chromium, SwiftShader software GL, ratio 2, `dev.html`, water on and off live (not a phone result: software GL
makes every WebGL present wait for a software compositor, which is why an empty scene was not presented every frame in
spec 104):

| Viewport | Water | FPS over 1 s, four samples | `scene` section mean / max | Game CPU per frame |
| --- | --- | --- | --- | --- |
| Portrait 400×816 | off | 60 60 60 60 | 0.0 / 0.1 ms | 0.3 ms |
| Portrait 400×816 | on | 18 16 15 19 | 0.6 / 14.8 ms | 1.2 ms |
| Landscape 816×400 | off | 22 24 16 20 | 0.4 / 60.5 ms | 1.1 ms |
| Landscape 816×400 | on | 5 7 7 9 | 1.1 / 37.4 ms | 2.3 ms |

The game's own work stays small (the map step and the filter's draw calls); the frame rate falls because software GL
presents 30 frames a second. A phone GPU presents a scene frame cheaply (stage 0 presented an empty scene every frame
and the owner's phone stayed smooth), so the phone measurement decides.

Owner's check (pending): the look of the water (DevTools "Брижі на воді": `amplitude`, `wavelength`, `speed`,
`frameRate`), and `dev.html` with the water on against off, portrait and landscape: FPS, "поза CPU гри", janks /
freezes, the `scene` section. If the frame rate drops, try `frameRate` 20 before turning the water off (D8).

Cleanup: nothing became unused.
