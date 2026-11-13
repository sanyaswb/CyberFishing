# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.50.109 - Overlay window close button right of scale slider

- TK-297 (owner): added a close button (`ui-modal-close debug-overlay__close`, `--ui-close-size: 28px`) right of the top scale slider on every overlay module window and `ACTIVE FISH` / `ACTIVE ROD` tool window; clicking it hides the window, disables its key(s) in `OverlaySettingsStore` (including composite modules), and syncs DevTools switchers via `OverlaySettingsStore.subscribe`.

## v0.50.108 - Overlay headers with rounded background & clean links

- TK-296.1 (owner): removed dotted underlines on `.debug-overlay__dev-link` and dashed divider borders in `overlay-content.css`; removed bottom borders on `.debug-overlay__heading` and gave overlay headings, tool titles, subsection titles and collapsible group `<summary>` headers rounded background pills (`overlay-content.css`, `overlay.css`).

## v0.50.107 - Overlay hyperlinks to DevTools parameters

- TK-296 (spec 177): added shared Overlay -> DevTools hyperlink infrastructure (`OverlayHtmlBuilder.devLink` / `OverlayModule.devLink`, `OverlayInteractionBridge` release activation without toggling parent `<details>`, `DevTools.revealParameter` / `DevToolsUI.revealPath`, and `DevToolsDependencyFeedback.showRevealed` green highlight across collapsed ancestor sections) and wired all parameters and multipliers in «ПОГОДА Й ХВИЛІ» (`WeatherOverlayModule` + `WeatherDevSection` control paths).

## v0.50.106 - Weather & waves overlay multiplier sub-items

- TK-295: in the DevTools «ПОГОДА Й ХВИЛІ» overlay module, moved wave multipliers from cramped inline formulas into expandable sub-items under `Амплітуда хвиль`, `Довжина хвиль`, and `Швидкість хвиль`, explaining each factor (`База`, `Загальний множник` + transition target, `Вітер`, `Ніч`, `Гроза`), its configured range, and its live value via pre-allocated `SeaStateResolver` / `WeatherStatusReader` factors.
