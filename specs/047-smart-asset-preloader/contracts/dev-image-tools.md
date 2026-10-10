# Контракт DEV Image Tools

Статус: проєктний контракт; реалізація та встановлення залежностей не виконуються в межах специфікації.
Інструмент готує ресурси; engine споживає опублікований каталог через composition root.
DOM, файловий сканер, Sharp і пакетний менеджер належать DEV/platform, не engine/domain.
Контракт незалежний від backend 029 і не потребує production API чи облікового запису.

## 1. Запуск і межі доступу

- Інструмент вмикається лише через `npm run dev -- --image-tools`; без прапорця маршрути повертають 404.
- Прапорець дозволений лише для bind на loopback: `127.0.0.1`, `::1` або перевірений localhost.
- Nonlocal bind/remote address із прапорцем відхиляється; production entrypoint і release не містять API/інсталятор.
- Browser UI звертається тільки до свого origin; сервер не відкриває CORS і не довіряє forwarded headers.
- Для всіх маршрутів перевіряються loopback remote address та точний Host із дозволеним host/port поточного сервера.
- Якщо Origin присутній, він мусить точно збігатися з origin сервера; `null` і чужі origins відхиляються.
- Для POST обов'язкові точний Origin, JSON media type, валідний JSON і session token у `X-CF-Image-Tools-Token`.
- Token генерується випадково при запуску, зберігається лише в пам'яті server/UI, не передається в URL чи логах.
- Capabilities повертає token тільки після перевірок доступу; решта маршрутів також потребують token.
- JSON body має ліміт 64 KiB; невідомі поля, неправильні типи та порожні selections відхиляються.
- API не приймає shell commands, package names, абсолютні paths, довільні URLs або destination directories.

## 2. Файли й authoritative ownership

- `asset-sources/` — lossless masters із реальною структурою підпапок; це не production assets.
- Наявні compressed файли `assets/` мають статус `legacy`; вони залишаються за поточними URLs.
- Legacy не оголошується lossless master; High із такого файлу не відновлює втрачену деталізацію.
- `asset-pipeline/catalog.json` — authored прив'язки logical asset ID, source, kind і спільної геометрії.
- `asset-pipeline/profiles.json` — authored профілі scale/quality/format; filename не замінює ці дані.
- `src/game/config/assets/generated_asset_catalog.js` — generated named export `ASSET_CATALOG`, runtime commit point.
- Оригінали не перезаписуються, не видаляються й не переміщуються; плаский originals backup не використовується.
- Source discovery бачить master tree та legacy tree; generated variants, staging, runtime/node_modules і backups виключені.
- Published variants додаються в browsable tree з generated catalog після перевірки їх реальних paths/bytes.
- Нереєстровані masters показуються в дереві; перед conversion їх потрібно прив'язати в authored catalog. Мінімальний UI показує потрібний запис і посилання на конфігурацію; authoring registration робиться редагуванням `asset-pipeline/catalog.json` і повторним Scan. Це явна реєстрація, не автоматичне припущення щодо role/unlock/group.
- Каталог UI показує фактичні source/output paths; він не вигадує папки і не визначає progression групи.

Для source `asset-sources/locations/test/bg_test--day.png` похідний output має вигляд:
`assets/variants/locations/test/generation-<hash>/bg_test--day--l.webp`.
Так само формуються `--m`, `--h` і, якщо замовлено, `.avif`; підпапки source зберігаються.
Hash generation враховує sorted source content hashes, canonical profile й encoder/native-library fingerprint.
Output content hashes обчислюються після encoding та перевіряються перед publish/reuse; paths відомі вже в plan.
Два однакові inputs/settings/tool versions дають той самий план/каталог; timestamps не впливають на identity.
Published generation immutable: reuse після перевірки hashes або нова generation; overwrite заборонений.
Source stems із різними extensions, що дають один destination, блокують plan; automatic rename не виконується.
Windows case-insensitive collisions, terminal `--l/--m/--h` ambiguity і duplicate logical IDs також блокуються.
Суфікси `--day`, `--night`, `--1-uniq` не трактуються як quality tiers.

## 3. Профілі й дозволені перетворення

