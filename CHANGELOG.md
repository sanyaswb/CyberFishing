# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.51.31 - Radiation hiss over the scene (spec 179 stage D, TK-338)

- WebGL scene: fine flickering grain over the world, stronger as the location's radiation rises during an emission (none below 5 %); one noise tile made in code, no filter, no frames when there is no radiation.
- DevTools «ПОГОДА» → «РАДІАЦІЯ» → «Шипіння (загальне)»: on/off, threshold, opacity, speck size and pace, live.

## v0.51.30 - Radiation as its own weather section (TK-337)

- DevTools «ПОГОДА»: «РАДІАЦІЯ» under «ВИКИД» holds the manual radiation and the location's radiation levels; «ВИКИД» keeps the event, the freeze and the screen.

## v0.51.29 - Fog by the hour and after rain (spec 180 D17, TK-336)

- Fog lives in game time and comes likelier at 4–7 (×4) and 19–24 (×3) on the test location; every rain that ends raises its chance (+0.5, up to ×4) until a fog starts. Outside the windows fog stays possible, rarer.
- DevTools «ПОГОДА»: the fog's state shows its window and rain multipliers; the RANDOMIZER's «Туман» reports fogs in the windows and after rain.

## v0.51.28 - Weather selector starts at «Всі» and keeps its choice (TK-333.2)

- DevTools «ПОГОДА»: the selector opens at «Всі»; a choice of «Загальні» or a location stays when DevTools is closed and opened again (until the page reloads).

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
