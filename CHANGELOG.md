# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.50.119 - DevTools module rail

- TK-304 (spec 174 C2): DevTools shows one module at a time from a rail of seven (Гра, Конфіг, Бази, Локація, Сцена, Діагностика, Сервіс); the chosen module and each module's scroll are remembered, an empty module says so, and a link from the overlay or a blocking switch opens its module first.

## v0.50.118 - DevTools icons

- TK-303 (spec 174 C1): DevTools draws its own outline SVG icons (panel button, section chevrons, root sections, navigation, warnings, export) instead of emoji and text arrows; colours come from --devtools-* tokens, labels use the system sans font and values stay monospace; the panel has an opaque background without blur (cheaper on phones).

## v0.50.117 - DevTools rows from one description

- TK-302 (spec 174 B1): every DevTools parameter row is built from one description (DevToolsUI.addParameter) with its own control class (switch, text, number list, slider beside the number, list, segments); the config tree uses it, the older row methods remain as thin bridges until stage E.

## v0.50.116 - DevTools panel modules

- TK-301 (spec 174 B3): every area of the DevTools panel is its own module (shop, overlay, config, debug, scene with weather, zone editor, database, Spine, radio, hooked fish, service) with one contract; DevTools keeps only the panel's lifecycle, navigation and module order. The panel looks and works the same.

## v0.50.115 - DevTools sections by place

- TK-300 (spec 174 B4): DevTools remembers open sections by their place, not their title (two sections with one title no longer open together); a new fish on the hook redraws only its sections, so the panel keeps its scroll and focus during a fight; a full redraw keeps the scroll too. Open sections are reset once.

## v0.50.114 - DevTools edit path split out

- TK-299 (spec 174 B2): DevTools' edit path (config overrides, catalogs, the hooked fish, events) and its config tree drawing are separate modules (DevConfigEditService, ConfigTreeRenderer, HookedFishEditSync, ItemStatAliasSync); the panel behaves the same.

## v0.50.113 - Rain gust slant impulse, default float wind compensation & live ITEM_DB float sync

- TK-298.2 (spec 178): forwarded `windGust` (`gustStrength`) into `WeatherRenderModelBuilder` and `PixiRainRenderer` so gusts add an extra drop-slant impulse and faster angle response even at `100%` wind; changed default `windCompensation` on `float_day`, `float_night` and `float_sliding` from `[0.1, 1.0]` to `[0.1, 0.65]` so floats visibly lean in wind out of the box; synced live `ITEM_DB` edits in `GameApplication.#handleItemDatabaseUpdate` directly onto the active `FloatEntity`/`WaterEntity` in water (`syncEquipmentStats`) and supported space/comma separators in DevTools array inputs.

## v0.50.112 - Wind model release/direction fixes, smooth float swing & always-visible map selector

- TK-298.1 (spec 178): restored automatic episode target immediately when releasing manual wind strength (`#episodeTarget`), kept positive wind strength across episodes while direction `±1` is forced (`strength === 0 ⇔ direction === 0`), made `WaterEntity` return-swing $C^1$-continuous across cycle boundaries with `maxAngleDeg` cap and `0` support, published live `float` settings from `WindModel` to `EnvironmentSystem.getPhysicsEnv()`, and kept the DevTools «ПОГОДА» location selector always visible.

## v0.50.111 - Living continuous wind, gusts, float return-swing & per-map DevTools chances

- TK-298 (spec 178): added `WindModel` (`0…1` real-second episodes, isolated `windRng`, rain/storm boosts, global gusts, `strength === 0 ⇔ direction === 0`) and `MAP_DB.<id>.weather.wind` schema/export support; coupled continuous `wind.strength` to `SeaStateResolver`, `PixiRainRenderer` slant and `WaterEntity` dynamic return-swing rock; added DevTools «ПОГОДА» location selector, `Шанси погоди`, manual wind strength / gust controls, and live `Сила вітру 0…1` overlay hyperlink.

## v0.50.110 - Weather overlay night link path & incident I-20

- TK-296.2 (owner): fixed the «Ніч 0…1» overlay link path in `WeatherOverlayModule` from `CONFIG.timePhases.night.startHour` to `CONFIG.spawns.timePhases.night.startHour` so DevTools expands and highlights `startHour` instead of the root `.devtools__section-title`; added `CONFIG` leaf traversal assertion in `weather-check.js` and documented incident `I-20` / rule `R20` with verification and troubleshooting steps in `docs/incidents.md`.
