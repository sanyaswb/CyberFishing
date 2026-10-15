# Smart preloader foundation and Spine preparation

Owner request, 2026-10-15: design the initial architecture of the smart preloader and begin implementing it; prepare
the integration of Spine animation (import of a ready texture atlas, building the scene); the owner will build a
loading screen with Spine animations for the initial asset loading. Optimized loading is as important as the
animation. The requirements and contracts are [spec 047](../047-smart-asset-preloader/spec.md) (plan, data model,
runtime contract); this spec is its first implementation step and fixes the decisions taken for it.

## Implemented in this step (not yet wired into the game)

Engine (`src/engine/assets`, no browser or CyberFishing knowledge, timers injected):

| Module | Responsibility |
| --- | --- |
| `AssetCatalog` | Immutable catalog snapshot (`schemaVersion` 1, `revision`): stable asset IDs, kinds (`visual-image`, `data-image`, `binary`, `json`, `text`, `bundle`), tiered variants (`l`, `m`, `h`, `legacy`) with project-relative URLs, atomic groups, exact legacy aliases, static fallbacks and bundle dependencies. Rejects duplicates, absolute/parent/scheme URLs, unknown tiers, alias/group/fallback/dependency errors and cycles. A `data-image` (depth map) accepts only its exact legacy variant. |
| `AssetVariantSelector` | Pure tier/format choice. Minimum: a ready variant the mode allows (the best one) or the cheapest `l → legacy → m → h`; Low mode only `l → legacy`. Target: High with permission (or High mode), else Middle, else the minimum. Formats in the injected preference order; unsupported formats never. |
| `AssetLoadQueue` | One job per resource key shared by every consumer; classes `blocking > interactive > upgrade > prefetch`, FIFO inside a class; network cap (4) and speculative cap (1); promotion without duplicates; per-consumer release (a queued job without consumers never starts, a running one is marked cancelled and keeps its slot until it settles, a new consumer revives it); speculative work can be paused (hidden tab, offline, save-data, Low); bounded retry (2 attempts, 500 ms) through an injected scheduler. Results resolve with `ready`, `failed` or `cancelled`, never reject. |
| `StartupLoadProgress` | Startup progress over a fixed set of required IDs: the denominator is captured once, optional work never moves it, ready and failed are separate, no invented byte totals. The loading screen subscribes to its snapshots. |

Platform (`src/platform/browser/animation`):

- `spine_runtime_module.js`: the one Spine runtime entry, checked in as a stub (`createSpineRuntime()` returns
  `null`). A prepared runtime replaces this file with the same named export.
- `SpineRuntimeProvider`: imports that entry once, on first need, and always resolves
  `{ available, runtime, reason }` (`not-installed`, `import-failed`, `factory-failed`, `version-mismatch` against the
  required editor line such as `4.2`). A missing or broken runtime never breaks a scene; it keeps the static fallback.

Check: `asset-preloader` (Quick). Production modules and the game-cycle report are unchanged; nothing in the
running game uses these modules yet.

## Target architecture

```text
index.html  ── first paint: loading screen markup + CSS (poster, progress), no module needed
   └ game.entry.js → bootstrap/production
        asset_composition.js   catalog (generated, config) + queue + selector + store + browser transport/decoder
        GameAssetPreloadFacade preloadApplicationAssets / preloadLocation / preloadFishingAssets / preloadVictoryAssets
                               (the current AssetPreloadCoordinator API, now over the queue; same AssetLoadResult)
        StartupLoaderView      presentation: binds StartupLoadProgress to the screen; hosts the animation surface
        SpineRuntimeProvider   optional, requested after the minimum barrier; loader bundle through the same queue
```

Startup sequence:

1. The page paints the loading screen from HTML/CSS (poster + empty progress) before any module runs.
2. Bootstrap composes the catalog, queue and progress; the facade requests the minimum group of the first scene
   (today: the test location's three time-of-day backgrounds at `l`/`legacy` and the exact depth map) as `blocking`.
3. After the minimum barrier is reachable, the loader animation is an optional `interactive` demand: the Spine runtime
   import, then the skeleton, atlas text and atlas pages, each its own queue job. Ready → the animation replaces the
   poster; unavailable or failed → the poster stays. It never delays the game's readiness.
4. Minimum ready → the game starts behind the screen; the screen fades out, disposes its animation (textures, GL
   context) and is removed. Upgrades (`upgrade`) and prefetch (`prefetch`) start only now, one at a time.

### Importing a ready texture atlas into a Spine scene

Spine's own `AssetManager` would issue its own uncapped requests, so the platform adapter builds the scene from
resources the queue already loaded:

1. Queue: `*.atlas` (text) and the skeleton (`*.skel` binary, or `*.json` while authoring).
2. Parse the atlas text (`TextureAtlas`); every page name becomes its own queue job (image decode in the preparation
   lane); then each page gets its texture (`GLTexture` over the decoded image) on the loader's WebGL surface.
3. `AtlasAttachmentLoader` over the atlas → `SkeletonBinary`/`SkeletonJson` → `SkeletonData` → `Skeleton` and
   `AnimationState`; the scene object exposes `applyState(snapshot)`, `update(dt)`, `render(transform)`, `dispose()`.
4. The game's single loop drives `update(dt)` (no second requestAnimationFrame loop); hidden screen or reduced motion
   stop updates; context loss falls back to the poster.

Catalog entries: the bundle is a `bundle` asset with `dependencies` (skeleton, atlas, pages) and a `fallbackId` to its
static poster. Atlas pages are converted only together with their atlas (an `atlas-bundle` policy in spec 047); the
image converter never rewrites a page alone.

## Next steps (each its own spec and commit)

1. Store and facade: `AssetResourceStore` (leases, pinning, eviction under the soft budget), browser image transport
   and decoder, `GameAssetPreloadFacade` replacing `AssetPreloadCoordinator` with identical results; a catalog
   generated from the current assets (legacy tier only) so behavior and the game-cycle report stay the same.
2. Loading screen: markup/CSS in `index.html`, `StartupLoaderView`, progress from `StartupLoadProgress`, fade-out and
   disposal after the minimum barrier.
3. Spine: pinned runtime build behind `spine_runtime_module.js`, the platform adapter (atlas import above, WebGL surface,
   context loss), one real exported fixture, then the owner's loader animation.
4. Quality: `l`/`h` variants from the masters in `asset-sources/` (converter profiles), Auto/Low/High, upgrades after
   the barrier, diagnostics in DEV.

## Owner decisions needed

1. Loading screen form. Recommended: a layer of `index.html` shown from first paint and removed when the game is
   ready. A separate HTML page would navigate after loading, so decoded images and the module graph would be
   loaded again; the layer keeps one page, one entry module and the Pages release paths.
2. Spine editor version and export: the runtime must match the editor's major.minor (4.2 assumed); binary `.skel`
   for releases (smaller, faster) and JSON while authoring; atlas pages with premultiplied alpha or not (the
   renderer must match). The Spine Runtimes license requires a Spine Editor license for the project.
3. The loader's static poster (the fallback when Spine is unavailable) and which art stays visible while it fades.
4. Minimum set for the first scene: all three time-of-day backgrounds (current blending and DEV time jumps keep
   working) or only the current phase plus a lookahead (fewer bytes, needs a policy for fast time scales).

## Verification

`asset-preloader` check: catalog validation and immutability, aliases, protected data images, tier/format choice and
Low mode, caps, priority and FIFO, promotion, release/revival, speculative pause, retry and failure, dispose,
progress denominator and events, Spine provider outcomes (stub, import failure, factory failure, version line).
Architecture, Quick, Full; the game-cycle report is unchanged.
