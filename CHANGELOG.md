# CyberFishing changelog

## v0.22.7 - Line-radius projection integration

- Fixed `LineRadialMovementSplitter` so it accepts projected motion frames with `velocityX` / `velocityY`, not only `{ x, y }`.
- Preserved `LineConstrainedFishMotionResolver` tangent output through the integrated fish movement pipeline.
- Added regression coverage for `LineConstrainedFishMotionResolver -> LineRadialMovementSplitter` tangent preservation.
- Kept pure outward boundary movement resolving to zero without reintroducing artificial tangent fallback.

## v0.22.6 - Fish line-radius projection

- Added `LineConstrainedFishMotionResolver` to remove only the forbidden radial-outward component from raw fish movement at a locked released-line radius.
- Removed the artificial `fishBoundarySteering.topEscape` boost path and deleted its active config/metadata.
- Kept existing tangent and inward fish velocity unchanged; pure outward movement at the boundary can now correctly resolve to zero movement.
- Updated fight debug output to show raw velocity, allowed velocity, radial speed, blocked radial speed, allowed tangent speed and projection reason.
- Reworked `fight-movement-constraints-check` around projection behavior and legacy reason prevention.

## v0.22.5 - Fish top-boundary lateral escape

- Added configurable top-boundary lateral escape for fish that push outward near the vertical-up released-line radius.
- Converted weak top-boundary sideways drift into a minimum tangent movement instead of visually preserving an upward blocked push.
- Kept outward radial movement blocked while boosting only the allowed left/right tangent component.
- Added `physics.fight.fishBoundarySteering.topEscape` balance parameters and metadata labels.
- Added regression coverage for weak top-boundary tangent escape.

## v0.22.4 - Rod Control center-start session guard

- Added Rod Control session state to distinguish controls that started centered from controls that merely arrived at center.
- Restricted `center_start` to the active-edge session start when the fish is already centered.
- Kept side-start Rod Control anchored to the rod target after center crossing so movement blocks as `aligned` instead of continuing sideways.
- Switched the default `physics.fight.rodControl.alignment.targetAnchorMode` to `cast_base` for gameplay testing against the cast-start rod center.
- Exposed `rodControlStartedCentered` in the fight debug overlay.
- Added Rod Control UX regression coverage for side-start center crossing.

## v0.22.3 - Rod Control anchor mode

- Added `physics.fight.rodControl.alignment.targetAnchorMode` with `current_base` and `cast_base` modes for Rod Control gameplay comparison.
- Captured an immutable cast-base rod anchor at fight start and passed it through fight context instead of letting physics read viewport state.
- Resolved the active Rod Control target anchor once in the fight physics pipeline, keeping `RodLateralControlSystem` dependent only on an injected point.
- Exposed the resolved anchor through `rodControlTargetMode` as `current_base` or `cast_base`.
- Added Rod Control UX regression coverage for injected current-base and cast-base anchors.

## v0.22.2 - Rod Control direction single source

- Removed the legacy away-direction Rod Control config path, so lateral control can only pull opposite the fish side or use an exact centered-start latch.
- Split broad `alignedThresholdPx` from `centerStartThresholdPx`, preventing near-center fish from being treated as exact center for same-side starts.
- Removed fish-driven visual aim fields from the runtime/debug bridge; rod visual movement now follows the accepted physics direction frame.
- Added Rod Control debug output for centered and center-start states.
- Added regression coverage for near-center same-side blocking and removed with-fish visual mode.

## v0.22.1 - Rod Control opposite-side only

- Rod Control X can now apply force only opposite the fish side: fish on the right allows left control, fish on the left allows right control.
- A perfectly centered fish may start Rod Control in either direction, and that initial direction is latched until the control input is released.
- Visual/actual rod offset no longer changes the physical direction eligibility, so the rod cannot be used to justify pulling toward the side where the fish already is.
- Added regression coverage for centered starts, same-side blocking and visual rod target isolation.

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
