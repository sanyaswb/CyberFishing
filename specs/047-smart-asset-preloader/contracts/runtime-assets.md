# Runtime Asset Contract

**Status**: proposed, no runtime code added · [Spec](../spec.md) · [Model](../data-model.md)

## Dependency and API Contracts

Контракти структурні для native JS. Не створювати hierarchy інтерфейсів або generic plugin registry заради цього документа.

| Collaborator | Operations / responsibility |
| --- | --- |
| Catalog | `getAsset(id)`, `getGroup(id)`, `resolveAlias(id)`, immutable `revision` |
| Transport | `fetch(variant, context)` -> encoded handle; `releaseEncoded(handle)`; platform host I/O |
| Preparation adapter | `prepare(encoded, variant, context)` -> ready payload; `dispose(payload)` |
| Queue | enqueue/promote/drop consumer, drain under injected caps; owns dispatch order |
| Store | one entry per resource key; acquire/release/pin, eviction, accounting |
| Preloader | `requestAsset(demand)`, `requestGroup(demand)` -> lease; forwards result/events |
| Lease | `minimumReady`, `getReadyVariant()`, `onChanged(listener)`, `release()` |
| Capabilities | immutable snapshot + subscription; image formats, visibility, network constraints |
| Clock/Scheduler | monotonic time, bounded deferred jobs/timers; injected, no browser globals in engine |
| Diagnostics | event sink with no-op implementation in production; snapshot reads real owners |

`context` містить cancellation/timeout interest, catalog generation, known byte total й progress callback. Queue звільняє network slot після fetch і запускає prepare тільки через окрему preparation lane; image decode/atlas parse/GPU preparation не обходять її. Concrete AbortController, fetch, Image, decode, texture і timers не імпортуються в engine/application. Engine does not new browser globals.

Encoded-ready backlog обмежений injected defaults: 4 encoded reservations (fetching + waiting/preparing) та 16 MiB estimated encoded buffers. Reservation отримується до fetch; закінчення fetch не звільняє її до prepare/releaseEncoded. Unknown size — консервативна reservation до actual bytes; critical oversize має diagnosed exception й serialized preparation, не uncapped parallel fetch. Transport backpressure зупиняє speculative dispatch, якщо backlog заповнений. Один group request не є одним network slot: кожний skeleton/atlas/page request окремо проходить cap. Network attempts та parse/decode retries обліковуються окремо, repeated preparation не запускає дубльований fetch без потреби.

Початковий loader підтримує visual/data images; optional Spine loader потребує generic byte/JSON resources через ту саму queue. Runtime's native `loadTextureAtlas()` не може запускати uncapped requests. Atlas parsing отримує вже controlled loaded pages; texture preparation/disposal також обліковується.

## Existing Application Contract

Зберегти методи application consumers під час інтеграції:

```text
preloadApplicationAssets()
preloadLocation(locationId)
preloadFishingAssets(equipment, fish)
preloadVictoryAssets(fish)
```

Їх надає game/application facade із injected game demand policy. `preloadLocation` initially мінімальні day/evening/night + unchanged depth. `preloadFishingAssets` noncritical; `preloadVictoryAssets` waits minimum permitted fish representation. Не змінювати `GameApplication` failure state/reason `asset_load_failed`, rod retrieval semantics або startup cleanup.

Методи повертають existing `AssetLoadResult`; status aggregate after settle, без створення pending records як false failure. Усі optional rejections handled. Facade owns application scopes/leases для поточної location/fish події; явне завершення/replace event знімає obsolete interests, application dispose idempotent releases all. Leases не додаються до старого public return type. `LocationAssetLoader.load(locationId, locationConfig, locationsConfig)` зберігає signature й отримує injected ready-resource port цієї самої scope, без другого preload path.

Existing provider contracts `preload`, `tryGet`, `isReady`, `has`, `assetIdForSource` зберігаються для старих consumers, але більше не володіють незалежним image cache. `tryGet(oldId)` resolves explicit alias/binding до готового current variant; unknown ID не породжує guessed tier filename. Новий code використовує stable IDs; callback identity tests залишаються значущими.

