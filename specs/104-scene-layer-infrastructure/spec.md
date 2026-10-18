# WebGL scene layer, stage 1: infrastructure

Stage 1 of [spec 103](../103-webgl-scene-layer/spec.md) (owner, 2026-10-18: "Переходь на Етап 1"). Rules:
[docs/rendering.md](../../docs/rendering.md) (mandatory). Status: **implemented 2026-10-18 (record below); the
owner's phone measurement is pending.**

Spec 103's stage table: "composition, resolution owner for both canvases, loop-driven render, router, fallback, DEV
switch, transparent 2D canvas. Done when: game unchanged visually with everything still routed to 2D; switch and
fallback work." Stage 0 left four items for this stage: the production composition, the transparent 2D canvas, the
scene canvas in the DEV split layout, and the shader warm-up.

## Decisions

Taken while implementing, as the safe defaults spec 103 recommends; the owner may revisit any of them.

| # | Question | Decision |
| --- | --- | --- |
| D1 | Where the mode comes from | `CONFIG.canvas.scene`: `"canvas"` (default) or `"webgl"`, read once at startup, because a 2D context's `alpha` cannot change after creation. DEV: `dev.html?scene=webgl` or `?scene=canvas` overrides it for that page load; an unknown value keeps the config and warns. **Production stays `"canvas"`** until stage 2 routes the background and the phone measurement holds: with no kind on the scene, WebGL would only add download and compositing cost. |
| D2 | Who composes | `bootstrap/production/scene_layer_composition.js` for both pages: `"canvas"` → `InactiveSceneLayer`, opaque 2D canvas, no Pixi download; `"webgl"` → `DeferredSceneLayer` over the lazy runtime import, transparent 2D canvas. Without WebGL (or when the bundle fails to load) the layer reports inactive and the router keeps everything on the 2D canvas. |
| D3 | Router | `SceneLayerRouter` (presentation) decides once per frame, at the coordinator's frame start, which layer draws each world kind. A kind goes to the scene only when the mode is `"webgl"`, the layer is active (WebGL running, context not lost), the scene has a renderer for the kind, and every kind under it is on the scene (rule 14). Everything else stays on the 2D canvas, whose path stays complete. |
| D4 | Which kinds, in depth order | `background`, `world-entities` (boats, chum zones), `fight-areas`, `line`, `rod`, `float`. HUD overlays (casting guides, the invalid-cast marker, HUD bars, outcome screens, DEV debug drawing) are not kinds: they stay on the 2D canvas above every scene kind (docs/rendering.md roles). Stage 1 has no scene renderer, so every kind is on the 2D canvas. |
| D5 | DEV switch | Startup: the URL parameter (D1). Runtime: DevTools "🖼️ СЦЕНА WebGL" switches the router between `"webgl"` and `"canvas"` without a reload (the 2D canvas stays transparent), shows the layer state and routing, and can lose and restore the WebGL context to test the fallback. |
| D6 | Transparent 2D canvas | In `"webgl"` mode the 2D context has `alpha: true`, and the game canvas loses its CSS background while the scene canvas is under it (`game-shell__canvas--over-scene`). The 2D canvas is cleared at frame start only when the bottom kind (`background`) is on the scene; until then the 2D background covers every pixel, so stage 1 adds no clear. |
| D7 | Resolution and placement owner | `CanvasMetricsProvider` stays the one owner of the logical size and pixel ratio; the scene follows its readings (resize only on change). The DEV landscape split (spec 098) now sets its state on the page shell (`game-shell--staged`, `--game-stage-left` on `body`), so CSS places both canvases in the game strip. The art-based scene ratio (spec 103 "Resolution per layer") comes with the background art in stage 2. |
| D8 | Shader warm-up | The Pixi layer renders once during its init, and in `"webgl"` mode startup waits for the scene layer before the game loop starts. The first-render cost (about 150 ms in software GL, spec 103 stage 0) falls into loading, not into play. |
| D9 | When the scene presents a frame | Only while at least one kind is on it (docs/rendering.md rule 22). Found while measuring (record below): an unchanged empty scene presented every frame made Chrome block inside the scene's `clear` until the compositor released a buffer. With nothing routed, the scene keeps its warm-up frame. |

## Not in this stage

- No kind moves to the scene (stage 2: background and time of day).
- Rule 14 consequence for stage 4: `fight-areas` and `world-entities` lie between the background and the line, so the
  line, rod and float can move only after them, or after the owner decides they may be drawn above the rod.

## Record (2026-10-18)

