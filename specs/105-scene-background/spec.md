# WebGL scene layer, stage 2: background and time of day

Stage 2 of [spec 103](../103-webgl-scene-layer/spec.md) (owner, 2026-10-18: "займайся вже наступним кроком"). Builds on
[spec 104](../104-scene-layer-infrastructure/spec.md). Rules: [docs/rendering.md](../../docs/rendering.md) (mandatory).
Status: **implemented and accepted 2026-10-18 (record below): production draws the background on the scene (D6).**

Spec 103's stage table: "Background and time of day in the scene, with background variants sized for the screen
(spec 102 next step 1) and day/night blended in one pass. Done when: background routed to the scene; portrait art
1:1; FPS ≥ today."

## Decisions

Taken while implementing; the owner may revisit any of them.

| # | Question | Decision |
| --- | --- | --- |
| D1 | What the scene draws | The `background` kind: the world model's background layers (the opaque time-of-day base and at most one translucent phase, `timeOfDayLayers`) as two pooled Pixi sprites over the clear colour `world.backgroundColor`. One render pass, two draw calls (two textures). The 2D `world-background` component steps aside through the router, and the 2D canvas starts each frame cleared (spec 104 D6). Boats, chum zones, the DEV world debug drawing and everything above stay on the 2D canvas. |
| D2 | Where textures come from | The images `ImageAssetProvider` already preloaded for the location (no Pixi loader). `SceneTextureCache` turns each into a texture with mipmaps and uploads it at once. The world model lists every background asset of the location (`backgroundAssetIds`: day, evening, night). **Owner, 2026-10-18: the visible phase first, the others after it one by one.** The first background frame uploads only the visible phase(s); each following frame that uploads nothing else uploads the next phase in the location's order, so a later dusk never uploads mid-play. **Owner, later the same day: upload them all under the loading screen.** After the warm-up frame, startup calls the scene port's `prepare(assetIds)` with every background phase of the location (already preloaded), so the first frames of play upload nothing; the staged order remains for images that load later. Textures are released with the scene. |
| D3 | When the scene presents a frame | Only when the background changed (layer, texture, position, size, alpha, clear colour), the scene was resized, or the context was restored (rules 13 and 22). A still camera at a steady time of day presents no WebGL frame; the browser keeps showing the last one. Changes too small to see do not count: under 0.05 logical px (a tenth of a backing pixel at ratio 2) or half an 8-bit opacity step, measured against the last drawn values so slow drift still adds up. Found while measuring: the camera follows the float with exponential easing, whose tail is many frames of ~0.03 px steps. |
| D4 | "Portrait art 1:1" | There is no larger background art (the location art is 2560×1440 and `asset-sources/` holds no larger master), so the scene's resolution follows the art instead: scene pixel ratio = `min(CanvasMetricsProvider.pixelRatio, max(1, texture height / drawn height))`, rounded to 0.01 (spec 103 "Resolution per layer"). Portrait at ratio 2 draws the 1440 px art 1:1 into a ~1.76× backing store, and the compositor scales the canvas to the screen; landscape keeps ratio 2 and shrinks the art through mipmaps. A larger art variant can replace this later without changing the code. |
| D5 | Texture size and memory | Each background is one 2560×1440 RGBA texture: 14.7 MB, 19.7 MB with mipmaps, **59 MB for the three phases** (rule 19: within the ~150 MB phone budget). 2560 px exceeds rule 20's 2048 px atlas page; it is a single full-screen image, not an atlas page, and WebGL devices that run the game report a maximum texture size of at least 4096. WebGL 1 cannot mipmap this non-power-of-two size and falls back to bilinear. |
| D7 | The camera at startup and after a resize | **Owner, 2026-10-18: open on the final framing**, and the same when the phone is turned: the camera moves only while it follows the float. `ViewportProjector`'s first `focusOnVirtualPos` after the camera is placed, and after any change of the canvas size (a turn, the browser bar shown or hidden, a split change), snaps to its target instead of easing into it; later focuses (following the float) ease as before. A resize also keeps the scene point at the centre of the screen horizontally: turning to landscape, where the whole width shows, and back used to leave the camera at the left edge of the scene. In landscape the camera used to ease for the first seconds, presenting about 30 scene frames; now the scene presents once. Both modes (2D and WebGL) behave the same way. |
| D8 | Image decoding | `ImageAssetProvider` reports an image ready after `image.decode()`, so decoding happens off the main thread during loading instead of inside the first draw or texture upload (both modes). A failed decode still counts as loaded. |
| D9 | The DEV overlay during the measurement | **Owner, 2026-10-18: 1.5 times smaller and as wide as its content** (it covered the screen). The window starts at scale 2/3. The scale is the `--debug-overlay-scale` property, which CSS applies as `zoom` to the content and the − / + buttons and as a factor on the window's padding, so the window's box is what is seen and dragging needs no transform correction; − / + step on a tenths grid (2/3 → 0.7 … 1.0). Explanatory notes wrap to the width of the rows (`contain: inline-size`) instead of widening the window to their line length. |
| D10 | FPS in the DEV overlay | **Owner, 2026-10-18:** FPS counts only the last second of frames (`FrameProfiler`, label "FPS (1 с)"); the other numbers stay over the 240-frame ring. The slow startup frames held the ring's FPS down for seconds after play was smooth. |
| D6 | Production | **Owner, 2026-10-18 (after the phone runs): `"webgl"`.** `CONFIG.canvas.scene: "webgl"`; without WebGL, or while its context is lost, the 2D canvas draws everything (spec 104). `dev.html?scene=canvas` keeps the 2D-only comparison. |

