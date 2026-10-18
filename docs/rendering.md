# Rendering rules (mandatory before any rendering work)

Read this file before changing anything that draws: renderers, render passes, the canvas or its size, the WebGL
scene layer (PixiJS), image assets and their sizes, Spine exports and skeletons, the HUD over the canvas, or the
frame loop. It records what went wrong and the rules that prevent it. [DEVELOPMENT_RULES.md](../DEVELOPMENT_RULES.md)
and the local CLAUDE.md point here. Numbered rules 1–15 apply to all layers; rules 16–23 to the scene layer and
Spine-first art.

## Incidents

| Date | Symptom | Root cause | Fixed by |
| --- | --- | --- | --- |
| 2026-10-17 | On phones everything on the canvas was blurred; the rod and the victory fish were pixelated | The canvas backing store had one pixel per CSS pixel and the phone stretched it 2.6–3×. A 2735 px rod texture and 2752 px fish art were shrunk 10–14× in one bilinear step | [spec 100](../specs/100-render-resolution-and-image-quality/spec.md): backing store at the device pixel ratio (cap 2), mipmapped Spine pages, display-sized fish variants |
| 2026-10-17 | Right after spec 100, portrait phones ran at 10–17 FPS, landscape at 60. Game CPU was only 2–4 ms per frame; 55–100 ms per frame went to the GPU | Spec 100 set `imageSmoothingQuality = "high"` for the whole canvas. At pixel ratio 2 the portrait background is **enlarged** (1440 px of art over 1632 px of screen), and Chromium samples enlarged images bicubically: 16 texture reads per screen pixel, on the full screen, two layers at dusk and dawn, every frame. Landscape shrinks the same art, which uses cheap mipmaps. The quality fix itself never needed `"high"` | [spec 102](../specs/102-render-quality-policy/spec.md): filter chosen per draw by its scale |

## Scene layer and roles (spec 103, owner 2026-10-18)

The game renders in three roles, each with its own technology. A new visual goes to the role that fits it, not to
the role that is easiest to reach from the current code.

| Role | Technology | Holds |
| --- | --- | --- |
| **Scene** (bottom) | WebGL through PixiJS 8 (`src/platform/browser/scene/`), Spine through spine-pixi-v8 | Background and parallax layers, water, float, line, rod, fish, effects (filters), particles: everything in the world, and all Spine animation |
| **HUD canvas** (middle) | Canvas 2D (`Canvas2DSurface`) | HUD bars and text, fight zones until moved, overlays drawn per frame with text |
| **Windows** (top) | DOM | Inventory, House, victory and game-over panels, DevTools |

- Pixi is a renderer behind our ports, not a framework. Its ticker, event system and auto resize stay off. Our
  `GameLoop` renders it once per frame, `InputController` owns input, `CanvasMetricsProvider` owns resolution, and
  `AssetLoadQueue` loads images. Pixi types never leave `src/platform/browser/scene/`. Presentation builds render
  models; the scene renderer turns them into display objects.
- Everything in the scene is under everything in the HUD canvas. An object kind moves to the scene only when every
  kind that must be under it is already there (rule 14).
- While the migration runs, the 2D path for a kind stays complete as the fallback (no WebGL, lost context) until
  spec 103 stage 5 is accepted.
- Which layer draws a world kind is decided once per frame by `SceneLayerRouter` ([spec 104](../specs/104-scene-layer-infrastructure/spec.md)):
  `SCENE_KINDS` lists the kinds bottom first; a kind is on the scene only while the mode is `"webgl"`, WebGL is active,
  the scene has a renderer for it and every kind under it is there. A new world kind joins `SCENE_KINDS` at its depth
  and gates its 2D component with `canvasVisibility`. HUD overlays are not kinds.
- `CONFIG.canvas.scene` (`"canvas"` | `"webgl"`) is read once at startup: the 2D context's `alpha` follows it.
  Production is `"webgl"` since [spec 105](../specs/105-scene-background/spec.md) D6 (the owner's phone run of stage 2);
  `dev.html?scene=canvas` keeps the 2D-only comparison.
- The scene presents a WebGL frame only while a kind is on it (rule 22). An unchanged empty scene presented every frame
  made Chrome wait for the compositor inside the scene's render (up to 230 ms in software GL, spec 104).
- A scene kind's renderer reports whether anything visible changed, and the scene presents a frame only then (rules 13
  and 22, [spec 105](../specs/105-scene-background/spec.md)). Steps too small to see do not count (under 0.05 logical
  px or half an 8-bit opacity step, against the last drawn values): eased cameras end in many such steps.
