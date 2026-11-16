# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.51.34 - Player buffs and debuffs: the status architecture (spec 181 stage A, TK-341)

- The vodka and the gas mask are player statuses described in `CONFIG.statusEffects` (duration, stacking, modifiers — the shares of the emission's darkening, blur and pulse rate that stay); the gas mask in its slot holds its status. Behaviour as in v0.51.33.
- DevTools «ПОГОДА» → «Стан і керування» → «статуси» lists the active ones with their time left; the descriptions are editable in «Конфіг» → statusEffects.

## v0.51.33 - Gas mask and vodka against the emission (spec 179 stage F, TK-340)

- The gas mask goes into its now unlocked slot: no darkening or blur during an emission, and casting is allowed.
- Vodka: open it in the backpack and press «Випити» — the emission's darkening and blur are half as strong for 10 minutes; another bottle renews the time; casting still needs a gas mask.
- Both come from the DEV shop for now (placeholder art); DevTools «ПОГОДА» → «Стан і керування» shows the protection and its time left.

## v0.51.32 - Geiger counter clicks with the radiation (spec 179 stage D, TK-339)

- A procedural Geiger counter beside the radiation's hiss: random clicks, sparse at low radiation and a crackle at the peak, silent below 5 %; it starts after the player's first touch and stays silent in a hidden tab.
- DevTools «ПОГОДА» → «РАДІАЦІЯ» → «Звук лічильника (загальне)»: on/off, volume, threshold, clicks a second, tone and click length.

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
