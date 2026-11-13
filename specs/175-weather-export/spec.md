# Spec 175 — Експорт, імпорт, скидання та застосування параметрів погоди

Статус: 2026-11-13 — узгоджено рішення власника Q1–Q2, реалізовано TK-286 (`v0.50.94`); чекає перевірки власника.
Правила: AGENTS.md, DEVELOPMENT_RULES.md (одна відповідальність, композиція, DEV не в production),
DESIGN_RULES.md, utils/UTILS_RULES.md.

## 1. Запит власника (2026-11-13)

«подивися логіку збереження експорту параметрів в редакторі для зон, потрібно використати таку ж логіку для
експорпту параметрів погоди».

Відповіді власника:
- **Q1 (склад експорту):** «Обидва блоки разом: «Вигляд дощу» (`CONFIG.canvas.rain`) і «Параметри локації» (`MAP_DB.<id>.weather`)».
- **Q2 (формат і команда):** «Один об'єднаний файл `weather-<локація>-...json` і одна команда `npm run apply:weather -- <файл>` (оновлює лише ті модулі, що змінилися)».

## 2. Поточний стан (v0.50.93)

- `WeatherDevSection` (`src/dev/tools/weather_dev_section.js`) редагує два дерева налаштувань у сесії, але не має
  стану щодо коду, експорту, імпорту, скидання до коду та CLI-команди `npm run apply:weather`.
- `CONFIG.canvas.rain` задано вбудовано в `src/game/config/runtime/game_config.js` (глобально).
- `MAP_DB.<id>.weather` задано вбудовано в `src/game/config/raw/locations/location_database.js` (на локацію).
- `ZoneEditorSection` + `src/dev/location/zone_export_format.js` + `utils/apply-zones.js` + `utils/apply-module-helpers.js`
  + `ExportCommandNotice` (`DevToolsUI.showExportCommand`) уже реалізують повний цикл для зон.

## 3. Рішення та модель

### D1. Авторизовані модулі даних (pure data-only)
1. `src/game/config/raw/weather/rain_settings.js` — `export const RAIN_SETTINGS = { ... }` у канонічній формі.
   `src/game/config/runtime/game_config.js` імпортує `RAIN_SETTINGS` і підключає `canvas.rain: RAIN_SETTINGS`.
2. `src/game/config/raw/locations/weather/test.js` — `export const WEATHER = { ... }` у канонічній формі.
   `src/game/config/raw/locations/location_database.js` видаляє вбудований блок `weather` (як і `zones`),
   а `src/game/config/databases/location_catalog.js` приєднує `LOCATION_WEATHER` (`test: TEST_WEATHER`).
3. `utils/checks/gameplay/weather-check.js` читає `MAP_DB` з `location_catalog.js` (де вже приєднано `weather`).

### D2. Канонічний формат файла (`src/dev/weather/weather_export_format.js`)
- Формат: `format: "cyber-fishing/weather"`, `formatVersion: 1`, `gameVersion`, `locationId`, `exportedAt`,
  `baseHashes: { rain, locationWeather }`, `rain: canonicalRain(...)`, `locationWeather: canonicalLocationWeather(...)`.
- Назва файла: `weather-<locationId>-v<version>-<yyyymmdd-hhmm>.json`.
- Канонізація: рекурсивне сортування ключів об'єктів і очищення двійкового шуму (`toPrecision(12)`), тому SHA-256
  (`rainHash`, `locationWeatherHash`) і згенеровані модулі не залежать від порядку ключів.
- Валідація (`validateWeatherFile`):
  - Перевірка конверта (`format`, `formatVersion`, відома `locationId`, валідні `baseHashes`).
  - Перевірка `rain` за шаблоном і межами `config_schema_validator.js` (`#validateRainConfig`).
  - Перевірка `locationWeather` за шаблоном та обмеженнями моделі погоди (невід'ємні ваги та затухання,
    діапазони `[min, max]` тривалостей/інтенсивностей/дистанцій, валідні фази туману, пороги `0…1`).

### D3. UI у DevTools (`WeatherDevSection` + `DevTools`)
У секції «🌧 ПОГОДА» додається підсекція «Збереження» (як у `ZoneEditorSection`):
- **Видимий рядок стану** (`createTextRow("Стан погоди", ...)`): порівнює живі значення `CONFIG.canvas.rain` і
  `CONFIG.locations.map[id].weather` з `baseConfig`: «Погода збігається з кодом.» або «Змінено (ще не в коді): ...».
- **«Експорт погоди»**: рахує `baseHashes` для `baseConfig`, генерує й завантажує `weather-<id>-...json`, оновлює
  статус і показує вгорі «Збереження» блок `ExportCommandNotice` із командою `npm run apply:weather -- <файл>` та
  кнопкою копіювання.
- **«Імпорт погоди»**: відкриває `.json`, перевіряє `locationId` і `validateWeatherFile`, записує канонічні `rain` і
  `locationWeather` через `updateConfig` (`CONFIG.canvas.rain` і `CONFIG.locations.map[id].weather`) та оновлює секцію.
- **«Скинути зміни погоди до коду»**: видаляє сесійні override-ключі для `canvas.rain` і `locations.map.<id>.weather`
  через `configRuntime.reset(...)`, публікує `config-updated` і оновлює секцію.
- **Опис** (`createInfoRow("Збереження", ...)`): коротке пояснення експорту, `npm run apply:weather`, імпорту й скидання.

### D4. Скрипт перенесення в код (`utils/apply-weather.js`, `npm run apply:weather`)
Використовує спільні кроки `utils/apply-module-helpers.js`:
- Приймає `npm run apply:weather -- <file.json> [--yes] [--force]`.
- Шукає файл у поточній теці або `Downloads` (`resolveExportedFile`).
- Валідує JSON, формат і значення (`validateWeatherFile`).
- Визначає, які модулі реально змінилися відносно коду (`rain` -> `rain_settings.js`, `locationWeather` ->
  `locations/weather/<id>.js`):
  - Якщо обидва збігаються з кодом -> `"unchanged"`.
  - Для кожного зміненого модуля: перевіряє `isDirty` (не приймає незбережених правок), перевіряє `baseHashes`
    відносно хешу поточного коду (конфлікт без `--force`).
- Друкує diff (`зараз -> буде`) по кожному зміненому модулю, питає підтвердження (`--yes` пропускає).
- Для кожного зміненого модуля робить бекап у `.git/cyber-fishing-backups/weather/` (локальний час) і перезаписує
  модуль канонічним JS-текстом; незмінений модуль не чіпає і не бекапить.
- Після запису запускає `config-schema` та `weather` (`game-cycle` при зміні погоди локації/загалом: `["config-schema", "weather", "game-cycle"]`).

## 4. Перевірки
- Автоматичні: `apply-weather` (`utils/checks/tooling/apply-weather-check.js`) + перевірка UI `WeatherDevSection`
  (експорт, імпорт, скидання до коду, статус, `ExportCommandNotice`), `config-schema`, `weather`, `npm run check`.
- Перевірка власника в браузері (візуально агентом не перевірялося).
