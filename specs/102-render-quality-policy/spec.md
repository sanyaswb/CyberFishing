# Render quality policy: image filter per draw

Owner report, 2026-10-17, measured with the overlay "⚡ ПРОДУКТИВНІСТЬ" (spec 101) on Pages 0.41.0-1b1c043:

| Orientation | FPS | Game CPU per frame | Outside game CPU | Canvas backing |
| --- | --- | --- | --- | --- |
| Portrait (Chrome tab) | 17 | 4.2 ms | 54.7 ms | 768 × 1488 @ 2× |
| Landscape (full screen) | 60 | 2.2 ms | 14.6 ms (vsync wait) | 1632 × 768 @ 2× |
| Portrait, overlay off, Spine off, full screen | 10 | 2.7 ms | 102.6 ms | 768 × 1632 @ 2× |

Switching off Spine, the overlay and the browser UI did not help; only the orientation did. The pixel counts are
equal, so redrawing the background every frame is not the cost in itself.

## Root cause

Spec 100 (D2) set `imageSmoothingQuality = "high"` for the whole canvas. The background map is 2560 × 1440 and
is scaled to the canvas height:
- portrait: 816 logical px × pixel ratio 2 = **1632 device px**, so the art is **enlarged** 1.13×;
- landscape: 384 × 2 = 768 device px, so the art is **shrunk** 0.53×.

Chromium (Skia) samples an enlarged image bicubically under `"high"` (16 texture reads per screen pixel) and a shrunk
one through mipmaps. Portrait therefore paid bicubic sampling on the full screen, every frame, twice at dusk and dawn
(base and overlay layers), which took 55–100 ms of GPU time per frame. Before spec 100 the portrait canvas had
pixel ratio 1 (816 device px): the art was shrunk, and the default filter was `"low"`.

The quality the owner asked for came from the backing store at the device pixel ratio, mipmapped Spine pages and the
display-sized fish variants. The rod and the fish are always drawn smaller than their art, and there `"high"` equals
`"medium"`. `"high"` added nothing and cost the frame rate.

## Decision

- `Canvas2DSurface.drawImage` chooses the filter for each draw from its scale, measured as source pixels against
  destination backing pixels (destination × pixel ratio):
  - a downscale over 1.5× → `"medium"` (bilinear with mipmaps): the rod's static picture and the victory fish
    (768 → ~520 px);
  - near 1:1 or enlarged → `"low"` (bilinear): the portrait background, the Spine GL copy (1:1), 3-argument draws.
  
  It is set on every draw, because `save()` / `restore()` in renderers would make a cached value wrong. `beginFrame()`
  only applies the base transform and enables smoothing.
- `"high"` is not used anywhere. Renderers never set `imageSmoothingQuality`, and the `render-resolution` check
  enforces both.
- The behaviour no longer depends on how each browser interprets the hint, because the surface asks for exactly
  bilinear or mipmapped bilinear.
- Rules and the incident went into [docs/rendering.md](../../docs/rendering.md), mandatory reading before rendering
  work, linked from DEVELOPMENT_RULES, docs/architecture.md and the local CLAUDE.md.

## Next steps (each its own spec)

1. Background variants sized for the screen. Portrait at pixel ratio 2 needs ≥ 1632 px of height, so the art is
   never enlarged (docs/rendering.md rule 7). The masters in `asset-sources/` are larger.
2. Render layers with their own resolution and redraw rate: the background (later the Spine parallax layers) apart
   from the per-frame game layer and the Spine rod.
3. Adaptive pixel ratio from measured frame time (Auto / Low / High quality, spec 047).

## Verification

- `render-resolution` check: the per-draw filter for downscale, near 1:1, enlargement, the 3-, 5- and 9-argument
  forms and the pixel ratio; `beginFrame` sets no quality; no `imageSmoothingQuality` assignment outside
  `canvas_2d_surface.js` and no `"high"` value in `src/`.
- Architecture + Quick + Full green; game-cycle baseline unchanged.
- The owner measures on the phone in both orientations through Pages (docs/rendering.md rule 10). Expected: 60 FPS
  in portrait as in landscape, with the same rod and fish quality. **Owner's phone check, 2026-10-17, Pages
  0.41.0-64a4c61, performed by the owner: "працює" (portrait performance restored).**
