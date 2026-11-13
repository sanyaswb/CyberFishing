# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.50.95 - Shared DevTools export and apply core

- TK-287 (spec 176): extracted shared canonical JSON/template/diff helpers (`canonical_export_format.js`), `DevSavingSection` UI controller (`dev_saving_section.js`), and `runModuleApply` (`apply-module-helpers.js`) shared by zones, radio and weather exports/CLI appliers.

## v0.50.94 - Weather export, import, reset and apply:weather

- TK-286 (spec 175): added zone-editor-style saving to DevTools «🌧 ПОГОДА» (live status vs code, JSON export with apply command notice, import validation, reset to code) backed by data modules (`rain_settings.js`, `locations/weather/<id>.js`) and `npm run apply:weather` (updates only changed modules with backups, conflict check and schema/weather checks).

## v0.50.93 - Tuned rain look and ring defaults

- TK-271.1 (spec 172 D): updated default `CONFIG.canvas.rain` values to match the owner's DevTools tuning (`lengthPx` 103, `widthPx` 6.3, `minScale` 0.4, `windSlantDeg` 34, `stormSlantDeg` 48, `rings.sizePx` 65).

## v0.50.92 - Test location zones inside the map

- TK-280.1 (spec 173): the test location's zones are the fixed ones in the code: the water, the fish school's area and the rain zone end at the map's bottom (36 cells; they ran to 38), so the zone editor no longer shows the red notice there.

## v0.50.91 - Command after a file export

- TK-285 (spec 174 A5): after a DevTools file export that is applied by a command (zones, the zone fix file, radio sound) a notice at the top of that section names the downloaded file and shows the terminal command with a copy button; a new export replaces it, the cross closes it. npm run apply:zones and apply:radio now find a bare file name in the Downloads folder, so the copied command works as it is.

## v0.50.90 - DevTools row lines

- TK-284 (spec 174 A4): the dashed line under every DevTools row (4 px below its row, 8 px above the next) is replaced by one thin solid line only between neighbouring rows, with equal space above and below; a section's last row has no line.

## v0.50.89 - DevTools list picker

- TK-283 (spec 174 A3): Fixed Catch's fish is chosen from a list (image, name, id; search by name or id; arrows, Enter, Escape) instead of typed; an id the game does not have stays visible and marked. Parameters with up to four values (inventory selector size and layout, delivery method, split side) show every option as a segmented switch instead of a button that cycles.

## v0.50.88 - DevTools number field

- TK-282 (spec 174 A2): DevTools number fields are a field with − / + buttons: the step follows the value's precision (0.1 -> 0.2, 0.25 -> 0.26, 40 -> 41), Shift steps ten times further, Alt a tenth; arrow up/down step, Enter writes, Escape restores; a decimal comma is accepted; text that is not a number is never written (it used to write 0); holding a button repeats.

## v0.50.87 - Typing in a field no longer steers the game

- TK-281 (spec 174 A1): a key pressed while a text field has focus (DevTools number and text fields) is left to the field: the arrow keys move the caret and the letters on the game's keys (A, D, W, S) can be typed; the rod, the drag and the pull no longer react to typing. Outside a field the keys work as before.

## v0.50.86 - Zones past the map: notice and fix file

- TK-280 (spec 173): the zone editor shows a red notice at its top listing every zone past the map (category, number, side and value); «Виправити» makes a zone file with every zone fitted into the map (masks keep their cells), «Завантажити» downloads it; the notice stays until the code has the fixed zones (npm run apply:zones).
