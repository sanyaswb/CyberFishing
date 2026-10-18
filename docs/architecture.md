# CyberFishing architecture

Native ES modules, no build step. `index.html` loads `src/entrypoints/game.entry.js`; `dev.html` loads
`src/entrypoints/dev.entry.js`. Each page has exactly one module script.

```text
ENTRYPOINT → BOOTSTRAP (composition) → ENGINE / GAME / PLATFORM
DEV → production layers (never the reverse)
```

## Layers

| Layer | Path | May import | Responsibility |
| --- | --- | --- | --- |
| engine | `src/engine/` | engine | Reusable mechanisms (math, events, rendering primitives, assets, DI); no CyberFishing or browser knowledge. |
| game/config/raw | `src/game/config/raw/` | nothing | Authored data without behavior. |
| game/config | `src/game/config/` | config, raw, domain, engine | Configuration factories and catalogs. |
| game/domain | `src/game/domain/` | domain, engine | Gameplay rules, entities, policies, value objects, save-format constants. |
| game/application | `src/game/application/` | application, domain, config, engine | Use cases and orchestration. |
| game/presentation | `src/game/presentation/` | presentation, application, domain, engine | Rendering, UI, HUD and read models. |
| platform | `src/platform/` | platform, engine | Browser implementations: DOM, Canvas, storage, audio, input, timers. |
| dev | `src/dev/` | dev and every production layer | Overlay, GodMode, Fixed Catch, diagnostics and balance tools. |
| bootstrap/production | `src/bootstrap/production/` | production layers | The only place that composes concrete production implementations. |
| bootstrap/development | `src/bootstrap/development/` | everything above | Extends production composition with DEV tools. |
| entrypoints | `src/entrypoints/` | its own bootstrap | Starts the page. |

Only `platform` and `dev` may reference browser/host globals (`window`, `document`, `localStorage`,
`console`, timers, …); every other layer uses ECMAScript built-ins only and receives host services by
injection. Runtime configuration has one frozen base and one override store, composed in bootstrap.
Gameplay reads GodMode and debug switches only through the injected DEV flag port (`isEnabled`, `godModeValue`,
`isDebugEnabled`): production composes `InactiveDevFlags` (all off whatever the configuration says), DEV composes
`dev/runtime/DevFlagsProvider` over `GameplayOverrideReader` and switches GodMode on for balance testing. Fixed Catch exists only in DEV: Development startup composes `FixedCatchHook` as
the optional hooked-fish override of the waiting state, and production composes none. The full fight diagnostics
snapshot is likewise composed only for DEV (`createFightDiagnosticsBuilder` → `dev/fishing/FightDiagnosticsSnapshotBuilder`);
gameplay, HUD and render read the fight frame.

