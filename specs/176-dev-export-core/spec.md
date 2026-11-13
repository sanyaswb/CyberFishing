# Spec 176 — Спільне ядро експорту, імпорту та застосування конфігів DevTools

Статус: 2026-11-13 — реалізовано TK-287 (`v0.50.95`).
Правила: AGENTS.md, DEVELOPMENT_RULES.md (одна відповідальність, композиція, без дублювання), utils/UTILS_RULES.md.

## 1. Мета (власник, 2026-11-13)

Після реалізації `TK-286` (експорт погоди) прибрати дублювання між трьома наявними експортами (`zones`, `radio`, `weather`),
зберігши 100% сумісність наявних форматів файлів, CLI-команд та перевірок (`apply-zones`, `apply-radio-sound`,
`apply-weather`, `zone-editor`, `radio-receiver`).

## 2. План спрощення (3 спільні шари)

1. **Спільний формат і перевірка канонічного JSON — `src/dev/tools/export/canonical_export_format.js`:**
   - `cleanNumber(value)` / `cleanCanonical(value, { sortKeys })` — прибирання двійкового шуму (`toPrecision(12)`) і
     рекурсивне сортування ключів.
   - `exportStamp(date)` та `formatExportFileName(prefix, version, date)` — єдине найменування `<prefix>-v<ver>-<yyyymmdd-hhmm>.json`.
   - `canonicalHash(value, hashText)` — спільний SHA-256 хеш.
   - `diffCanonicalObjects(before, after, prefix)` — плоский diff листів `[{ path, from, to }]`.
   - `collectTemplateIssues(template, candidate, path, errors, options)` — рекурсивна перевірка відповідності шаблону
     ключів/типів/масивів.
   - Споживачі: `src/dev/location/zone_export_format.js`, `src/dev/radio/radio_sound_settings_format.js`,
     `src/dev/weather/weather_export_format.js`.

2. **Спільний UI-контролер збереження — `src/dev/tools/export/dev_saving_section.js`:**
   - Клас `DevSavingSection` керує циклом підсекції «Збереження» / експорту: рядок стану (`setStatus`), кнопка експорту з
     завантаженням і `ExportCommandNotice` (`showExportCommand` зі збереженням `exportedFile` між перебудовами секції),
     кнопка імпорту з розбором JSON і валідацією, кнопка скидання до коду, рядок опису.
   - Споживачі: `ZoneEditorSection` (передає специфічні дії для зон та окрему фіксацію «Зони за межами мапи»),
     `WeatherDevSection` (передає дії для дощу та погоди локації), `RadioDevSection` (використовує спільний `showExportCommand`
     / генерацію експорту).

3. **Спільний виконавець CLI-застосування модулів — `utils/apply-module-helpers.js`:**
   - Додати `runModuleApply(...)` до `apply-module-helpers.js` (JSON parse, перевірка існування модулів, валідація,
     пошук змінених частин, перевірка `isDirty` лише на змінених модулях, виявлення конфлікту `baseHash` і `--force`,
     друк diff, запит підтвердження `--yes`, бекап у `.git/...` з локальним часом, перезапис і `runChecks`).
   - Споживачі: `utils/apply-zones.js`, `utils/apply-radio-sound.js`, `utils/apply-weather.js` зберігають публічні класи
     та контракти перевірок, але делегують цикл застосування одному спільному механізму.

## 3. Перевірки
- Прогін усіх наявних сценаріїв (`apply-zones`, `apply-radio-sound`, `apply-weather`, `zone-editor`, `radio-receiver`,
  `weather`, `config-schema`, `architecture`) і повний `npm run check`.
