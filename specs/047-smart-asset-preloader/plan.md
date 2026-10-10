# Implementation Plan: Smart Asset Preloader та DEV Asset Pipeline

**Branch**: `develop` | **Date**: 2026-10-10 | **Spec**: [spec.md](spec.md)

**Input**: `specs/047-smart-asset-preloader/spec.md` та перевірений аудит native ESM клієнта.
**Статус**: проєктування до реалізації; перелічені target modules ще не створено.

## Summary

Кероване завантаження спочатку готує поточний екран із Low-зображеннями, потім дозволені
покращення якості й обмежений prefetch. Engine володіє універсальною чергою, variant selection
і resource lifetime; game/application визначає потреби гри; platform реалізує browser loading.
Локальний DEV workflow інвентаризує файли, створює варіанти з masters і публікує каталог.
Spine — optional capability після export/runtime/packaging spike, зі статичною заміною.
Зараз старт очікує day/evening/night і depth: це три часові фони, а не просторові шари.
Перша інтеграція готує всі три Low-фони та незмінну depth map. Майбутнє лоббі описується
групами ресурсів; його UI, gameplay прогресія та система unlock у цю зміну не входять.

## Technical Context

**Language/Version**: JavaScript native ESM із explicit `.js` imports; наявні Node/CommonJS tools.
Node: `^20.19.0 || ^22.13.0 || >=24.0.0`; npm: `>=10.8.2`, згідно `package.json`.
**Primary Dependencies**: існуючі `AssetManifest`, `AssetLoadResult`, Canvas2D/browser adapters;
Sharp у `devDependencies`, завантажується ліниво. Кандидат Spine — офіційний `spine-webgl` 4.2,
exact pin визначає spike. Клієнтський framework або загальний build-step не додається.
**Storage**: `asset-pipeline/catalog.json` та `profiles.json` — authoring metadata;
`asset-sources/` — masters; `assets/variants/` — immutable runtime generations;
generated named export у `src/game/config/assets/generated_asset_catalog.js` ін'єктується bootstrap.
Local saves, ключі/JSON/migration незмінні; asset quality не є gameplay прогресом.
**Testing**: fake transport/clock focused checks; Architecture, Quick, Full; browser/Pages checks.
**Target Platform**: browser Canvas2D; optional Spine на окремій WebGL surface;
локальний Node DEV server для inventory/setup/conversion, без нового gameplay backend.
**Project Type**: розширення існуючої гри й локальних інструментів.
**Performance Goals**: Low readiness має перевагу; requests/decode/cache accounting обмежені;
нуль asset requests із frame render. Вимірюються cold/warm-cache bytes до usable screen,
час готовності Low, decode stalls та resource estimates, без недоведених hardware FPS/секунд.
**Constraints**: production не залежить від DEV; engine не знає fish/location/level;
Domain/Application не читають browser globals/raw config. Формули, save, timing, RNG identity,
API та victory failure semantics незмінні; architecture/release guards не послаблюються.
**Scale/Scope**: 16 поточних image assets і один sound; extensible catalog, пагінація DEV inventory.
Runtime не сканує filesystem; lobby/unlock/caught-fish history ще не мають authoritative owners.

### Runtime policy та стартові limits

- Ін'єктовані defaults: 4 network slots, максимум 1 speculative request, 1 decode job; окремі fetch/prepare lanes. Encoded backlog: 4 reservations і 16 MiB, з backpressure; critical oversize serialized і diagnosed.
- Soft residency budget: 96 MiB decoded/texture estimates; це не точний browser RAM/VRAM cap.
- Timeout 15 секунд на attempt; максимум 1 retry після 500 ms через injected scheduler.
- Demand deadline 60 секунд включає queue wait/fallback; навіть завислий physical slot не залишає consumer у нескінченному pending.
- Active pinned resources не evict; overflow діагностується, speculative candidates не запускаються.
- Candidate резервує old+new overlap і texture copies; encoded bytes рахуються окремо.
- Priority: required minimum → explicit transition → active-scene upgrade → eligible prefetch.
- Stable order у priority; foreground підвищує queued request без дублювання.
- Shared request живе, доки є consumers; скасування scope не скасовує інших consumers.
- Fetch cancellation — best effort; decode/upload/import completion відсікається generation-token.
- Hidden/offline/save-data зупиняють нову speculative роботу; required demand має окремий шлях.
- Upgrades поновлюються після 5 секунд стабільно дозволених умов; cooldown рішень — 15 секунд.
- V1 не адаптує якість за FPS; за відсутності browser hints діють conservative defaults.