| Item | Where |
| --- | --- |
| Mode (D1) | `CONFIG.canvas.scene: "canvas"` in `game/config/runtime/game_config.js`, validated (`"canvas"` or `"webgl"`) by `ConfigSchemaValidator`; DEV `sceneMode: pageParams.get("scene")` in `development_game_startup.js` |
| Composition (D2) | `bootstrap/production/scene_layer_composition.js` (`composeSceneLayer`), called by `GameCompositionRoot.create` before the 2D surface; the stage 0 DEV factory `bootstrap/development/dev_scene_layer_composition.js` is removed |
| Port | `SCENE_LAYER_METHODS`: `render`, `isActive`, `whenReady`, `getStatus`, `loseContext`, `restoreContext`, `dispose`, implemented by `InactiveSceneLayer`, `DeferredSceneLayer` and `PixiSceneLayer` |
| Router (D3, D4, D9) | `game/presentation/rendering/scene_layer_router.js` (`SceneLayerRouter`, `SCENE_KINDS`, `SCENE_MODES`); `GameRenderCoordinator` calls `update()` once per frame and renders the scene only while `rendersScene()`; `GameRenderComposition` gates the 2D components `world-background`, `boat-chum`, `fight-area`, `rod-line`, `rod-static`, `rod-spine` and `float` with `canvasVisibility(kind)` |
| Transparent 2D canvas (D6) | `Canvas2DSurface` gets `alpha: true` in `"webgl"` mode; `beginFrame(clear)` clears the backing store when `router.clearsCanvas()`; `PixiSceneLayer` adds `game-shell__canvas--over-scene` (transparent CSS background) while it exists |
| Placement (D7) | `GameStageLayout({ shell })` toggles `game-shell--staged` and `--game-stage-left` on `body`; `game-shell.css` places `.game-shell__canvas` and `.game-shell__scene` in the strip |
| Warm-up (D8) | `PixiSceneLayer` renders once after `app.init`; `whenReady()` resolves after it; `GameCompositionRoot.create` awaits `sceneLayer.whenReady()` |
| DEV switch (D5) | `dev/tools/scene_layer_dev_section.js`, DevTools "🖼️ СЦЕНА WebGL" |
| Checks | `scene-layer` rewritten for stage 1; `viewport` (shell state), `config-schema` (invalid mode), `config-runtime` (DEV `sceneMode`), the render frame composition in `fish-rarity` (router per frame) |

Measurements in headless Chromium (SwiftShader software GL, 400×800 CSS px at ratio 2; not a phone result):
- Warm-up: init plus the warm-up render took 91 ms; the following renders 0.0–0.2 ms each.
- Before D9, with the empty scene presented every frame, the `scene` section showed early spikes of 8, 75 and 231 ms
  over three page loads (plain `dev.html`: draw max 5–25 ms). Pixi issues only `depthMask` ×2 and `clear` per empty
  frame, with no synchronous call; the wait is Chrome holding the new WebGL frame until the compositor releases a
  buffer while startup work keeps the software GPU process busy. After D9 (three loads each):

| Page | FPS | draw max | `scene` section |
| --- | --- | --- | --- |
| `dev.html` | 45, 46, 50 | 22.1, 10.7, 5.0 ms | — |
| `dev.html?scene=webgl` | 49, 46, 45 | 5.6, 8.7, 23.0 ms | not rendered (no kind on the scene) |

- Visual: screenshots of both modes differ only in the DEV overlay panel; in the world area the mean pixel difference
  is 0.51 of 765 (fog animation and the clock).
- Browser smoke: `index.html` and `dev.html` keep an opaque 2D canvas and no scene canvas; `?scene=webgl` has
  `alpha: true`, the transparent CSS background and the scene canvas in the same box; the staged shell puts both
  canvases at the same strip offset; DevTools shows "активний", "WebGL 2 · 400×800 @ 2×", every kind on 2D; "Втратити
  WebGL-контекст" turns the state into "контекст втрачено → усе на 2D" and "Відновити" back to "активний", with the
  game running and no console errors.

Owner's phone measurement (pending), DevTools overlay "⚡ ПРОДУКТИВНІСТЬ", portrait and landscape:

| Page | Orientation | FPS | game CPU | "поза CPU гри" | janks / freezes |
| --- | --- | --- | --- | --- | --- |
| dev.html | portrait | | | | |
| dev.html?scene=webgl | portrait | | | | |
| dev.html | landscape | | | | |
| dev.html?scene=webgl | landscape | | | | |

What `?scene=webgl` costs now, with nothing routed: the Pixi download and init during loading, one more composited
layer under a transparent 2D canvas, and on desktop Chromium the 2D text loses LCD (subpixel) antialiasing, which it
uses only on opaque canvases. Phones draw grayscale antialiased text either way.

Cleanup (DEVELOPMENT_RULES "Utils cleanup step"): removed `bootstrap/development/dev_scene_layer_composition.js` and the
`createSceneLayer` composition option (replaced by `composeSceneLayer` and `sceneMode`); the `game-shell__canvas--staged`
class is replaced by `game-shell--staged`. No `utils/` tool, fixture or dependency became unused; no live check was
removed.
