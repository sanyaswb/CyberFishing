# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.50.109 - Overlay window close button right of scale slider

- TK-297 (owner): added a close button (`ui-modal-close debug-overlay__close`, `--ui-close-size: 28px`) right of the top scale slider on every overlay module window and `ACTIVE FISH` / `ACTIVE ROD` tool window; clicking it hides the window, disables its key(s) in `OverlaySettingsStore` (including composite modules), and syncs DevTools switchers via `OverlaySettingsStore.subscribe`.

## v0.50.108 - Overlay headers with rounded background & clean links

- TK-296.1 (owner): removed dotted underlines on `.debug-overlay__dev-link` and dashed divider borders in `overlay-content.css`; removed bottom borders on `.debug-overlay__heading` and gave overlay headings, tool titles, subsection titles and collapsible group `<summary>` headers rounded background pills (`overlay-content.css`, `overlay.css`).

## v0.50.107 - Overlay hyperlinks to DevTools parameters

- TK-296 (spec 177): added shared Overlay -> DevTools hyperlink infrastructure (`OverlayHtmlBuilder.devLink` / `OverlayModule.devLink`, `OverlayInteractionBridge` release activation without toggling parent `<details>`, `DevTools.revealParameter` / `DevToolsUI.revealPath`, and `DevToolsDependencyFeedback.showRevealed` green highlight across collapsed ancestor sections) and wired all parameters and multipliers in «ПОГОДА Й ХВИЛІ» (`WeatherOverlayModule` + `WeatherDevSection` control paths).

## v0.50.106 - Weather & waves overlay multiplier sub-items

- TK-295: in the DevTools «ПОГОДА Й ХВИЛІ» overlay module, moved wave multipliers from cramped inline formulas into expandable sub-items under `Амплітуда хвиль`, `Довжина хвиль`, and `Швидкість хвиль`, explaining each factor (`База`, `Загальний множник` + transition target, `Вітер`, `Ніч`, `Гроза`), its configured range, and its live value via pre-allocated `SeaStateResolver` / `WeatherStatusReader` factors.

## v0.50.105 - Separate overlay windows with top scale slider

- TK-294: every active DevTools OVERLAY module now opens in its own lazily created, independently draggable window with persisted position and scale; removed −/+ buttons and replaced them with a top horizontal `role="slider"` bar (`0.3`–`3.0`) on every overlay and tool window.

## v0.50.104 - Weather section names

- TK-291.1 (owner): DevTools sections are named «ПОГОДА» and «ВОДА», the overlay «ПОГОДА й хвилі»; the weather and DevTools sources are reformatted. The scene checks read source shapes by meaning, not by line wrapping.

## v0.50.103 - DevTools lists

- TK-293 (spec 174 A7): every DevTools list (zone editor, Spine bone, wind direction) is the same list picker as Fixed Catch's fish instead of the browser's select; the field and its list sit under the label across the row.

## v0.50.102 - DevTools dependent parameters

- TK-292 (spec 174 A6): a DevTools parameter whose switch is off is inactive whatever its control (number, text, segments, list; a switch as before): it is dimmed and cannot be edited, an attempt highlights the switch that blocks it, and turning that switch on activates the rows at once. Dependencies: a config group's enabled switch (nested groups too), <name>Enabled for its <name>… siblings, locations.debugVisuals for the fight-area overlays.

## v0.50.101 - Weather in the scene section, live weather overlay

- TK-291 (owner): DevTools «ПОГОДА» now lives inside «🖼️ СЦЕНА WebGL»; «Стан моря» is split into «Звичайний стан» (calm, wind, night) and «Гроза»; a new overlay «ПОГОДА й хвилі» shows the storm, rain and fog strengths, the wind's direction and strength, the night and the waves' actual amplitude, length and speed in real time.

## v0.50.100 - Waves switch

- TK-290 (owner): DevTools «Хвилі» switches the waves off on their own: the water and the float are still, while the ripples of rain drops and the boat keep bending the water. Ripples keep the same size by day, at night and in a storm.
