# CyberFishing changelog

## v0.23.9 - Dynamic endurance movement debuff

- Added a runtime `EnduranceMovementDebuffCalculator` for phase-2 fish movement behavior.
- Routed the debuff through `FishForceSystem -> FishBehavior` before state and direction selection, using the frame-start `currentExhaustion`.
- Added radial range overrides and behavior weight multipliers without mutating `movementProfile` or `behaviorProfile`.
- Exposed endurance movement debuff progress, radial ranges and weight multipliers in debug snapshots and the STAMINA BALANCE overlay.
- Added config metadata, validation and regression coverage for the new dynamic movement debuff.

## v0.23.8 - Stamina frame recovery punishment fix

- Removed legacy recovery punishment from the new frame-based `STAMINA` path so normal stamina regen no longer mutates exhaustion or fish power.
- Changed frame-based endurance power debuff progression to sync from actual `currentExhaustion / maxEndurance`.
- Updated exhaustion duration reporting for debug/mastery timing to use configured expected endurance drain per second.
- Marked the old angle stamina recovery calculator as deprecated compatibility code.
- Added regression coverage for full stamina recovery without punishment and endurance-ratio power debuff sync.

## v0.23.7 - Stamina endurance phase split

- Split the condition model so `STAMINA` is the active control gate and `ENDURANCE` is the phase-2 fish exhaustion pool.
- Replaced angle-generated stamina recovery with passive stamina regen multiplied by line angle: centered fish recover slower, bad angles recover faster.
- Moved resisted fish effort drain from stamina into phase-2 endurance through dedicated active/passive endurance drain calculators.
- Updated `StaminaBalanceFrame`, `StaminaController`, debug snapshots and the STAMINA BALANCE overlay with phase-specific stamina/endurance metrics.
- Added new stamina/endurance config branches, metadata entries and regression coverage for regen delay, angle multipliers, endurance drain and final debuff trigger.

## v0.23.6 - Stamina passive resisted effort

- Added optional passive stamina drain from resisted fish effort against a taut line.
- Added `PassiveStaminaDrainCalculator` and integrated passive drain into `StaminaBalanceFrame` alongside active drain and angle recovery.
- Routed fish radial effort, drag blocked force, line taut state and fish behavior into the stamina frame without moving physics ownership into `StaminaController`.
- Extended STAMINA BALANCE overlay/debug with passive drain ratio, passive drain/sec, fish effort, resistance ratio, line taut ratio, behavior multiplier and total drain/sec.
- Added passive stamina config and metadata while keeping `passiveDrain.enabled` disabled by default.
- Expanded stamina balance regression checks for passive disabled, slack line, zero effort/resistance, dash/swim/rest behavior, and active+passive total drain.

## v0.23.5 - Stamina active-force balance

- Reworked STAMINA-phase drain to use applied Rod Hold force plus weighted Rod Control force instead of raw tension.
- Added active stamina drain, angle stamina recovery and immutable stamina balance frame calculators.
- Added a shared weakest tackle limit resolver for stress/break logic and stamina diagnostics, including hook and present reel components.
- Added stamina budget overflow diagnostics and a dedicated STAMINA BALANCE debug overlay.
- Updated HUD condition labels to `СТАМІНА` and `ВИСНАЖЕННЯ`.
- Added stamina balance regression coverage for active drain, angle recovery, regen-while-pulling, float rods and max-line-limit behavior.

## v0.23.4 - Reel bearing recovery and inventory runtime stats

- Added configurable reel bearing retrieve-speed bonus so bearing count increases effective reel pickup speed.
- Added reel-recovery fish slowdown, halving effective fish movement while automatic or hold reel recovery is taking back line.
- Routed reel recovery slowdown through fight physics config and debug coverage without mutating fish profile base speed.
- Updated inventory hydration so reel, line, leader and rod tooltip values use runtime display stats instead of stale base item values.
- Fixed rod cast-power tooltip to include the equipped reel bearing bonus.
- Added runtime config provider wiring for inventory display stats and regression coverage for reel speed, line length and rod cast-power tooltips.

## v0.23.3 - Tackle-relative landing slowdown

- Changed landing lift slowdown progress to use the weakest tackle load instead of the fish weight target.
- Kept small fish fast on stronger tackle by avoiding final slowdown below the configured tackle-load threshold.
- Added debug output for tackle-load landing lift progress.

## v0.23.2 - CatchZone landing lift curve

- Made catch zone victory depend on charged landing lift tension from player hold, not dynamic fish state tension.
- Changed active landing lift tension to use accumulated real-weight lift pressure while keeping water fight tension as diagnostics.
- Replaced landing lift timing multipliers with a fast-start curve whose slowdown threshold is based on tackle load.
- Exposed landing lift progress ratio, slowdown ratio, speed ratio and gain rate in debug logs.
- Added regression coverage for dynamic fight tension spikes, drag-capped landing, and light-vs-heavy landing lift timing.

## v0.23.1 - Landing shoreline offset removal

- Removed the obsolete landing shoreline offset configuration and runtime plumbing.
- Made shore landing distance use `bounds.bottom` directly as the shoreline.
- Updated landing area rendering, empty tackle landing checks and diagnostics to use the same shoreline.
- Removed stale test context fields that still passed catch-line offset values.

## v0.23.0 - Shore landing distance

- Split fight line distance from landing/catch distance.
- Kept `lineDistanceMeters` as the rod-tip-to-fish distance for line physics, tension, hold and hard-line limits.
- Added `shoreLandingDistanceMeters` as the shore-line-to-fish distance used by landing zone, landing lift and auto-catch readiness.
- Routed lastDash landing-band checks through shore distance while keeping line distance visible for diagnostics.
- Added regression coverage for fish near shore but far from the rod tip, and fish near the rod tip but outside the shore landing zone.

## v0.22.9 - Pole sector angle constraint cleanup

- Added `PoleFightSectorAngleConstraint` as the named angle-only constraint for autonomous fish movement.
- Kept `PoleFightSectorConstraint` as the radius-aware sector constraint for existing callers.
- Moved the fish movement pipeline to the dedicated angle-only sector path instead of toggling generic radius policy inline.
- Loaded the new constraint in runtime and VM regression harnesses.
- Added architecture checks to prevent reintroducing inline `enforceRadius: false` in autonomous fish movement.

## v0.22.8 - Sector angle-only fish movement

- Disabled pole fight sector radius enforcement for autonomous fish movement so tangent motion at max released-line radius can reach `LineSystem`'s radius clamp.
- Added `enforceRadius` support to pole fight sector geometry and movement frames while keeping radius enforcement enabled by default for existing callers.
- Kept `LineSystem` as the single owner of released-line radius clamping in the fish movement pipeline.
- Added fight debug fields for fish actual blocker and sector movement enforcement state.
- Added regression coverage for angle-only sector movement at max released-line radius.

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
