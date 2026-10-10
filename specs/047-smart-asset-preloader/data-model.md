# Data Model: Smart Asset Preloader

**Date**: 2026-10-10 · **Status**: design only · [Spec](spec.md)

## Ownership

| Дані | Авторитетний owner | Інші consumers |
| --- | --- | --- |
| Authored asset ID/source/role/group/fallback/alias | `asset-pipeline/catalog.json` | scanner/generator; не writable runtime |
| Editable tier presets | `asset-pipeline/profiles.json` | validated conversion plan |
| Фізичні emitted variants + hashes | Immutable generation files | generated catalog derives metadata |
| Runtime catalog | Immutable generated catalog snapshot | engine/application/presentation readonly |
| Pending/active jobs і effective priority | Engine load queue | preloader/readonly diagnostics |
| Resource payload/status/ref counts | Engine resource store | loaders create/dispose; leases keep interest |
| Активна visual group generation | Scene binding | provider resolves existing IDs to binding |
| Scene interest | Consumer lease | queue/store derive demand/pin counts |
| Gameplay/unlock/catch facts | Відповідний game owner | demand policy reads snapshot, не зберігає другу історію |
| Animation track/time/skin | Scene animation controller | platform adapter applies snapshot/render |
| UI selection/progress view | DEV controller | immutable job status/capabilities |
| Conversion/install job state | Local tool use case | UI читає, не керує subprocess напряму |

Cache metadata та payload не дублюються у provider/coordinator/diagnostics. Queue зберігає ключ/посилання на cache entry, а не другу копію його status. Leases є правом користування, не copies of pixels.

## CatalogSnapshot

- `schemaVersion`: 1; unknown major rejected.
- `revision`: deterministic hash від канонічних authored records, source hashes і settings/output metadata; час запуску не входить у hash.
- `assets`: records, indexed once by stable ID.
- `groups`: scene layers або coherent animation bundles.
- `aliases`: exact legacy runtime ID → stable ID; no cycle/chains/duplicate ambiguous IDs.
- `provenance`: generator/profile version і source revision; runtime не виконує fs scan.

Після validate snapshot immutable. Authoring groups є декларацією складності сцени, не правилами unlock. Runtime generation не змішується між release boundaries.

## AssetRecord and AssetVariant

| Поле | Значення / validation |
| --- | --- |
| `id` | Stable authored name, наприклад `location.test.background.day`; не залежить від tier |
| `kind` | `visual-image`, `data-image`, `binary`, `json`, `text`, `bundle`; loader determines payload |
| `source` | Registered project-relative master/legacy path; source identity включає extension |
| `logicalSize` | Для visual/image bundles: width/height у scene coordinates, незмінні між tiers; відсутнє у text/json/binary |
| `variants` | Explicit `l/m/h/legacy` entries, format і точний URL; missing tier допустимий |
| `fallbackId` | Optional explicit compatible static visual; cycles invalid |
| `conversionPolicy` | `visual`, `protected-data`, `atlas-bundle`, `unsupported` |

Variant поля: `tier`, `format`, `url`, `width`, `height`, `byteLength`, `contentHash`, `generation`, `profileRevision`, `sourceHash`, `sourceQuality`. Runtime path project-relative, без `..`, absolute URL або leading slash. Loader resolution враховує HTML release base. Width/height > 0; byteLength ≥ 0; logical aspect ratio незмінний. Pixel ratio може відрізнятись лише через зафіксоване proportional resize rounding до одного пікселя; raw EXIF orientation normalized before dimensions. Unknown source dimensions у DEV каталозі допустимі, у published visual variant — ні.

Text/JSON/binary variants не мають width/height і decoded-pixel estimate; містять bytes/hash/URL/loaderKey. Bundle містить explicit dependency IDs і opaque format metadata. Engine валідовує references/lifecycle, а injected platform validator перевіряє Spine-specific compatibility; engine не розгалужує gameplay або vendor logic за цим format. Skeleton/atlas/page dependency має власний resource key і queue job, не приховані runtime HTTP requests.

`data-image` має exact legacy/source variant без l/m/h; conversion blocked. Existing depth remains byte-identical and retains current decoded pixels. Не виправляти її existing codec або colors під виглядом оптимізації.

Приклад generated data (показові шляхи й hash, не створені файли):

```json
{
  "schemaVersion": 1,
  "revision": "catalog-content-hash",
  "assets": [{
    "id": "location.test.background.day",
    "kind": "visual-image",
    "logicalSize": { "width": 2560, "height": 1440 },
    "variants": [
      { "tier": "legacy", "format": "webp", "url": "assets/locations/test/bg_test--day.webp", "width": 2560, "height": 1440, "byteLength": 222664, "contentHash": "original-hash" },
      { "tier": "l", "format": "webp", "url": "assets/variants/locations/test/generation-content-hash/bg_test--day--l.webp", "width": 1280, "height": 720, "byteLength": 80000, "contentHash": "output-hash" }
    ]
  }],
  "aliases": {
    "location:test:day:assets/locations/test/bg_test--day.webp": "location.test.background.day"
  }
}
```

Не створювати compressed-byte estimate із quality number; приклад `80000` є умовним полем після encode, не прогнозом розміру поточного art.

