# CyberFishing changelog

## v0.22.0 - Render architecture P2 contracts and diagnostics

- Added `render-layer-dependency-check` to enforce render, render/core and world dependency direction with file/line/symbol diagnostics.
- Strengthened `render-allocation-check` for hot methods and added runtime allocation diagnostics for frame, buffer, pass, layout and asset request growth.
- Added `DependencyContractValidator` and composition-root validation for renderers, render passes, frame builders, asset providers and layout resolvers.
- Expanded asset lifecycle regression coverage for location resources, fishing sprites, Victory assets, request dedupe and critical/optional failure handling.
- Strengthened reusable collection encapsulation checks and wired P2 checks into the render-stage suite.

## v0.21.1 - Render architecture P1 location lifecycle

- Finalized the location lifecycle so `LocationMap` no longer receives `LocationAssetLoader` or starts async loading internally.
- Gated initial location activation behind `AssetPreloadCoordinator.preloadLocation()` and `LocationAssetLoader.load()`.
- Gated location config refresh behind loaded location resources before applying `LocationMap.refreshConfig()`.
- Made browser startup wait for the prepared runtime before starting the game loop.
- Strengthened location architecture and asset lifecycle checks to prevent regressing to map-owned loading.

## v0.21.0 - Render architecture P1 complete

- Moved location asset loading, offscreen canvas creation, depth-map reading and debug-map building out of `LocationMap`.
- Added `AssetPreloadCoordinator`, `AssetManifest` and `AssetLoadResult` for awaitable critical asset lifecycle before Victory activation.
- Introduced `RenderComponent` and `CompositeRenderer`, with world, fishing and HUD scene components registered in the composition root.
- Closed `GameRenderPipeline` pass storage behind safe pass-id APIs and duplicate pass-id validation.
- Closed `ReusableRenderList` mutable storage behind `getAt`, `getActiveUnchecked` and `forEachActive`.
- Added P1 regression checks for location architecture, asset lifecycle, composite extensibility and collection encapsulation.

## v0.20.1 - Render architecture P0 hardening

- Reused render frame, reusable render lists, geometry buffers, HUD records and layout/style scratch state across frames.
- Removed per-frame `Object.assign` object literals, style spreads, temporary dash arrays and callback iteration from render hot paths.
- Added fail-fast required presentation contract checks for fishing HUD and tension render data.
- Normalized render architecture paths so checks are stable on Windows and Linux.
- Strengthened allocation and frame-builder regression checks for render hot-path safety.

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