| Tier | Scale | WebP quality | AVIF quality |
| --- | ---: | ---: | ---: |
| l | 0.50 | 50 | 40 |
| m | 0.75 | 80 | 65 |
| h | 1.00 | 95 | 85 |

- Це початкові settings; дозволені authored overrides: scale `(0,1]`, quality integer `[1,100]`.
- Розміри рахуються після EXIF orientation normalization. Найдовша сторона `max(1, floor(longSide × effectiveScale))`; друга `max(1, round(shortSide × targetLongSide / longSide))`. Aspect-preserving encoder fit inside цієї box, без upscale/crop; tolerance через integer rounding ≤1 px, logical bounds/anchor незмінні. `effectiveScale = min(scale, maxEdge/longSide)` якщо maxEdge задано.
- Preview показує точні output width/height, scale, quality, alpha handling, formats і destination для кожного tier.
- WebP є початковим output; AVIF optional і доступний лише після encoder capability check.
- Network bytes і decoded estimate `width × height × 4` показуються окремо; estimate не є виміром GPU memory.
- Lossless master є бажаним джерелом кожного tier. Для нинішніх WebP дозволений явний `allowLegacyDerivation:true`: authoritative legacy baseline -> l/m із позначкою якості джерела; вибраний h повторно використовує незмінний baseline без encode і без обіцянки відновити деталі. Recompress low → high або generated → generated заборонено.
- SVG та animated raster показуються як unsupported; цей контракт не вводить rasterization чи flattening.
- `data-image` та `atlas-page` блокуються для загальної lossy/resize conversion.
- Зокрема `assets/locations/test/test-depth.webp` визначає gameplay depth через red channel: пікселі/геометрію зберігати.
- Spine atlas pages потребують окремого узгодженого export bundle/atlas metadata; не resize незалежну page.
- Нові visual masters auto-orient перед preview/resize; no crop/upscale/flatten. Output alpha straight/preserved, no PMA transform для ordinary visuals; colour policy fixed sRGB із явним profile fingerprint у generation hash. Atlas PMA лише coordinated bundle. Legacy baseline/data bytes не переписуються; l/m derivation має explicit visual colour policy. Output validation перевіряє alpha, dimensions і logical bounds.

## 4. HTTP дії

Префікс усіх маршрутів: `/__dev/image-tools/v1`; відповіді JSON, `Cache-Control: no-store`.
IDs і hashes — server-issued strings; caller не перетворює їх на filesystem paths.

| Метод і route | Request | Response |
| --- | --- | --- |
| GET `/capabilities` | без body | `Capabilities` |
| POST `/scan` | `{ roots: ["masters", "legacy"] }` | `CatalogInventorySnapshot` |
| POST `/plan` | `{ catalogRevision, selections, profileId, formats, tierOverrides?, allowLegacyDerivation? }` | `ConversionPlan` |
| POST `/convert` | `{ planId, planHash }` | `JobAccepted` |
| GET `/jobs/<jobId>` | без body | `JobStatus` |
| POST `/jobs/<jobId>/cancel` | `{}` | `JobStatus` |
| POST `/install` | `{ tool: "image-converter" }` | `JobAccepted` |

`Capabilities`: `{ apiVersion: 1, sessionToken, converter: "ready"|"missing"|"incompatible",`
`formats: ("webp"|"avif")[], install: "available"|"unavailable", catalogRevision }`.
Відсутність backend відображається UI як `unavailable`; гра продовжує працювати.

`CatalogInventorySnapshot`: `{ catalogRevision, roots: CatalogNode[], warnings: Diagnostic[] }`; це file-tree DTO, окремий від runtime CatalogSnapshot.
`CatalogNode`: directory `{ type:"directory", name, relativePath, children }` або file
`{ type:"file", fileId, name, relativePath, exists:boolean, bytes:null|number, dimensions:null|{width,height}, dimensionsSource:"decoded"|"validated-cache"|"unknown",`
`logicalAssetId:null|string, origin:"master"|"legacy"|"variant", kind, conversionStatus, variants }`.
`kind`: `visual-image|data-image|atlas-page|unsupported`; `conversionStatus`: `eligible|unregistered|blocked|unknown`.
`atlas-page` тут є роллю файла у DEV inventory, не самостійним runtime asset: runtime отримує цілісний bundle.
File tree/byte sizes працюють без Sharp; dimensions беруться з валідованого cache або залишаються `null`.
Cache key містить path і content identity; зміна source скидає попередні dimensions/results.
Missing authored source/output створює tombstone `exists:false, bytes:null` з точним очікуваним path і `FILE_MISSING` diagnostic; scan не приховує absent registrations. Unreferenced generation файли позначаються orphan, не додаються в playable catalog.

