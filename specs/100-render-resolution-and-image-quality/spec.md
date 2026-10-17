# Render resolution, draw order and image quality

Owner report, 2026-10-17, on the phone (Pages 0.41.0-059a147):
1. the fishing line is drawn above the rod;
2. the rod and other images look pixelated and blurred; "we have scale 0.5, that is two times smaller";
3. the caught fish on the victory panel looks very poor.

The owner asked for root-cause fixes as architectural decisions, documented together with the rules that prevent the
same mistakes. Status: **implemented 2026-10-17, committed and published with spec 101. Architecture 4/4, Quick 31/31,
Full 57/57 (with spec 101), game-cycle baseline unchanged (7b9baea3…). The commit includes the owner's re-encoded rod page
(same 2739 × 89 size, 78 KB). Owner's phone check (Pages) pending.**

Out of scope, noted: the DEV UI catalog's fixed 320 × 280 HUD preview canvas is not pixel-ratio aware (DEV only). The
rod export's page is still 2735 px; a pack scale of 0.5 in Spine is the owner's choice (D3).

## Root causes (verified in code, 2026-10-17)

| # | Symptom | Root cause |
| --- | --- | --- |
| R1 | Line over the rod | `GameRenderComposition`: `rod-line` (order 600) is drawn after `rod-static` (598) and `rod-spine` (599). The rod is the object nearest the camera, so a later line covers it. The order was chosen when the rod was a 3 px bar under the line's start. |
| R2 | Everything on the canvas is soft | `CanvasMetricsProvider.resizeToViewport` sets `canvas.width = innerWidth`, `canvas.height = innerHeight`. The backing store has one pixel per CSS pixel, and the canvas gets its CSS size from those attributes. A phone with `devicePixelRatio` 2.6–3 shows a third of the pixels, scaled up by the browser: background, HUD text, line, rod, victory panel. No module knew the device pixel ratio (only the House aquarium canvas handles it itself). |
| R3 | Rod pixelated, shimmering | `ui.rod.spine.heightRatio` is the rod's height **as a share of the canvas height**, not a texture scale. At 0.5 on a 390 px tall phone the rod is ~195 CSS px tall, drawn from a 2735 px region: ~14× minification (~5× even at DPR 3). The atlas page is `filter: Linear,Linear` and the scene made no mipmaps, so each screen pixel samples 4 texels of a 14× larger texture, which shows as aliasing and crawl. R2 then blurs the result. |
| R4 | Victory fish poor | The fish art is the 2752 × 2752 master size, drawn into the ~260 px image box in one `drawImage` with the default `imageSmoothingQuality` (`"low"`): heavy aliasing, then R2 blur. The rule "keep original dimensions" in DEVELOPMENT_RULES puts master-sized art into the runtime. The victory source path is derived twice, in `OutcomeRenderFrameBuilder` and `AssetPreloadCoordinator`, so a variant could not be introduced in one place. |

The game-cycle report cannot change. Rendering, input and gameplay units stay logical (CSS) pixels.

## Decisions

### D1 Units: logical pixels everywhere, backing pixels in one owner

- Game logic, input, layout, projection and every render model use **logical pixels = CSS pixels**, exactly as today.
  `InputController` reads `clientX/clientY` as canvas coordinates, and that stays correct.
- `pixelRatio = min(devicePixelRatio, CONFIG.canvas.maxPixelRatio)`. The default cap of 2 limits the 2D fill cost on
  3× phones to 4× the pixels of today, not 9×.
- **`CanvasMetricsProvider` is the only owner of the game canvas element's size.** It sets the backing store to
  `round(logical × pixelRatio)`, sets the element's CSS size to the logical size, and exposes `width` / `height`
  (logical) and `pixelRatio`. Unchanged readings write nothing (DEVELOPMENT_RULES performance rule).
- **`Canvas2DSurface` takes that resolution.** `width` / `height` are logical. `clear()` starts each frame: it
  re-applies the base transform `setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)` and the image smoothing policy, so
  a resize between frames (which resets context state) can never leave a frame unscaled. Offscreen surfaces made by
  `OffscreenCanvasFactory` keep pixel ratio 1: they hold data at their own pixel size (depth maps, debug maps).
- `GameStageLayout` reads the canvas's logical width from the metrics, not `canvas.width`.

### D2 Image smoothing policy

**Superseded by [spec 102](../102-render-quality-policy/spec.md) — this decision caused a regression.** As first
implemented, the frame start set `imageSmoothingEnabled = true` and `imageSmoothingQuality = "high"` for the whole
canvas. That made Chromium sample the enlarged portrait background bicubically every frame, and portrait phones ran at
10–17 FPS. Spec 102 chooses the filter per draw from its scale (`"medium"` for downscales over 1.5×, otherwise `"low"`)
and never uses `"high"`.

