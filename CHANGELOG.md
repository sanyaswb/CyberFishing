# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.51.27 - RANDOMIZER probes for rain, storm, fog and gusts (spec 180 stage F, TK-335)

- DevTools «Діагностика» → «РАНДОМАЙЗЕР»: «Дощ», «Шторм», «Туман» and «Пориви» run the game's own weather and wind models on the location's current settings — share of time, events per hour, length, peak strength, intervals and their spread; rain in and out of a storm, storms with lightning, gusts in clear weather, rain and storm.
- The report now shows right under «Запустити» (it was hidden in a closed section's description).

## v0.51.26 - «Конфіг» shows the whole CONFIG (spec 180 stage E, TK-334)

- DevTools «Конфіг»: every CONFIG group in the code's order with the code's keys — `debug` too; keys the game identifies data by (`id`, `name`, `icon`, `backgroundColor` …) are shown read-only. Only the catalogs merged into CONFIG stay in «Бази».
- Text lists (`input.keys.*`, `fog.phases`), empty lists and null values (`player.equipment.*Id`) now have rows in every config tree.

## v0.51.25 - Scene mode switch first in «СЦЕНА WebGL» (TK-333.1)

- DevTools «СЦЕНА WebGL»: the switch «Сцена WebGL (інакше все на 2D)» is the section's first parameter, above «ПОГОДА»; the WebGL context buttons and «↻ Оновити» stay at the bottom.

## v0.51.24 - Weather DevTools «Всі», live section marks, WebGL buttons at the bottom (TK-333)

- DevTools «ПОГОДА»: the selector is «Загальні | Всі | <locations>»; «Всі» shows the general and the location parameters together in every section (replaces the «Параметри локації» switch); export and reset with «Всі» take both levels.
- «ВИКИД» gets the emission screen's own switch; a section's «· змінено» mark and «↺ Скинути розділ до коду» appear right after an edit, without a redraw; in «СЦЕНА WebGL» the scene switch and WebGL buttons stand under «ПОГОДА» again.

## v0.51.23 - Weather export and apply for the general settings (spec 180 stage D, TK-332)

- DevTools «ПОГОДА» → «Збереження»: the file holds what the selector shows — «Загальні»: the rain, ash, storm and wind settings of every location; a location: its weather; a location with «Параметри локації» off: both. The status names every changed part of both levels and says when the export would leave some out; reset drops what the export holds.
- `npm run apply:weather` (file format v2; v1 files still apply) writes only the changed modules among `rain_settings.js`, `ash_settings.js`, `storm_settings.js`, `wind_settings.js` and `locations/weather/<id>.js`, with base hashes, backups and range checks shared with the config schema. Water and the emission screen stay in `game_config.js`.

## v0.51.22 - Adaptive width on by default in DevTools (TK-331)

- DevTools «Панель»: «Адаптивна ширина (ПК)» (`adaptiveWidth`) is now enabled by default (`PanelSettingsModule` and `DevToolsUI.setPanelOptions`).

## v0.51.21 - Immediate Weather DevTools redraw inside drill-in sections (TK-330)

- Weather DevTools: clicking «Викид: пік зараз», toggles, or action buttons inside drilled-in «Стан і керування» (or any drilled weather subsection) now refreshes the visible drill-in immediately via `DevToolsUI.preserveDrill`; `EmissionModel.force` also clears manual intensity hold when entering an active phase.

## v0.51.20 - Pink pulse on active DevTools «Змінені» button (TK-329)

- DevTools: while the «Змінені» filter is active, its button background pulses smoothly in pink so developers and testers immediately see why untouched parameters are hidden.

## v0.51.19 - Include cross-section changes inside DevTools «Конфіг» flat filter (TK-328.1)

- DevTools «Змінені» inside «Конфіг»: includes changed parameters owned by other sections (location weather under `CONFIG.locations.map.*`, `CONFIG.debug.*`, database catalogs) alongside `ConfigModule`, deduplicated into one continuous flat list without section or page headers.

## v0.51.18 - DevTools «Змінені» filter by owning module and flat «Конфіг» (TK-328)

- DevTools «Змінені»: outside «Конфіг», edited parameters show under the specialized module where they were changed (e.g., «Сцена» instead of surfacing the duplicate «Конфіг» tree above it); inside «Конфіг», «Змінені» shows only «Конфіг» changes as a flat list without sections; numeric lists (`numberList`) and custom weather/debug config rows now track changed state and resets.
