# CyberFishing changelog

## v0.20.0 - Render architecture

- Replaced the legacy monolithic `Renderer` and `FishingRenderService` with focused renderers for world, casting, fishing, HUD and outcome screens.
- Added `Canvas2DSurface`, `CanvasPrimitives`, `ImageAssetProvider`, reusable render frames, render passes, `RenderOrder`, `GameRenderPipeline` and `GameRenderCoordinator`.
- Moved state rendering to reusable render intents; states no longer receive or call a concrete Canvas renderer.
- Added app-side frame builders that convert domain state into screen-ready Render Models before the render pipeline runs.
- Centralized Victory screen layout through one shared `VictoryLayoutResolver` used by both rendering and hit-testing.
- Kept pole fight sector rendering aligned with the shared physics geometry frame, including the shore opening apex and released-line radius.
- Moved image loading out of renderers and into the asset provider/preload lifecycle.
- Deleted `src/render/renderer.js` and `src/app/render.js`.
- Added render architecture checks for pass order, frame reuse, fight-area geometry, Victory layout, assets, allocation and layer boundaries.