Water distances come from one `WaterMetric` per location (`GameWorld.getWaterMetric()`, built by
`LocationWaterMetricResolver` from the castable bounds and `MAP_DB.<id>.distanceProfile`). Casting converts its base
pixels (ground metres × pixelsPerMeter) through it. `GroundPlaneScope` runs a tackle update on the metric's ground
plane (the tackle's vectors are converted in place and back): `FishingForceService` wraps the fight step in it and
the waiting and biting states wrap the tackle update, so every stage measures ground metres. A uniform metric
converts nothing.

`FightPhysicsOrchestrator` runs one fight step in `FightPhysicsPipeline` order and writes the fight frame. It owns
the shared per-session helpers (pull motion smoother, recoverable line calculator, reel-recovery fish slowdown) and
builds one object per pipeline stage for the session:
- `FightPlayerPressureStage`: force budget, pressure gain, tension build rate, pressure/reel fatigue;
- `FightFishMotionStage`: line-constrained fish motion;
- `FightRodMovementStage`: rod pull, lateral rod control, stroke distance, movement within water and bounds;
- `FightLineRecoveryStage`: line and stroke credit, reel-hold recovery, hard line limit;
- `FightLandingTensionStage`: final tension, landing lift, landing frame;
- `FightStaminaFrameBuilder`: stamina frame;
- shared by the stages: `FightLineConstraint` and `FightPoleSector`.

Bootstrap only composes. The running game session is `game/application/session/GameApplication` (state machine,
update/draw order, casting and chum flow, inventory reactions). Its debug events and diagnostics are injected ports:
production composes `InactiveDebugEvents` and `InactiveGameDiagnostics`, DEV composes `dev/runtime/BrowserDebugAdapter`
and `GameDebugFacade` (the `config-updated` subscription stays session lifecycle). `GameFishingFacade` lives in
`game/application/fishing` and `GameViewportFacade` (bounds, rod position, rod visual offset) in
`game/presentation/viewport`. `GameCompositionRoot` builds them and injects the clock, fish database and viewport facade.

Styles live in `src/game/presentation/styles/`; DEV metric/parameter descriptions in `src/dev/metadata/`.

## Inventory

`bootstrap/production/player_inventory_composition.js` composes the player's inventory once per page:

- Without its own save (`fishing_game_player_inventory_v2`, schema 4, or a previous schema) the inventory starts
  in one of two ways. A new player gets the configured starting items directly in the current format
  (`StartingInventorySnapshotFactory`; starting equipment and build templates are rejected). A player with the
  classic save keys (`player_inventory`, `player_equipment`) goes through `LegacyInventorySaveSource`, which
  migrates and seeds them, and then `InventoryLegacyMigration`. The legacy source is read only in that case.
- `InventoryCompositionRoot` builds the repository, assemblies, equipment state, loadouts, transactions and:
  `InventoryCommandService` (player actions from the UI), `InventoryUiState` (navigation state),
  `InventoryGameplayCommands` (consumption, line breaks, auto-refill), `InventoryItemRemovalService`,
  `InventoryGameplayBridge` (read models and readiness for gameplay) and `InventoryFacade` (view model + dispatch).
- `PlayerInventory` is what the game uses: lock while tackle is in the water, cached equipment with the rod's cast
  display stats (`RodCastDisplayStatsWriter`, labels from presentation), tackle load limit (`TackleLoadLimitPolicy`),
  change events, consumption and gameplay events.

## Guard

`utils/architecture-check.js` (Quick and Architecture suites) parses every `src/**/*.js` module and fails on:

- an import not allowed by the table above, a non-relative or extensionless specifier, an unresolved
  import or a non-literal dynamic import;
- an import cycle;
- a production module (reachable from `game.entry.js`) in `dev` or `bootstrap/development`;
- a host global outside `platform`/`dev`;
- a page that does not load exactly its one module entry;
- a module exporting more than one class, a module not named after its class (`snake_case(Class).js`), or a
  class named `*Manager`, `*Util(s)` or `*Helper(s)`;
- a Cyrillic string or template literal in `engine`, `game/domain`, `game/application`, `platform` or `bootstrap`,
  except arguments of `console.*`/logger calls (diagnostics) and the save-format names in
  `game/domain/loadouts/persisted_loadout_names.js`. Player-facing text lives in presentation catalogs
  (`INVENTORY_MESSAGES`, `FISHING_MESSAGES`, `HUD_LABELS`, …) injected through constructors by bootstrap.

It reports the production and DEV graph sizes and runs its own negative fixtures first.

## Presentation styles

Native HTML pages are the CSS composition roots. `index.html` loads 22 production stylesheets;
`dev.html` reuses the exact ordered prefix and appends three DEV stylesheets. Shared DOM tokens,
inventory theme, reusable BEM blocks and component rules have distinct owners. Responsive and
reduced-motion rules live beside the affected component. Static HUD and DEV appearance is CSS;
browser adapters supply dynamic values and presentation state classes. Domain/Application do not
know CSS, and Canvas configuration retains its existing injected owners.

[Presentation styles](styles.md) documents ownership, BEM conventions, validation and the decision
to keep native CSS until SCSS compilation is justified. The read-only page stylesheet reader checks
the actual HTML composition. The usage guard also enforces BEM, visible focus/font rules and absence
of static style injection, without weakening architecture or behavior checks.

## Checks

```text
npm run check                 all checks (syntax, architecture guard, behavior tests)
npm run check:quick           fast subset
npm run check:gameplay        fishing and game-cycle systems
npm run check:inventory       inventory systems (also :items, :tools)
node utils/run-checks.js --check game-cycle
```

`game-cycle` is the end-to-end regression. It composes casting and fights through the production
`bootstrap/production/fishing_services_composition.js` and compares its report with
`utils/testing/baselines/game-cycle.txt`. A refactor that preserves behavior leaves that file unchanged. A gameplay
change that changes the report re-baselines it (`npm run baseline:game-cycle`) in the same commit.

## Screens

One page, several screens (spec 084). `engine/screens/ScreenHost` keeps one active screen above the base game:
opening suspends the game loop, a lazy factory creates the screen, closing disposes it and resumes the game. The House
is such a screen: `bootstrap/production/house_screen_composition.js` mounts `HOUSE_SCREEN_MARKUP` into the page's UI
surface and composes the House over the session's live bait service and game clock
(`GameCompositionRoot.getSessionServices()`), so no second config runtime, clock or storage owner exists. Today DEV
opens it (DevTools → House, `dev.html?screen=house`); the future lobby composes the same function in production.

## Assets and preloading

Today `AssetPreloadCoordinator` (platform) preloads location backgrounds, the depth map and fish sprites through
`ImageAssetProvider` and returns `AssetLoadResult`. The smart preloader ([spec 047](../specs/047-smart-asset-preloader/spec.md),
first step [spec 083](../specs/083-preloader-foundation/spec.md)) replaces it in steps: `engine/assets` holds the
immutable `AssetCatalog`, the pure `AssetVariantSelector`, the shared priority `AssetLoadQueue` and
`StartupLoadProgress`; the browser transport (`platform/browser/assets/browser_asset_transport.js`) and the optional
Spine capability stay in platform. Until the facade step these engine modules are exercised only by checks. Raster
art is WebP under `assets/`; image masters live in `asset-sources/` and are never published
([spec 082](../specs/082-webp-art/spec.md)).

Render resolution ([spec 100](../specs/100-render-resolution-and-image-quality/spec.md)): the game works in logical
(CSS) pixels. `CanvasMetricsProvider` (platform) is the only owner of the game canvas element's size: its backing store
is logical × `min(devicePixelRatio, CONFIG.canvas.maxPixelRatio)` and its CSS size the logical size. `Canvas2DSurface`
reports logical sizes; `beginFrame()`, called by `GameRenderCoordinator` before each frame, applies the base
transform, and `drawImage` chooses the image filter from each draw's scale (spec 102: `"medium"` for downscales over
1.5×, otherwise `"low"`, never `"high"`). Offscreen data surfaces keep ratio 1. Rules:
[docs/rendering.md](rendering.md) (mandatory before rendering work). Fish art comes in sized variants
(`game/presentation/fish/fish_art_variants.js`: thumbnail 128, display 768). The victory image source
`fishDisplayImagePath` is injected into both `OutcomeRenderFrameBuilder` and `AssetPreloadCoordinator`.

