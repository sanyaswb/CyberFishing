# Rendering rules (mandatory before any rendering work)

Read this file before changing anything that draws: renderers, render passes, the canvas or its size, image assets
and their sizes, Spine, the HUD over the canvas, or the frame loop. It records what went wrong and the rules that
prevent it. [DEVELOPMENT_RULES.md](../DEVELOPMENT_RULES.md) and the local CLAUDE.md point here.

## Incidents

| Date | Symptom | Root cause | Fixed by |
| --- | --- | --- | --- |
| 2026-10-17 | On phones everything on the canvas was blurred; the rod and the victory fish were pixelated | The canvas backing store had one pixel per CSS pixel and the phone stretched it 2.6–3×. A 2735 px rod texture and 2752 px fish art were shrunk 10–14× in one bilinear step | [spec 100](../specs/100-render-resolution-and-image-quality/spec.md): backing store at the device pixel ratio (cap 2), mipmapped Spine pages, display-sized fish variants |
| 2026-10-17 | Right after spec 100, portrait phones ran at 10–17 FPS, landscape at 60. Game CPU was only 2–4 ms per frame; 55–100 ms per frame went to the GPU | Spec 100 set `imageSmoothingQuality = "high"` for the whole canvas. At pixel ratio 2 the portrait background is **enlarged** (1440 px of art over 1632 px of screen), and Chromium samples enlarged images bicubically: 16 texture reads per screen pixel, on the full screen, two layers at dusk and dawn, every frame. Landscape shrinks the same art, which uses cheap mipmaps. The quality fix itself never needed `"high"` | [spec 102](../specs/102-render-quality-policy/spec.md): filter chosen per draw by its scale |

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

14. Draw order follows depth: nearer objects are drawn later. When a component gains a new picture (the rod over
    the line's start), review its order instead of inheriting it.
15. Configuration shares are named and documented as shares of the screen (`ui.rod.spine.heightRatio`), never as
    image scales.