## Record (2026-10-18)

| Item | Where |
| --- | --- |
| Model (D2) | `world.backgroundAssetIds` in `GameRenderFrame`, filled by `WorldRenderFrameBuilder` from the map's phases |
| Textures (D2, D5) | `platform/browser/scene/scene_texture_cache.js` (`SceneTextureCache`: `Texture.from({ resource, autoGenerateMipmaps: true }, skipCache)`, upload through `renderer.texture.initSource`, release with the scene, byte count) |
| Background (D1, D3) | `platform/browser/scene/pixi_background_renderer.js` (`PixiBackgroundRenderer`: two pooled sprites, change detection with the visibility thresholds, clear colour, art density) |
| Layer (D3, D4) | `PixiSceneLayer.render(frame)` draws the kinds the router puts on the scene, resizes to the art-based ratio, presents only on change or after a context restore; `getStatus()` reports textures and bytes |
| Composition | `SCENE_RENDERED_KINDS = ["background"]`; the scene gets the page's `ImageAssetProvider` (now created before the scene) and the router |
| DEV | DevTools "🖼️ СЦЕНА WebGL" shows the scene's resolution and "текстури сцени: 3 · 56.3 МБ" |
| Checks | `scene-layer` (texture cache, background, frames only on change, portrait 1:1, landscape ratio, context restore, router gating), `house` (the world model lists every phase) |

Headless Chromium, SwiftShader software GL, ratio 2, after D3's thresholds (not a phone result; software GL makes every
WebGL present wait for a software compositor):

| Viewport | Page | FPS | `scene` section mean / max | Scene backing |
| --- | --- | --- | --- | --- |
| Portrait 400×816 | `dev.html` | 35 | — | — |
| Portrait 400×816 | `dev.html?scene=webgl` | 53 | 1.2 / 258 ms | 704×1436 @ 1.76 (the 1440 px art 1:1) |
| Landscape 816×400 | `dev.html` | 20 | — | — |
| Landscape 816×400 | `dev.html?scene=webgl` | 17 | 5.0 / 229 ms | 1632×800 @ 2 |

- The max is the first background frame, which then created and uploaded the three phases (59 MB with mipmaps; see the
  follow-up below for the staged order).
- Portrait: the background is static after the first frame, so the scene presents once, and the 2D canvas no longer
  redraws a full-screen image every frame. Landscape: the camera eases into place during the first seconds, and each
  WebGL present waits for the software compositor; then the scene almost stops presenting (a 12 s run: 30 changed
  frames in the first 4 s, 3 in the next 8 s). Before the thresholds the easing tail kept the scene presenting every
  frame (11 FPS).
- Visual: in portrait, the world area of both modes has the same geometry and sharpness; the remaining difference is the
  animated fog and the DEV overlay's height. In landscape the visible world strip differs by 0.05% of pixels.

Follow-up the same day (D2 order, D7, D8), headless Chromium:
- Camera: in 6 s, the background changed once in portrait and once in landscape (was 30 changed frames in 4 s).
- Upload of one 2560×1440 phase with mipmaps, measured alone (15 uploads each, synchronous part only):

| Image state before upload | Median | Worst |
| --- | --- | --- |
| loaded, not decoded (before D8) | 79 ms | 490 ms |
| `decode()` done (D8) | 45 ms | 125 ms |
| `createImageBitmap` (not used: a further ~15 ms off the median, but irregular and asynchronous) | 30 ms | 190 ms |

- In the running game, software GL makes those frames far noisier (36 ms to 1 s per upload, with or without D8), so
  the phone measurement decides; the staged order bounds the worst case to one phase per frame.

Owner's phone measurement (done, see below): `dev.html` against `dev.html?scene=webgl`, portrait and landscape, overlay
"⚡ ПРОДУКТИВНІСТЬ" (FPS, "поза CPU гри", janks / freezes, the `scene` section). If it holds, D6 turns production to
`"webgl"`.

Owner's first phone run (2026-10-18, release 0.41.1-c67b7cf): 60 FPS in both orientations after the start; at a reload
"CPU гри за кадр" shows up to 300% for 50–200 ms and FPS returns to green after 2–3 s; the camera still eased after a
turn. Reading the overlay at startup: its numbers are means over the last 240 frames (about 4 s), so the few heavy first
frames (WebGL: the three background uploads, D2; both modes: shader compilation, the Spine rod, unoptimised JavaScript)
dominate the CPU mean while only a handful of frames exist, and their long intervals hold the FPS mean down until they
leave the window. FPS is green (≥ 55) only once the extra startup milliseconds average below 1.5 ms per frame in the
window. The freeze bar shows the frames themselves: a few red bars at the start, then green.

Follow-up the same day (D7 after a turn, D9), headless Chromium 393×852 turned to 852×393 and back: before, 250 ms after
the turn to landscape 17.3% of the pixels still differed from the frame 3 s later (0.8% at 700 ms); now 0.0% at 250 ms
in both orientations, and portrait after the round trip opens centred as at a fresh start. The overlay window: 383×521
→ about 270×290 px in portrait (DPR 1), 701×470 → about 270×290 px in landscape.

Cleanup: nothing became unused (the 2D background path stays as the fallback until spec 103 stage 5).

Closing the stage the same day (D2 under the loading screen, D6, D10), headless Chromium, ratio 2: the `scene` section's
maximum in the first 4 s fell from 229–338 ms to 26 ms (portrait) and 20 ms (landscape); `index.html` and `dev.html`
run the scene in both orientations without errors; landscape FPS in software GL: 10–34 on the scene against 6–18 with
`?scene=canvas` (not a phone result).