- An animated scene effect changes at its own frame rate and presents one frame per step, nothing between steps: the
  water ([spec 106](../specs/106-scene-water/spec.md)) steps `CONFIG.canvas.water.frameRate` times a second (30). Its
  CPU part (the displacement map, ~0.15 ms) and the filtered area (the visible water only) are kept small; its cost on
  the phone is measured with the effect on and off (DevTools toggles it live).
- Scene textures come from the images `ImageAssetProvider` loaded and decoded (`decode()` during loading), through
  `SceneTextureCache` (mipmaps, uploaded when created, released with the scene). A kind lists every image it may show
  (the background: all time-of-day phases); startup uploads them under the loading screen (`prepare`), and an image
  that loads later uploads one per frame, never in the middle of play.
- The camera opens on its target: the first focus after it is placed snaps (spec 105 D7), so the scene does not
  present a frame for every step of an opening ease.
- The scene's pixel ratio follows its art (spec 105 D4): `min(canvas ratio, max(1, art pixels per drawn logical
  pixel))`. Art that would be enlarged is drawn 1:1 into a smaller backing store and the compositor scales the canvas.
- How "off" is done (stage 0): `pixi_runtime_module.js` stops `Ticker.system` and `Ticker.shared` (otherwise the
  renderer's scheduler runs its own `requestAnimationFrame` loop); `PixiSceneLayer` passes `autoStart: false`,
  `skipExtensionImports: true` (no event system, accessibility or DOM pipe), `autoDensity: false`,
  `preference: ["webgl"]` and `gcActive: false` (the scene releases its textures itself, rule 19). New Pixi features
  that need a browser extension or a ticker are registered or driven explicitly, never by turning these back on.
- The first scene render compiles Pixi's shaders: one long frame (about 90–150 ms in software GL). `PixiSceneLayer`
  renders it during init, and startup waits for `whenReady()` (spec 104 D8). A stage that adds sprites or filters
  includes them in that warm-up frame.

## Many layers and Spine-first art

The owner's art is many image layers, with almost all animation made in Spine. Cost then comes from draw calls,
overdraw and texture memory, not from game code.

16. **Batching:** consecutive sprites from the same texture (atlas page) and blend mode draw in one call. Pack the
    layers of one scene or one Spine skeleton into atlases. Each texture or blend-mode switch is a new draw call.
    Keep special blend modes (additive glow) grouped, not interleaved with normal layers.
17. **Overdraw:** every full-screen transparent layer costs a full-screen fill. Trim transparent margins in the
    export, so a layer is only as big as its visible content. Budget about 4 full-screen layers per frame on a phone;
    more needs a measurement in its spec.
18. **Static layers are cached:** a group that does not change between frames (background parts, distant parallax
    depth between offset changes) is rendered once to a texture (`cacheAsTexture` / render texture), and the frame
    draws one sprite.
19. **Texture memory:** an RGBA texture costs width × height × 4 bytes, plus a third more with mipmaps. A 2048² page
    is 16 MB with mipmaps. Keep the scene's live textures within about 150 MB on phones, load per location or screen,
    and release when it closes. Record the total of a new location or skeleton in its spec.
20. **Atlas pages:** at most 2048 px per side (4096 only with a measured reason). Size the art for its largest
    on-screen use × the pixel-ratio cap (rule 6). Mipmaps on for anything drawn smaller than its texture.
    Premultiplied alpha exported (`pma: true`) and used as exported.
21. **Spine performance:** prefer region attachments to meshes, and weighted meshes only where deformation is
    needed. Avoid clipping attachments (CPU per vertex, per frame). Keep the bone count proportional to what moves.
    Use one skeleton per independent object; many small skeletons batch only when they share an atlas page.
22. **Per-frame work only for what changes:** animation `update` runs only for visible skeletons. Off-screen or
    paused objects do not update. Nothing creates textures, filters or display objects per frame (pool and reuse).
23. **Filters are full-screen passes:** a filter on a container renders that container to a texture and back.
    Apply filters to the smallest container that needs them, never stack several on full-screen layers without a
    measurement, and prefer a Spine or atlas animation where it gives the same look.

## Units and resolution

1. Gameplay, input, layout, projection and render models use **logical (CSS) pixels**. Only `CanvasMetricsProvider`
   (game canvas) and `SpineGlSurface` (GL) touch backing pixels. Never read `canvas.width` / `canvas.height` for
   layout, input or game sizes: they are device pixels.
2. Every on-screen canvas, 2D or WebGL, has a backing store of logical size × pixel ratio
   (`CONFIG.canvas.maxPixelRatio` caps it), its CSS size set explicitly, and draws through a base transform applied
   at frame start (`Canvas2DSurface.beginFrame`, called by the render coordinator). Never put the transform into a
   pass that can be skipped. Data canvases (depth maps, debug maps) keep their data's pixel size.

## Image filtering

3. **The surface chooses the filter for each `drawImage` from that draw's scale** (spec 102): a downscale of more
   than 1.5× gets `"medium"` (bilinear with mipmaps), anything near 1:1 or enlarged gets `"low"` (bilinear).
   Renderers never set `imageSmoothingQuality` themselves; the `render-resolution` check rejects it outside
   `canvas_2d_surface.js`.
4. **Never use `imageSmoothingQuality = "high"`** for anything drawn every frame. Browsers interpret the hint
   differently, and Chromium samples enlargements bicubically. A slight enlargement looks the same with bilinear,
   but bicubic costs 4× the texture reads on every covered pixel, every frame.
5. GL textures that are drawn smaller than their size are mipmapped (`SpineScene` does it wherever the GPU can).

## Asset size

6. Runtime art is sized for its largest on-screen use × the pixel-ratio cap. Draws close to 1:1 are both the
   sharpest and the cheapest. Never draw a master into a small box: masters stay in `asset-sources/`, or stay as
   masters next to sized variants until spec 047's quality tiers exist. Fish art has one variant table
   (`src/game/presentation/fish/fish_art_variants.js`), and the check requires a tracked variant for every master.
7. Art that is enlarged on some screens (the portrait background at pixel ratio 2) is a sizing gap. Add a larger
   variant or render that layer at a lower resolution; never compensate with an expensive filter.
8. One source per derived asset path: when two modules need "the image for X" (draw and preload), compose one
   function in bootstrap and inject it into both.

## Frame budget and measurement

9. **Budget: 16.7 ms per frame at 60 FPS for everything**: game CPU, browser layout/paint of the DOM over the canvas,
   raster, and GPU composition. Our code is only the first part. A frame whose interval is far above its game CPU
   is GPU- or compositor-bound.
10. **Every rendering change is measured on a phone in both orientations, before the commit,** with the DevTools
    overlay "⚡ ПРОДУКТИВНІСТЬ" in `dev.html` ([spec 101](../specs/101-frame-profiler-overlay/spec.md)). The
    orientation changes the scale of full-screen art, and with it the filter cost and the pixel count. Record FPS,
    game CPU, "поза CPU гри" and the freeze bar in the spec. A desktop measurement alone proves nothing for phones.
11. Isolate a regression by changing one thing at a time: the Spine switch, the overlay, full screen,
    `CONFIG.canvas.maxPixelRatio`, orientation. Fix the cause the numbers point to, not the first suspect.
12. Cost grows with: pixels per full-screen layer × number of such layers × per-pixel filter work, plus copies
    between contexts (WebGL → 2D) and DOM layers over the canvas that change every frame. A new full-screen layer, a
    new per-pixel effect or a new cross-context copy needs a phone measurement in its spec.
13. Static or slow content (the background between camera moves, a future parallax layer between offset changes)
    belongs in its own layer at its own resolution, redrawn only when it changes. Per-frame redraw is fine only
    while the measured budget holds.

## Draw order

Spec 109: world-object sizes and ground-area squash use the same WaterMetric as movement and metre-grid projection;
do not add a second distance/angle scaling curve. Apply viewport camera scale once. The screen/Spine rod is excluded.
Spec 111: the location's `distanceProfile.tiltDegrees` sets the near-shore depth scale to `pixelsPerMeter * sin(angle)`.
The same metric owns the inverse and velocity Jacobian. A missing angle is 90° and preserves the previous curve.
The far distance must fit the chosen angle; do not introduce a render-only squash to bypass that constraint.
Spec 110: optional scene annotations use reusable geometry and separate cached static/moving Graphics, invalidated
only by their own model revision. Moving zones never rebuild the static metre grid. Canvas consumes the same commands
only on scene fallback. Diagnostic visibility never owns
gameplay zones or their enable flags; hiding background also hides its displaced water copy and clears black.

14. Draw order follows depth: nearer objects are drawn later. When a component gains a new picture (the rod over
    the line's start), review its order instead of inheriting it.
15. Configuration shares are named and documented as shares of the screen (`ui.rod.spine.heightRatio`), never as
    image scales.