Existing `LocationAssetLoader` споживає вже ready resource lease, а не створює паралельний обход queue. Depth pixel reader не змінюється. Application ніколи не import конкретний browser loader або DEV client.

## Priority and Dispatch

| Rank | Class | Examples | Gate |
| --- | --- | --- | --- |
| 0 | `blocking` | Minimum initial/current scene + exact gameplay data | Allowed during startup barrier |
| 1 | `interactive` | Opened UI/current fish victory/future requested scene minimum | Always demand-driven; outranks pending background |
| 2 | `upgrade` | Current visible group higher tier | Initial minimum ready + eligible + budget |
| 3 | `prefetch` | Explicitly eligible near-next group minimum | Same gates + game authorization |

Defaults: network 4; combined upgrade/prefetch maximum 1; preparation maximum 1. Наприклад, active background 1 не заважає dispatch нового interactive в решту slots. Ties FIFO. Already-active foreground tasks можуть завершитись; немає hard real-time priority guarantee для мережі/browser.

Promotion recalculates from all interests; cancellation recalculates too. Background starvation під безперервними потребами допустиме; foreground ніколи не витісняється aging. Відсутність нових authorized demands означає idle, не scan всього catalog.

## Variant Selection and Fallback

Cold minimum selection для Auto/High: `l -> legacy -> m -> h` серед supported, valid variants. Forced Low: тільки `l -> permitted legacy/static fallback`; холодні m/h downloads заборонені. Format order за configuration/capability, спочатку WebP; AVIF додається явно разом із fallback. Якщо failure одного кандидата, bounded attempts і наступний permitted candidate, без infinite cycles.

Auto target: High за дозволу budget/capabilities; Middle якщо є й High не допускається. High mode ставить High target, але minimum Low/legacy залишається usable. Low mode target/minimum `l`, legacy лише коли l немає/failed; без них застосовується explicit static fallback або critical failure. Перемикання на Low може тимчасово лишити вже видимий higher variant до готовності l, але не створює нового higher request. Новий Low consumer обирає ready l/permitted legacy/fallback; temporary retained higher — лише при існуючому binding, з діагностикою, без нового download.

Ready compatible cached variant може задовольнити minimum у межах mode policy. Для standalone image вибір per asset; для atomic group — тільки повний coherent tier set. Partial cached High не змішується з Low pages/layers: використовується complete minimum set, потім complete higher set. Registered legacy set — допустимий minimum fallback; винятки declared explicitly, без mixed Spine versions. Missing requested tier — `tier-unavailable` diagnostic і permitted fallback; відсутній будь-який allowed minimum — critical rejection. Explicit static fallback задовольняє only declared semantic compatibility: decorative Spine fallback так, підміна depth arbitrary image — ні.

Після ready higher active completion lower request не downgrade binding. На quality setting changes queued higher interests знімаються, active shared work не abort для інших. Новий lower activation лише explicit user/policy change, ніколи late promise completion.

No FPS-driven adaptation v1. Hidden/offline/save-data/low mode suspends new upgrades/prefetch; unsupported hints use defaults. Budget check before optional prepare/activation includes old+new payload; defer if insufficient. Stable permission 5 s before resuming optional upgrade; 15 s cooldown між automatic policy-induced quality changes. Це injected knobs, не gameplay timing.

## Readiness, Progress, Activation

`minimumReady` resolves після fetch, decode/parse validation і group readiness. Не чекає target High чи всієї catalog queue. Initial batch captures required members once; optional jobs не змінюють знаменник startup progress. Unknown byte totals report indeterminate; file completion/decode/usable readiness показуються окремо.

Visual binding tracks one group generation. Activate all required member bindings between frames after validating consumer still active + catalog/scene generations match. Logical dimensions/order/alpha зберігаються; frame records/cache objects reused. Upgrade не викликає map refresh, location rebuild, equipment hydration, state transition або clock/RNG update.

Existing game has time-of-day blending; all three minimum backgrounds initially available/pinned. Visible-phase-only loading deliberately deferred до future policy, яка доведе lookahead під timeScale/DEV jumps.