`Auto` починає з Low і допускає High за budget/умов; Mid необов'язковий.
`Low` встановлює download ceiling без m/h requests; missing Low використовує дозволений legacy single-tier/placeholder. При перемиканні активний higher тимчасово лишається до готовності l; новий Low consumer не завантажує higher.
`High` є кінцевою ціллю, не startup gate: Low лишається minimum, а High — неблокуюче покращення.
Missing/corrupt High зберігає usable lower tier; critical failure виникає лише без usable fallback.

## Constitution Check

**До research і після design: PASS за описаними межами; винятків із constitution не потрібно.**

| Принцип | Рішення / перевірка |
|---|---|
| I. SRP | Queue, selector, store і orchestration мають конкретні незалежні responsibilities. |
| II. Dependency direction | Engine generic; game demand через ports; browser у platform; concrete wiring bootstrap. |
| III. State ownership | Queue володіє jobs; store — handles; policy читає gameplay owners без дублювання прогресу. |
| IV. Behavior/performance | Stable IDs, exact depth, time blending, failure/save semantics; update окремо від render. |
| V. Evidence/checks | Consumers перевірено; focused + Architecture + Quick + Full + browser/release. |
| DEV/backend | Local conversion optional; gameplay backend і masters поза production graph/release. |

Перед кодом узгоджуються metadata/port contracts, compatibility mapping та injected defaults.
Spine production gate: real export fixture, version/license і reproducible packaging підтверджені.
Непідтверджений gate залишає unavailable stub і не блокує image preloader.

## Project Structure

### Documentation (this feature)

```text
specs/047-smart-asset-preloader/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
```

`tasks.md` — наступний окремий крок Spec Kit; planning workflow його не створює.

### Source Code (repository root; planned)

```text
asset-pipeline/                         # catalog.json, profiles.json
asset-sources/                          # Masters outside Pages assets
assets/variants/<source-folder>/
└── generation-<hash>/<stem>--l.webp      # Also --m/--h when declared
src/engine/assets/
├── asset_catalog.js                     # Immutable lookup/validation
├── asset_load_queue.js                  # Dispatch/priority/concurrency/retry
├── asset_variant_selector.js            # Pure tier/fallback selection
├── asset_resource_store.js              # Handles/leases/residency/eviction
├── smart_asset_preloader.js             # Demand/group readiness orchestration
├── asset_manifest.js                    # Existing records
└── asset_load_result.js                 # Existing result semantics
src/engine/animation/animation_contract.js
src/game/application/assets/
├── game_asset_demand_policy.js          # Needs from injected snapshots
└── game_asset_preload_facade.js         # Preserve existing preload API
src/game/config/assets/generated_asset_catalog.js # Generated named export; bootstrap read
src/game/presentation/assets/scene_asset_binding.js
src/game/presentation/animation/spine_scene_renderer.js
src/platform/browser/assets/
├── browser_asset_transport.js           # Fetch/abort via ports
├── browser_image_decoder.js             # Decode/lifetime adapter
└── image_asset_provider.js              # Existing tryGet; data aliases
src/platform/browser/animation/
├── spine_runtime_provider.js            # Cached lazy capability Promise
├── spine_runtime_module.js              # Checked-in stub or local factory ESM
└── spine_animation_adapter.js           # Surface/runtime/texture lifecycle
src/bootstrap/production/asset_composition.js
src/bootstrap/development/               # DEV wiring only
src/dev/assets/                         # Catalog/job UI; bounded diagnostics
utils/image-tools/                       # Inventory/converter/setup/jobs/publish
└── runtime/                             # Isolated pinned optional encoder package/lockfile
utils/convert-images.js                  # Existing CLI entry preserved
utils/dev-server.js                      # Opt-in guarded asset-tool routes
```

**Structure Decision**: розширюються існуючі шари без catch-all AssetManager.
Generated catalog та JSON — стадії однієї authority, не два writable catalogs.
Entities/ports деталізує [data-model.md](data-model.md) та `contracts/`.

### Compatibility та quality activation

Facade зберігає `preloadApplicationAssets`, `preloadLocation`, `preloadFishingAssets`,
`preloadVictoryAssets` і `AssetLoadResult` outcomes; fish/location policy виходить із platform.
Старі source-derived IDs і `fish.imagePath` приймаються через data aliases → logical IDs.
Aliases не створюють окремі handles/globals/engine business rules; original legacy URL є fallback.
Runtime не вгадує шлях заміною `--l`/`--h`. Dedup key враховує source/version/type, не alias.
Current location: `player.locationId` → `locations.currentLocationId` → перший map key.
Не створюється first-run/unlock/history state. Prefetch eligibility читає injected snapshot port;
без такого owner достатньо current scene/fish і явно відкритих UI demands.
Future lobby має ready-minimum/static-poster contracts без реалізації його екрана.
Low readiness локації: три часові фони, exact depth і наявні required resources.
Depth — data-image: без resize/lossy/color rewrite; red-channel samples незмінні.
Scene binding активує candidate після readiness всіх членів visual group на межі кадру.
Swap не викликає `LocationMap.refreshConfig`, не перебудовує grid/zones і не змінює RNG/clock.
Victory допускає ready Low; без усіх fallback зберігається `failed/asset_load_failed`.
Location-config reload commit — після readiness; failed reload зберігає попередню usable group.