## AssetGroup

- `id`, `kind`: `visual-group` або `animation-bundle`; vendor format є opaque metadata.
- `members`: required stable asset IDs, order, optional layer transform/alpha defaults.
- `tierSets`: для bundled imports явне зіставлення всіх members конкретного tier/version.
- `activation`: `atomic`; ready iff every required member ready + compatible.
- `fallbackGroup`/static fallback: explicit, validated, no cycles.

Current location background group містить day/evening/night minimum tiers. Exact depth — окрема critical data demand; її немає в atomic visual upgrade. Future three spatial layers — інша група, не переосмислення нинішніх phases.

Spine variant set: compatible skeleton `.json` або `.skel`, `.atlas`, всі texture pages, export major/minor, runtime major/minor, atlas/alpha/PMA properties, logical bounds, optional animation names. Група не дозволяє independent page resize або mixed release/tier. Перехід tiers допускається тільки при сумісному skeleton/animation contract.

## AssetDemand and Lease

Demand: `consumerId`, `sceneGeneration`, `assetId/groupId`, `priority`, `reason`, `minimumPolicy`, `targetTier`, `critical`, `allowUpgrade`, `catalogRevision`.

Пріоритети `blocking < interactive < upgrade < prefetch`; менше значення вище. Effective priority спільної роботи — найвищий із active consumers; tie-break FIFO sequence. Global initial-minimum barrier забороняє upgrades/prefetch до readiness незалежно від free slots.

Lease transitions: `pending -> ready -> released`, або `pending -> failed/cancelled -> released`. `ready` означає minimum ready, а не target tier complete. Upgrade status окремий: `not-requested/queued/loading/ready/deferred/failed/cancelled`.

Leases мають idempotent `release()`. Shared resource запитуються один раз; cancellation знімає тільки consumer interest. Після release callbacks consumer не отримує stale activation.

## ResourceEntry and WorkItem

Resource key: normalized source identity + content hash + payload kind + decode/texture options. Tier/alias name не створюють другого payload, якщо фізичний ресурс і options однакові. Release base resolution — browser-platform responsibility; content revision запобігає повторному використанню stale bytes.

Entry: key, catalog generation, status, payload handle, byte count, decoded estimate, GPU estimate, consumers/pins, lastUsed sequence, attempts, terminal reason. Payload може бути image/bytes/parsed data/texture; engine не читає browser object internals.

```text
absent -> queued -> loading -> preparing -> ready -> released/evicted
                     |            |
                     +-> failed <-+
failed -> queued (bounded automatic retry або new explicit cycle)
queued/loading/preparing -> cancelled (тільки коли немає active interests)
```

Attempt timeout covers fetch+prepare, timer injected. Pinned current minimum can exceed soft budget with explicit `pinned-budget-overflow`; optional upgrades/prefetch не використовують цей виняток. Queue state remains bounded by active authorized demand window; dormant catalog entries не є queued work.

Memory estimate: image RGBA `width * height * 4`; WebGL base texture приблизно ще стільки ж, mipmaps якщо є — окремий overhead. Це accounting, не exact browser heap/GPU. Ураховувати old/new overlap, backing images для Spine restore та depth-reader retained pixel buffer. Texture dispose відбувається до release останнього backing-image lease.

## ConversionPlan and Job

Plan: catalog/source/profile revision, selected source IDs, explicit targets, canonical effective presets/overrides, source hashes, output dimensions/paths, warnings, blockers, deterministic generation ID. Інструмент не виконує invalid/stale plan. Registered authoritative legacy source може явно дати l/m; h зберігає original baseline без повторного encode. Generated derivative не може стати джерелом іншого tier.

Plan існує окремо від Job. Job states: `queued -> running -> succeeded`, або terminal `failed/cancelled`; optional intermediate `cancelling`. Phases усередині running: `encoding`, `validating`, `publishing` (install: `installing`, `verifying`). Cancellation allowed before catalog commit; commit point indivisible, після нього result succeeded. Public HTTP JobStatus використовує ці самі state names. Один conversion job та один install job; install не стартує під active encoder job, publication має project-scoped lock.

Files emitted у immutable `generation-<hash>` folders. Staging never referenced by active catalog. Каталог записується останнім через atomic replace; попередня generation лишається працездатною. Crash після derivative publish залишає isolated orphan, не partial active catalog. Cleanup лише окремою явною tool operation після перевірки references.

## Capabilities and Diagnostics

Runtime capability statuses: `ready`, `dependency-missing`, `runtime-unprepared`, `service-unavailable`, `unsupported`, `failed`; include reason, known dependency/version and supported explicit action. DEV HTTP converter `missing` maps to `dependency-missing`, `incompatible` maps to `unsupported`; unavailable HTTP service maps to `service-unavailable`. Немає infinite preparation retry.

Diagnostics snapshot: revision, phase/minimum totals, resource status/tier/reason, queue caps/current, cache hits/shared requests, known transferred bytes, retained estimates, retries/fallbacks, budget exceptions. Snapshot derived on events/on demand, UI refresh ≤ 4 Hz, не створюється кожного game frame; виробничий no-op sink не імпортує DEV.