Spine ([spec 099](../specs/099-spine-rod-animation/spec.md)): `engine/animation` holds the scene port method list
(`SKELETAL_SCENE_METHODS`) and `ScalarSmoother`. `platform/browser/animation` holds `SpineRuntimeProvider` (lazy
import, version line), `spine_runtime_module.js` (the only importer of the pinned runtime), `SpineScene` (the only
user of the Spine API), `SpineBundleLoader` (atlas, pages and skeleton through `AssetLoadQueue`), `SpineAtlasTextReader`
and `SpineGlSurface` (offscreen WebGL canvas composited into the 2D game). Third-party code lives in `vendor/` and is
pinned by `vendor/manifest.json`. `utils/vendor-libraries.js` writes every entry from the exact npm devDependencies
(`--check` compares). The architecture check verifies each vendor file's SHA-256, that it has no imports and that only
its one named importer imports it. The rod (presentation, `game/presentation/fishing`): `RodAnimationStateResolver` (pure pose choice) and
`RodAnimationController` (modes rectangle → static → spine, the `RodAnchorFrame` whose tip starts the line) are
advanced by `FishingEquipmentRenderModelBuilder.prepareRod` while the fishing frame is built. `RodStaticRenderer`,
`RodSpineRenderer` and `RodLineRenderer` draw from the frame model. `bootstrap/production/rod_animation_composition.js`
wires them for the session. `SpineSetupPoseReader` (platform) gives the static picture without the runtime. DEV:
`SpineRodDevSection` (DevTools "SPINE ВУДКА") uses only the controller's DEV port: Spine on/off, clip switches, live
bone setup edits and the export of the edited skeleton JSON.

