# Дослідження: Smart Asset Preloader

**Дата**: 2026-10-10. **Статус**: рішення для проєктування; production-код, бібліотеки й ресурси не змінено.

## 1. Межа між механізмом і правилами гри

**Рішення**: `engine` отримує декларативний каталог ресурсів, запити груп і пріоритети через ін'єкцію. Черга, дедуплікація, lifecycle та бюджети є універсальними механізмами. `game/application` визначає потрібні групи з актуального стану гри; браузерне завантаження, decode та Spine/WebGL належать `platform`; UI каталогу і конвертації — `dev`. Конкретні реалізації складає тільки `bootstrap`.

**Причина**: рушій не може знати, яка локація відкрита або яка риба доступна гравцеві. «Ще не спіймана риба» не є універсальною забороною: її зображення може знадобитися для першого улову. Правила доступності мають враховувати контекст використання, а не лише факт попереднього отримання.

**Альтернатива**: один `OptimizationManager`, який читає gameplay-state, DOM і файлову систему. Відхилено через змішані відповідальності й неправильний напрям залежностей.

## 2. Пріоритет означає контроль запуску, а не обіцянку браузерного порядку

**Рішення**: власна обмежена черга керує тим, коли починається кожний керований запит. Спочатку мінімально необхідні ресурси поточного екрана, далі його покращення якості, потім дозволений background-prefetch. Новий foreground-запит отримує перевагу над наступними background-запитами. Закриті далекі групи не мають автоматично потрапляти в чергу лише тому, що startup завершено.

**Причина**: `fetchPriority` є hint для браузера, а не гарантією глобального порядку або витіснення вже розпочатих запитів. `requestIdleCallback` керує виконанням callback на main thread, не мережевим scheduler. Вони доповнюють власну чергу, не замінюють її. [MDN: fetchPriority](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/fetchPriority), [MDN: requestIdleCallback](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback).

**Альтернатива**: поставити `low` усім зображенням і відразу присвоїти їхні `src`. Відхилено: усі запити вже стартують, а кількість decode та резидентних зображень лишається неконтрольованою.

## 3. Network, decode, render-ready та видимість — різні етапи

**Рішення**: розрізняти отримані байти, декодоване зображення, готовий до використання ресурс і видимий варіант. Fetch/decode/upload мають окремі керовані межі паралельності. `HTMLImageElement.decode()` використовується за наявності; fallback — `load`/`error` з перевіркою актуальності запиту. GPU upload не вважати завершеним лише тому, що завершився image-decode.

**Причина**: `decode()` повертає Promise готовності декодованого зображення й може відхилятися через помилку запиту, зміну `src` або пошкоджені дані. Завантаження текстур може спричиняти GPU pipeline flush. [MDN: decode](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decode), [MDN: WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices).

**Скасування**: `AbortController` реально скасовує підтримуваний fetch та читання response body. Для image-decode, GPU upload і `import()` не обіцяти фізичне переривання: після скасування/зміни екрана відкидати застарілий результат через generation-token, звільняти непотрібні handles і не робити visible commit. Спільний запит не скасовувати, поки лишилися актуальні consumers. [MDN: AbortController.abort](https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort), [MDN: import()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import).

## 4. Розмір файлу не є розміром у пам'яті

**Рішення**: каталог зберігає `encodedBytes`, `width`, `height`, формат і оцінку decoded-memory окремо. Для звичайного RGBA8 базова оцінка — `width × height × 4`; для GPU/пікової пам'яті додавати окремі оцінки текстур, буферів, одночасно утримуваних tier та mipmaps, якщо вони використовуються. Dev UI підписує оцінки як оцінки, не як точний RAM/VRAM telemetry.

