# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.51.17 - Weather DevTools: in-place groups, event switches (TK-327.1)

- DevTools «ПОГОДА»: inside a section every group opens in place (only a section opens inside); the location selector is buttons; rain, storm, fog and emission have switches (on starts a random event, off ends it) and the generated course shows on top; ВІТЕР lists what rain and storm do to the wind.

## v0.51.16 - Weather DevTools rebuilt (spec 180 stage C, TK-327)

- DevTools «ПОГОДА»: «Загальні» or a location on top with «Параметри локації»; «Стан і керування» with a slider for rain, storm, fog, emission, ash, wind, waves and current (moving a slider holds it), the rain's and ash's look at strength 100 under their sliders, action buttons at the bottom; sections ДОЩ, ШТОРМ, ВІТЕР, ТУМАН, ВИКИД, ПОПІЛ, ВОДА, ПОЧАТОК І ПОРОГИ with a «змінено» mark and a reset; the emission blur has five simple knobs; WebGL buttons at the very bottom.

## v0.51.15 - Weather settings structure (spec 180 stage B, TK-326)

- Weather settings: what the storm and the wind do is now the same for every location (rain chance and strength, drop slant and how smoothly it follows the wind, gust shape); rain and ash looks change with their strength between values at 0 and 100, with per-drop length and slant spread; the waves narrow across the screen only with their own perspective switch, and the current no longer moves them; DEV striped background for checking the waves.
