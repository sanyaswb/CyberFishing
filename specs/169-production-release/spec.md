# Spec 169: prod-реліз без DEV

**Створено**: 2026-11-08 · **Статус**: рішення власника є, реалізація — у записі нижче · **Задача**: `tasks.md`, «Spec 169»
· **Джерело**: аудит [TK-255](../../docs/audits/2026-11-08-prod-readiness.md), P2-5, Q1.

## Рішення власника (2026-11-08)

> «Так реліз продакшн без dev версії лишаємо тільки для pages це важливо.»

- **D1.** Реліз для сервера (`npm run build:release`) — лише гра: без `dev.html`, DevTools, cheat-команд, оверлеїв,
  `src/dev/` та будь-якого DEV-коду.
- **D2.** GitHub Pages (`npm run release:pages`) лишається повним тестовим релізом, як зараз (index + dev, `?esm=1`, source
  maps).

## Технічні рішення агента

- **T1. Без `src/` і `vendor/*.js`.** У prod-релізі немає `?esm=1` (запуск вихідних модулів — інструмент налагодження), тож
  вихідні модулі, стилі-джерела й vendor-модулі не потрібні: усе вже в `build/`. Ліцензії `vendor/**/LICENSE` лишаються.
  Менше файлів — менше, що можна прочитати, і менший реліз.
- **T2. Source maps не публікуються.** Збираються `external` (без `sourceMappingURL` у бандлі) і пишуться лише за
  `--maps <dir>` поза публічною текою (для розбору помилок розробником); без опції — не зберігаються.
- **T3. Одна збірка, дві форми.** Prod-форма будується тим самим `ReleaseBundleBuilder`, але лише для `index.html`:
  esbuild читає джерела з тимчасової теки, у `--out` копіюється тільки те, що завантажує гра.
- **T4. Вимір на prod-формі.** `measure:startup --prefix root` міряє саме серверну форму (spec 157 R13).

## Склад prod-релізу

`index.html`; `build/` сторінки `index` (boot без гілки `?esm=1`, бандл, чанки, стиль, лічильник старту, маніфест старту),
без `.map` і без `index.esm-*.json`; `assets/`; `vendor/**/LICENSE`.

## Перевірки

- `pages-release`: prod-форма з HEAD — немає `dev.html`, `src/`, `vendor/*.js`, `.map`, графа `?esm=1`, рядків `src/dev`;
  boot не читає `?esm`; кожен відносний URL із `index.html`, boot і чанків є в релізі; Pages-форма без змін.
- `measure:startup --prefix root` — запуск і бюджети spec 157 на prod-формі.

## Приймання власником

Відкрити prod-реліз на сервері або локально (`npm run build:release -- --out <тека>` і статичний сервер): гра стартує,
`dev.html` немає. Pages — як раніше, з DEV.

## Реалізація

v0.50.48 (2026-11-08):
- `PagesReleaseBuilder.buildProductionRelease(outDir, { mapsDir })` (`utils/build-pages-release.js`): вхідні файли
  `index.html` у тимчасовій теці, `ReleaseBundleBuilder.build({ pages: ["index.html"], sourceFallback: false })`, у `outDir`
  — лише те, що вантажить гра. `sourceFallback: false`: без `index.esm-*.json`, boot лише імпортує бандл, source maps
  `external` (без `sourceMappingURL`).
- `npm run build:release -- --out <dir> [--maps <dir>]` будує prod-форму (`--maps` має бути поза релізом);
  `release:pages` без змін. `measure:startup --prefix root` міряє prod-форму (лише `index.html`).
- Розмір на 0.50.47-a11c8ac: **220 файлів, 23,4 MB** проти 1 187 файлів Pages-форми; DEV-коду в бандлах немає (лишились
  лише дані `CONFIG.debug` у конфігурації гри, неактивні через `InactiveDevFlags` — до cleanup spec 171).
- Вимір prod-форми: Fast 4G, CPU ×4, 3 холодні прогони — T-paint 148 мс, T-play **1 244 мс**, 0,44 MB, 32 запити.
- Перевірка `pages-release`: prod-форма з HEAD — немає `dev.html`, `src/`, vendor-модулів, графа `?esm=1`, `.map`,
  `sourceMappingURL`, `src/dev/`; boot без `?esm`; замкнений граф (13 URL сторінки, 35 відносних імпортів бандлів);
  карти лише в `--maps`. На старому коді падає (методу prod-форми немає).
- Документи: `docs/deployment.md` (дві форми, source maps), DEVELOPMENT_RULES (TypeScript roadmap, «Code»).