Publish оновлює DEV inventory metadata автоматично; runtime catalog adoption лише через явний `Apply to preview` до isolated decorative preview. Це створює validated request generation; old preview leases лишаються valid до replacement. Gameplay session не hot-reloaded і не rebuild. Stale completion may populate its own unpinned cache entry if authorized, але не active binding. Production і звичайна active game session підхоплюють каталог наступного startup/release.

## Error and Lifecycle Semantics

- 15 s attempt timeout includes preparation; 1 automatic retry with injected 500 ms delay; every candidate cycle bounded. Explicit Retry clears terminal attempt-cycle state without duplicating active shared load.
- Demand deadline default 60 s включає очікування queue/preparation lane, attempts і fallback candidates. Якщо фізичний slot завис, consumer все одно отримує terminal critical failure або already-ready fallback в межах deadline; не чекає нескінченно queued retry. Deadline не створює нового physical slot і не зменшує counter unfinished work.
- Cancellation distinct from error; scene disposed waits no dangling callbacks. Underlying abort best effort, only no active interests. Failure handler cannot mutate already-disposed scene.
- Cancel/timeout не звільняє фізичний slot непереривного decode/upload/import до завершення роботи. Consumer отримує bounded timeout/fallback, результат stale, але queue counter/resource reservation лишається зайнятим; інакше другий decode порушить cap. Якщо slot завис, optional preparation suspend і ready scene зберігається; recovery через явний повтор/перезапуск capability, без uncapped parallel work.
- Current scene pinned; unpinned entries evicted LRU under 96 MiB soft accounted budget. Critical pinned overflow exposed, optional work paused; не розбирати active current resources.
- Store asks platform dispose GPU texture before closing/releasing its retained backing image. Spine context restore may need image source; retain while texture alive.
- Depth pixel buffer immutable й accounted by its real owner; never released merely on visual tier swap.
- Application dispose drains interests and schedules payload cleanup. Existing active-loop guard remains sole page loop authority.

## Spine Surface Contract

Platform runtime loader literal-lazily imports fixed `spine_runtime_module.js`. File always exists as explicit unavailable factory stub або reproducible pinned local ESM factory bundle; no CDN, bare npm specifiers, eval, blob-import workaround or new global. Installer/tool preparation is not production import.

Import dispatch — queued optional capability job після initial minimum barrier, не eager scene-composition side effect. Provider cache одна shared Promise; nonabortable module load/evaluation займає reserved capability/network slot до settle. Бібліотека не запускає власних atlas requests. Це не гарантує відсутність main-thread evaluation stall: його вимірює Spine spike, і в разі неприйнятного stall capability лишається static fallback.

Engine expresses generic resource groups/readiness; it does not know Spine bones, CyberFishing lobby, DOM або WebGL. Platform adapter exposes `createScene(bundle, surface)`, `applyState(snapshot)`, `update(dt)`, `render(transform)`, `dispose()`. Presentation owns animation lifecycle/state and renders through port; bootstrap creates concrete browser surface.

Separate optional WebGL canvas/layer; existing game Canvas2D context preserved. Input remains in existing owner; decorative surface does not capture pointer events. Z-order/resizing follows injected scene layout; hidden scene stops decorative updates; reduced-motion prefers static fallback.

On upgrade preserve track name/time/loop, skin and supported mixing state; unsupported transfer keeps old tier/deferred upgrade, не restart. No gameplay event listeners on decorative animation timeline. Missing runtime, invalid version, texture capacity or context restore failure => static fallback, same usable scene.

## Release and Guard Contract

Generated catalog `.js` named export is composed through game/config; content readonly, no host globals. All optional runtime modules target literal relative `.js`; checked-in stub allows deployment without prepared Spine. Third-party prepared module exposes only named factory and passes existing architecture guard without ignore list.

Release builder follows committed module graph and all committed assets. Include catalog, optional runtime artifact, skeleton/atlas/pages and current generation assets. New masters outside `assets/**`; generated folders never begin `_` or `.`. Source paths resolve within each immutable release `<base>`.

No attempt to delete old published release/generations or mutate cached production catalog. Narrow release validation may be extended to reject missing generated metadata/targets; it must strengthen checks rather than weaken guard/baseline.