**Причина**: RGBA8 має чотири 8-bit компоненти на піксель. WebGL не має переносного API, що повідомляє загальний доступний VRAM. Браузер може утримувати додаткові копії. [MDN: ImageData.data](https://developer.mozilla.org/en-US/docs/Web/API/ImageData/data), [MDN: VRAM budget](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices#estimate_a_per-pixel_vram_budget).

**Наслідок**: нижчий encoder-quality без зміни роздільності зменшує переважно мережеві байти, не кількість decoded-пікселів. Для реального memory-tier потрібна також контрольована роздільність. Зменшення ширини й висоти вдвічі дає вчетверо менше пікселів; це арифметична оцінка, а не вимір браузерної пам'яті.

`PerformanceResourceTiming.transferSize` може бути `0` для cache-hit або cross-origin без `Timing-Allow-Origin`. Прогрес із вагами каталогу — прогрес запланованої групи; не називати його точним live-download progress, якщо transport не надає відповідні виміри. [MDN: transferSize](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming/transferSize).

## 5. Fallback без залежності від необов'язкових APIs

**Рішення**: за відсутності `navigator.connection`, `saveData`, `deviceMemory` та idle-API використовувати ін'єктовані консервативні defaults. `saveData === true` обмежує необов'язкові upgrades/prefetch; невідоме значення не означає швидкий інтернет. `deviceMemory` — допоміжний hint, не доступна пам'ять процесу. `prefers-reduced-motion` керує декоративною анімацією, не визначає продуктивність пристрою. [MDN: saveData](https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation/saveData), [MDN: deviceMemory](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/deviceMemory), [MDN: reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion).

**Bounded state**: retries мають ліміт і backoff; кількість активних запитів та retained-errors обмежена; debug-history має фіксовану місткість. Резидентні decoded/GPU resources мають бюджет і authoritative owner. Eviction допускається лише без активних consumers; candidate-upgrade також резервує бюджет до запуску. Cleanup звільняє listeners, pending callbacks і ресурси сцени.

**Альтернатива**: адаптація лише за `navigator.deviceMemory` або нескінченне preload-all/retry-all. Відхилено: ці APIs не універсальні, значення пам'яті приблизне, а background-робота може розростатися без меж.

## 6. Spine: optional WebGL capability, статична заміна

**Рішення**: кандидат — офіційний `@esotericsoftware/spine-webgl`, ізольований platform-adapter на окремому canvas для анімованої сцени/лоббі. Generic animation-contract не експортує Spine types у domain/application. Update використовує наявний `deltaTime`; adapter не запускає незалежний gameplay-loop. Для відсутньої бібліотеки, помилки import, непридатного WebGL, помилки asset-group або context loss лишається статичний poster/background і працездатна навігація.

**Перевірений факт**: `spine-canvas` у лінії 4.2 не підтримує clipping, повноцінні mesh attachments і two-color tinting; experimental triangle mesh mode описаний як повільний та з можливими артефактами. `spine-webgl` підтримує всі Spine features. [Офіційний spine-ts README, 4.2](https://github.com/EsotericSoftware/spine-runtimes/blob/4.2/spine-ts/README.md).

На canvas, який вже отримав `2d` context, не можна отримати інший context mode. Тому окрема render-surface потрібна без міграції наявного Canvas2D renderer. [MDN: getContext](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext). Context loss має власний event; сценарій можна відтворити через `WEBGL_lose_context`. [MDN: webglcontextlost](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/webglcontextlost_event).

**Альтернативи**: `spine-canvas` можливий лише з явно обмеженим authoring-profile, підтвердженим export-fixture; Pixi потребує додаткового renderer/toolkit і поки не виправданий наявним Canvas2D. Поточна Pixi v8 документація описує власні Canvas-обмеження, тому «Canvas завжди відтворює будь-який Spine-export» неприйнятна обіцянка. [Офіційна spine-pixi документація](https://esotericsoftware.com/spine-pixi).

## 7. Сумісний package/stub без послаблення architecture guards

**Рішення**: platform-provider робить literal relative lazy `import()` фіксованого `.js` модуля всередині `src/platform`. Цей checked-in module є або capability-unavailable stub, або відтворювано згенерованим self-hosted ESM runtime bundle з одним named factory-export. Provider кешує одну Promise/runtime identity; відмова не виходить у startup як uncaught error. Stub не потребує встановленого Spine.

**Причина**: офіційний npm-package є ESM, але залежить від `spine-core` та містить bare imports. Їх не можна прямо перенести в native browser graph із чинними repository guards. Bundling стосується лише optional runtime artifact; production-модулі не залежать від DEV і не читають `window.spine`. [Офіційний package.json, 4.2](https://raw.githubusercontent.com/EsotericSoftware/spine-runtimes/4.2/spine-ts/spine-webgl/package.json), [MDN: module specifiers](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules#importing_modules_using_import_maps).

**Packaging validation перед ввімкненням реального bundle**: exact dependency pins/lockfile; збережені copyright/license notices; повторювана генерація; AST перевірка emitted ESM, exports/imports і відсутності непередбачених globals; Architecture + Quick + Full; Pages release перевірка з bundle та зі stub; браузерний smoke на `file-not-found`, disabled-WebGL і representative export. Жодних whitelist/ignore/baseline винятків для проходження перевірок. Literal reference дозволяє чинному release graph включити package-module.

**Невизначене без блокування spec**: кандидат authoring/runtime-line — `4.2`; exact patch/package pin не обрано і не означає `latest`. Під час реалізації звірити вибрану версію Spine Editor, реальний representative export та той самий `major.minor` runtime. Різні `major.minor` несумісні; patch runtime не зобов'язаний дорівнювати patch Editor. [Офіційний versioning guide](https://esotericsoftware.com/spine-versioning).

Перед фактичною інтеграцією перевірити чинну Spine Editor license для integrator та включити runtime-license у матеріали продукту. Trial не надає integration/distribution rights; встановлення npm-package саме по собі їх не надає. Факт наявності ліцензії в проєкту зараз не встановлено; це gate інтеграції, не причина зупиняти проєктування preloader. [Spine Editor License, section 2](https://esotericsoftware.com/spine-editor-license#s2), [Spine Runtimes License](https://esotericsoftware.com/spine-runtimes-license).

## 8. Spine-atlas є комплектом із залежностями

**Рішення**: tier Spine складається з відповідного `.atlas`, усіх його page-images і сумісних skeleton-data. Dimension-tier створювати штатним Spine export/texture packer із scale-settings. Звичайний image-converter у першій версії лише інвентаризує Spine-pages і не resize/recompress їх як незалежні картинки. Точне розташування page-files визначає metadata, не припущення з суфікса.

**Причина**: `.atlas` містить page-size/name/PMA і pixel bounds, rotation, offsets та original-size для regions. Зміна PNG без узгодженого atlas порушує прив'язку. Spine packer генерує окремий atlas для кожного scale; alpha-workflow експортера та renderer має збігатися. [Spine atlas format](https://esotericsoftware.com/spine-atlas-format), [Spine texture packer](https://esotericsoftware.com/spine-texture-packer).

**Runtime-loading**: не використовувати некерований atlas-loader як є. Офіційний `AssetManagerBase.loadTextureAtlas()` сам запускає page-image loads циклом, обходячи зовнішній concurrency-limit. Наш preloader керує всіма fetch/decode залежностями; platform-adapter передає готові bytes/images у runtime `TextureAtlas`/`page.setTexture`. [Офіційний AssetManagerBase, 4.2](https://raw.githubusercontent.com/EsotericSoftware/spine-runtimes/4.2/spine-ts/spine-core/src/AssetManagerBase.ts), [Офіційний TextureAtlas, 4.2](https://raw.githubusercontent.com/EsotericSoftware/spine-runtimes/4.2/spine-ts/spine-core/src/TextureAtlas.ts). Ці API ще раз звірити з snapshot обраного exact package pin.

**Upgrade**: новий tier показувати тільки після повної готовності candidate-group; помилка залишає попередній tier. Для Spine потрібна перевірена передача visual playback-state/skin і відсутність повторних events; не обіцяти просту заміну PNG при перепакованих regions. Це integration-validation на реальному export, не вже підтверджена можливість CyberFishing.

**Lifecycle**: офіційний `GLTexture` утримує backing image для re-upload під час context restore. Тому lifetime image-handle має включати активні Spine textures; не закривати `ImageBitmap` одразу після upload. Shared textures не dispose, поки вони потрібні іншим consumers. [Офіційний GLTexture, 4.2](https://raw.githubusercontent.com/EsotericSoftware/spine-runtimes/4.2/spine-ts/spine-webgl/src/GLTexture.ts).

## 9. Конвертація — локальний DEV workflow

**Перевірено в repository**: `utils/convert-images.js` — Node/CommonJS interactive CLI з eager `require('sharp')`, скануванням усього project-root, in-place recompression та можливістю переміщення оригіналів. `sharp` уже оголошений у `devDependencies`; це не browser-library.

**Рішення**: відокремити metadata/inventory та job-control від lazy-loaded converter. Локальний DEV UI показує фактичну відносну структуру папок, розмір і dimensions; користувач обирає конкретні файли й profiles. Якщо converter відсутній, каталог і гра лишаються працездатними. Кнопка підготовки встановлює лише відомі pinned project dependencies локальним helper-процесом; браузер не запускає довільні shell-команди чи npm-install у клієнта.

**Рішення щодо результатів**: variants створюються з authoritative originals у керованих output-paths без видалення originals. Runtime отримує явний generated manifest із logical IDs та tier/format/path mapping; suffix — домовленість build-tool, не lookup у frame-loop. Існуючі назви/path можна відобразити metadata без масового перейменування. Manifest публікується тільки після перевірки outputs і collision/overwrite policy.

Sharp розділяє encoder-output options та `resize`. Зберігати aspect ratio і прозорість; profile має окремо містити pixel-scale та encoder-quality. [Sharp output options](https://sharp.pixelplumbing.com/api-output/), [Sharp resize](https://sharp.pixelplumbing.com/api-resize/), [Sharp installation](https://sharp.pixelplumbing.com/install/).

## 10. Що треба підтвердити реалізацією

- Representative Spine export: вибрана line/patch, meshes/clipping/tint/PMA, atlas variants, playback continuity, context loss/restore та cleanup.
- Packaged runtime: справді проходить чинні architecture/release checks без globals та bare imports; stub і bundle працюють на Pages subpath.
- Startup grouping: фактичний мінімум ресурсів поточного CyberFishing екрана; майбутнє анімоване лоббі ще не є реалізованим consumer.
- Бюджети та concurrency-defaults: вимірювання на погоджених browser/device profiles. Числа у плані є стартовою політикою, не доведеними hardware limits.
- Visual regression: low/high з однаковою композицією, aspect ratio, alpha і logical geometry; failed candidate не створює flash/blank-frame.
- Реальна економія: cold/warm-cache network bytes, time-to-usable-screen, frame/decode stalls і decoded/GPU estimates окремо; функціональні тести scheduler із fake transport/clock без браузерних APIs.