WebGL scene layer ([spec 103](../specs/103-webgl-scene-layer/spec.md); stages 0 and 1, the latter in
[spec 104](../specs/104-scene-layer-infrastructure/spec.md)): `engine/scene` holds the port (`SCENE_LAYER_METHODS`:
`render(frame)`, `isActive()`, `whenReady()`, the DEV `getStatus`/`loseContext`/`restoreContext`, `dispose()`),
`InactiveSceneLayer` and `DeferredSceneLayer` (the port at composition time while the runtime loads lazily).
`bootstrap/production/scene_layer_composition.js` composes it from `CONFIG.canvas.scene` (`"canvas"` by default:
inactive layer, opaque 2D canvas, no Pixi download; `"webgl"`: lazy Pixi layer, transparent 2D canvas); DEV overrides
the mode with `dev.html?scene=`. `game/presentation/rendering/SceneLayerRouter` decides once per frame which layer draws
each world kind (`SCENE_KINDS`, bottom first): a kind is on the scene only while WebGL is active, the scene has a
renderer for it and every kind under it is there; otherwise its 2D component draws (`canvasVisibility`), so a lost
context falls back to the 2D canvas. `GameRenderCoordinator` updates the router, renders the scene in the probe's
`scene` section only while a kind is on it, then starts the 2D frame (cleared only when the background is on the scene)
and runs the 2D passes. `platform/browser/scene/pixi_runtime_module.js` is the only importer of the vendored Pixi 8 +
spine-pixi-v8 esbuild bundle (`vendor/pixi/8.22.0/pixi-scene.js`) and keeps Pixi's tickers stopped. `PixiSceneLayer`
puts an Application on a `game-shell__scene` canvas right before the game canvas (without ticker, event system,
browser extensions, auto density or GC, sized from `CanvasMetricsProvider`) and renders a warm-up frame during loading;
startup waits for it. Stage 2 ([spec 105](../specs/105-scene-background/spec.md)): the scene draws the `background`
kind (`PixiBackgroundRenderer`: the world model's time-of-day layers as two pooled sprites) from `SceneTextureCache`
textures of the images the page's `ImageAssetProvider` loaded, presents a frame only when the background changed, and
sets its pixel ratio from the art. DEV: DevTools "🖼️ СЦЕНА WebGL" (`dev/tools/SceneLayerDevSection`). Rules:
[docs/rendering.md](rendering.md).

## Migration history

The classic-script → ESM migration (Stages 1–7.1) and all of its records, evidence, Manifest and
tooling are archived at annotated Git tags; `develop` keeps only the game, its DEV tools and its tests.

- `migration-final-archive` — the complete migration apparatus at v0.27.2 + Stage 7.1 preparations
  (64-check catalog). Reproduce with `git worktree add <dir> migration-final-archive`, `npm ci`, `npm run check`.
- Earlier recovery tags: `stage3-evidence-archive`, `stage6-classic-runtime-archive`,
  `stage7-compat-tools-archive` and the other `*-archive` tags.