### D3 Spine at device pixels, mipmapped

- `SpineGlSurface` is sized in device pixels. `RodAnimationController` multiplies its placement and scale by the
  canvas pixel ratio and reads points back in logical pixels. `RodSpineRenderer` copies the GL canvas with an explicit
  logical destination size, so the copy is 1:1 in device pixels.
- Minification is the renderer's job, not the export's. `SpineScene` switches each atlas page to
  `MipMapLinearLinear` when the page can be mipmapped: WebGL 2, or a power-of-two page on WebGL 1. Otherwise it keeps
  the atlas filter, and that limit is reported in the DEV status. This costs one mip chain per page (+33 % texture
  memory: about 1.3 MB for the rod page).
- Export guideline (no code): a page larger than its largest on-screen size × 2 wastes memory and download. The rod's
  2735 px region is about 3× its largest use; a pack scale of 0.5 in the Spine export is the owner's choice.

### D4 Display-sized art variants, one source

- `src/game/presentation/fish/fish_art_variants.js` holds the one table of fish art variants: `thumbnail` (128 px,
  `assets/fish-thumbnails/`, unchanged) and `display` (768 px, `assets/fish-display/`). 768 = the 260 px victory box
  × the pixel-ratio cap 2, plus room for larger layouts. `fishArtVariantPath(imagePath, variant)` maps a master path
  to a variant. `fishThumbnailPath` keeps its output and now delegates to it.
- The victory image source is **one injected function** (`resolveFishDisplayImage(fish)`) composed in bootstrap and
  used by `OutcomeRenderFrameBuilder` (sprite id and path) and `AssetPreloadCoordinator` (fishing and victory
  preload). The duplicated default path is gone.
- The variants are produced by the existing tool from the tracked masters only (copied to a scratch folder first, so
  untracked owner files are never converted):
  `node utils/convert-images.js --thumbnails --input <copy of tracked assets/fish> --output assets/fish-display --size 768`.
  24 variants, 803 KB, against 4.6 MB of masters. They are tracked files, so Pages serves them. The masters stay in `assets/fish/`, because other screens still use them and
  the 047 quality tiers will replace them later.
- A check fails when a tracked fish master has no tracked display variant, or a variant is larger than its table size.

### D5 Draw order follows depth

The rod picture is drawn after the line: `rod-line` → `rod-static` → `rod-spine` → `float`. The line leaves the rod
at the tip, and the nearer rod covers the line's first pixels, as a real rod covers the line in its guides. Rectangle
mode is unchanged: the bar and the line are one component, drawn in their old order.

## Rules added (DEVELOPMENT_RULES "Rendering resolution and image quality")

1. Gameplay, input, layout and render models use logical (CSS) pixels. Only the canvas resolution owner touches
   backing pixels. Never read `canvas.width` / `canvas.height` for layout or input.
2. Every on-screen canvas (2D or WebGL) has a backing store of logical size × pixel ratio, with its CSS size set
   explicitly, and draws through a base transform re-applied at frame start. Data canvases keep their data's pixel
   size.
3. Runtime art is sized for its largest on-screen use × the pixel-ratio cap. Masters stay in `asset-sources/` (or
   stay as masters next to sized variants until 047's quality tiers exist). Never draw a master into a small box.
4. Large downscales need filtering: mipmaps for GL textures, and for 2D the per-draw `"medium"` filter of spec 102.
   The first version said `"high"` here, which was wrong; see spec 102. Never rely on the default single-step bilinear
   filter for more than about 2× minification. The current rules live in docs/rendering.md.
5. One source per derived asset path: if two modules need "the image for X", compose one function and inject it into
   both.
6. Draw order follows depth: nearer objects are drawn later. A new picture added to an existing component (the rod
   picture over the line's start) needs its order reviewed, not inherited.
7. A config share (`heightRatio`) is documented as a share of the screen. Image scale is never configured as a screen
   share.

## Verification

- `render-resolution` check: logical/backing sizes and CSS size for DPR 1/2/3 and the cap, zero writes on unchanged
  readings, base transform and smoothing at `clear()`, offscreen surfaces at ratio 1, GL surface and controller in
  device pixels with logical points, mipmap choice (WebGL 2 / power-of-two / fallback), draw order, fish art variant
  table and one source, every fish master with a tracked display variant ≤ 768 px.
- Architecture + Quick + Full green; game-cycle baseline unchanged.
- The owner checks on the phone through Pages: line under the rod, a sharp rod without shimmer, sharp HUD text and
  victory fish, and the frame rate.