### DEV conversion і immutable publication

Inventory показує real relative folder/name, dimensions, format, bytes, kind, variants/status.
Дерево не перейменовується масово; output повторює source-folder під `assets/variants/`.
Entry явно задає master/output stem; basename collision потребує явного resolution.
`--l`/`--m`/`--h` — metadata output tags, не gameplay ознаки та не frame-loop lookup.
Profiles розділяють resize/pixel scale та encoder quality; outputs не стають новими masters.
UI plan підтримує validated tier overrides, а saved presets і role registration редагуються в authoring JSON.
Current legacy WebP може явно дати l/m; h повторно використовує незмінний baseline без recovery claims.
Job створює і валідовує immutable `generation-<hash>`, потім publishes generated catalog last.
Failed/cancelled job не перемикає manifest; старі generations незмінні, originals не видаляються.
Generated catalog/artifacts мають бути committed для чинного Pages builder.
Runtime підхоплює explicit mapping наступного startup/release; DEV inventory refresh автоматичний,
а runtime adoption лише explicit Apply до isolated decorative preview, без gameplay reload і filesystem scan.
Catalog/list UI доступні без Sharp/Spine. Dependency button викликає fixed allowlisted local
setup із isolated tool lockfile після reuse сумісного root Sharp;
клієнт не передає довільні command/package/path. Root package/lockfile не змінюються.
Optional require/import не виконується eager у game/server startup; tool failure має окремий status.
Dev server лишається GET/HEAD static server до явного opt-in flag для tool routes.
Routes local/same-origin: origin/token, canonical paths у дозволених roots та job limits.
Spine atlas pages інвентаризуються; generic converter не змінює їх незалежно від atlas.

### Optional Spine integration

Provider робить literal relative lazy import `spine_runtime_module.js`, завжди checked-in.
Module — unavailable stub або reproducible pinned self-hosted ESM із named factory-export;
немає `window.spine`, bare/CDN imports чи ignore/whitelist для architecture checks.
Окрема injected WebGL surface зберігає Canvas2D; update використовує native loop dt.
Adapter не має другого gameplay loop; reduced-motion/library failure/context loss лишають poster/UI.
Authoring 4.2 — кандидат: export/runtime compatibility, meshes/clipping/tint/PMA і license перевіряє spike.
Atlas/skeleton/pages — узгоджений bundle; всі fetch/decode керує engine queue.
Native atlas loader не запускає власні некеровані page requests.
На real fixture перевіряються playback/skin continuity, events, GPU upload/context restore,
shared texture disposal; image lifetime включає активні textures, які можуть потребувати re-upload.

### Послідовність реалізації та перевірки

1. Catalog/aliases, queue/store/selectors і facade: APIs, exact depth та existing consumers.
2. DEV inventory/converter/setup/publish: optional backend, generations, collision validation.
3. Quality/diagnostics: Low/Auto/High, limits, pin/evict, atomic swap та baseline measurements.
4. Spine spike/stub/bundle/provider/adapter: packaging, real export, fallback і context lifecycle.
5. Closure: прибрати старий coordinator та redundant preload paths після міграції consumers;
   aliases лишити лише для перевірених source-ID consumers із явним retirement criterion.

Focused: promotion/caps, shared cancellation, stale completion, retry/timeout, upgrade failure,
pinned overflow, depth equivalence, blending і unchanged victory/reload outcomes.
Architecture + Quick + Full без guard changes; game-cycle output залишається ідентичним.
Browser: cold/warm cache, throttling, missing libraries/High, rapid demands, hidden tab, cleanup;
Spine: disabled-WebGL/context loss/continuity. Pages: stub/bundle, committed catalog/variants,
relative URLs із release `<base>`, masters/DEV поза production release/graph.
Runnable scenarios та evidence rules — [quickstart.md](quickstart.md).

## Complexity Tracking

Порушень constitution немає. Queue/store/selector потрібні для lifetime і тестування;
local DEV backend — для filesystem/Sharp/npm; окрема WebGL surface — для чинного Canvas2D.
Інші renderer/framework/backend abstractions не додаються.