`selections`: nonempty array `{ fileId, tiers:("l"|"m"|"h")[] }`; duplicate IDs/tiers заборонені.
`profileId` існує в authored profiles; `formats` — unique nonempty supported format array.
`tierOverrides`: map тільки selected `l/m/h` -> `{ scale?, maxEdge?, webpQuality?, avifQuality? }`, bounds scale `(0,1]`, maxEdge positive integer ≤32768, quality integer `[1,100]`. Overrides застосовуються до вибраних файлів, входять до canonical recipe/plan hash і не пишуть profiles.json неявно. Збережений preset редагується у `asset-pipeline/profiles.json`, після чого old plans стають stale.
`allowLegacyDerivation` boolean за замовчуванням false; UI показує source-quality notice перед явним вибором. h-reuse plan item має `operation:"reuse"` і точний existing URL; encoded item має `operation:"encode"`. Protected-data/atlas role неможливо обійти через overrides.
`ConversionPlan`: `{ planId, planHash, catalogRevision, outputs:PlannedOutput[], warnings, canConvert }`.
`PlannedOutput`: `{ logicalAssetId, sourceFileId, sourceHash, tier, format, width, height, quality, scale,`
`relativePath, estimatedDecodedBytes, operation:"encode"|"reuse", sourceQuality:"master"|"legacy" }`; compressed bytes до encoding не обіцяються.
Plan серверний, незмінний, має TTL; profile/source/catalog changes роблять його stale.

`JobAccepted`: `{ jobId, type:"conversion"|"installation", state:"queued" }`; HTTP 202.
`JobStatus`: `{ jobId, type, state, completed:number|null, total:number|null, progressUnit:"outputs"|"indeterminate", phase, errors:Diagnostic[], publication:null|{catalogRevision} }`.
`state`: `queued|running|cancelling|cancelled|succeeded|failed`; `phase` не підміняє state.
Conversion counters — outputs (encode/reuse), integers `0 <= completed <= total` з fixed denominator verified plan; readiness/publication окрема phase. Install counters null/indeterminate. `Diagnostic`: `{ code:string, severity:"info"|"warning"|"error", message:string, relativePath:string|null, field:string|null, retryable:boolean }`.
Unknown job/expired plan — 404; plan із blocking diagnostics повертається 200 із `canConvert:false`.
Conversion заблокованого plan відхиляється; сервер повторно перевіряє всі invariants перед execution.

Error body: `{ error:{ code, message, field:null|string, retryable:boolean } }`.
Коди: 400 `INVALID_REQUEST`; 403 `ACCESS_DENIED`/`INVALID_TOKEN`; 404 `NOT_FOUND`/`PLAN_EXPIRED`;
409 `STALE_PLAN`/`JOB_BUSY`/`OUTPUT_COLLISION`; 413 `BODY_TOO_LARGE`; 415 `JSON_REQUIRED`;
422 `SOURCE_CHANGED`/`UNSUPPORTED_ASSET`/`INVALID_PROFILE`; 503 `DEPENDENCY_MISSING`/`INSTALL_UNAVAILABLE`.
Diagnostics не містять tokens/host secrets; filesystem errors повідомляють project-relative path.

## 5. Containment і виконання

- Корені фіксовані композицією: masters, existing assets, generated variants, staging, authored/generated catalogs.
- Для входів resolve + realpath перевіряють containment у дозволеному root, а не prefix строк.
- Windows junctions/symlinks/reparse points поза roots відхиляються; output ancestor realpaths перевіряються до створення.
- Перевірка повторюється перед read/write/publish, щоб зміна link між plan та execution не обходила containment.
- Encoded traversal, absolute/UNC paths, drive-relative paths і небезпечні Windows names відхиляються.
- Запуск encoder має обмежену concurrency; одночасно лише один conversion job і один publication lock.
- Install і conversion взаємно виключені; API не надає загального process runner.

## 6. Транзакція й cancellation

1. Зафіксувати validated plan; перевірити revisions, source hashes, encoder та output collisions. Encode читає frozen source bytes/snapshot, contentHash якого відповідає plan.
2. Побудувати ВСІ outputs у dedicated staging job directory; невдала encoding залишає published catalog незмінним.
3. Decode-validate dimensions/alpha/formats і hashes; carry forward усі unselected valid variants/legacy bindings, перевірити completeness/coherence declared groups і побудувати цілий generated catalog.
4. Під publication lock повторно перевірити catalog/profile revisions і source hashes, після чого опублікувати immutable generation directories. Source/profile зміна блокує commit як stale plan.
5. Записати generated JS у sibling temporary file та атомарно replace catalog ОСТАННІМ: це commit point.
6. Лише після commit повідомити `succeeded` і нову catalogRevision; runtime не читає staging чи половину каталогу.

Cancel до commit зупиняє pending work, чекає безпечного завершення active encode і не публікує catalog.
Cancel після commit повертає `succeeded`: він не видаляє вже опубліковані ресурси.
Crash до commit залишає попередній catalog і, можливо, isolated staging/orphan generations.
Cleanup — окремий DEV utility з explicit selection; перевіряє containment/refs та не видаляє referenced generations.
Немає автоматичних broad recursive deletes або cleanup originals; on-start scan лише позначає orphans.

Для звичайних visual groups можна конвертувати subset members: індивідуальні variants з'являються в inventory, але новий tier set стає playable тільки коли повний; старий complete set carry forward. Для imported Spine bundles частковий skeleton/atlas/page набір не публікується як variant set. Це дозволяє вибіркову роботу без змішаного активного tier.

## 7. Optional dependencies й install button

- Sharp lazy-resolved лише при capability/metadata/conversion request; відсутній package не ламає game/server.
- Спочатку reuse сумісного root Sharp, перевіреного за version і підтримкою requested encoders.
- Кнопка «Встановити залежності конвертера» запускає один фіксований job після explicit click.
- Підготовлений `utils/image-tools/runtime/package.json` і lockfile фіксують Sharp 0.34.5 та необхідні transitive binaries.
- Встановлення ізольоване: `npm ci --prefix <absolute-tool-runtime> --include=optional --no-audit --no-fund`.
- Runner використовує перевірений npm executable/фіксований argv; prefix задає сервер, request не керує аргументами.
- Команда не запускає root `npm ci`, не змінює project package.json/lockfile і не вибирає `latest`.
- Відсутні Node/npm, registry/network чи native support дають зрозумілий failed/unavailable status; retry лише кнопкою.
- Після install виконати version/encoder smoke check; успіх npm сам по собі не означає converter ready.
- Жодного npm/network install під час game startup; Spine runtime installation/distribution — окремий контракт.

## 8. Панель і сумісність

- Одна кнопка DevTools відкриває окрему панель: browsable folders, multi-select, filter, size/dimensions/variants/status.
- Selection/plan/job state належить controller; repopulate DevTools через active fish не скидає панель.
- Preview показує paths/settings перед Convert; під час job доступні progress, Cancel і деталізована помилка.
- Apply оновлює лише DEV visual preview; gameplay facts/data images та поточна session не змінюються.
- Production підхоплює generated catalog на наступному startup/release; published release URLs лишаються immutable.
- Existing CLI interactive behavior зберігається у legacy mode; новий core extraction не імпортує readline.
- CLI використовує `require.main === module` guard; DEV API не викликає interactive legacy `main()`.
- Мінімальні перевірки: missing Sharp, explicit install, hostile requests/paths, collisions, stale plan, cancel/crash,
  unchanged masters/depth data, atomic catalog publication, immutable outputs і відсутність DEV API в production.
