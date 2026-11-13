# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.50.99 - Rain stays with the world

- TK-271.2 (owner): rain drops and the rings they leave on the water stay where they fall in the location when the camera moves or the window is resized; a narrower window shows fewer drops at the same density instead of squeezing them all in («Крапель при силі 1» is now the rain over the whole rain area).

## v0.50.98 - Living waves

- TK-289 (spec 172 D7): the waves follow the weather: higher and faster with wind and travelling with it, calmer at night, much higher, longer and faster in a storm, changing over a few seconds; the float rocks with the same sea. They are no longer uniform: patches of higher and lower waves drift over the water, each wave component breathes on its own rhythm, longer waves travel faster.

## v0.50.97 - Line on the rod obeys the equipping rule

- TK-288: the line already on the rod (the starting equipment, older saves) now gets the same length rule as equipping it: the bamboo pole (5 m, no reel) holds 10 m of line and the other 15 m goes back to the backpack (it used to keep all 25 m and cast 24.8 m).

## v0.50.96 - Float depth 0.1 m is kept

- TK-192.1: a float depth the player sets to 0.1 m is kept (it used to turn into half the range on the next frame, so the cast fell from 25 to 15 m while the track still showed 0.1); before a choice the depth is half the current tackle's deepest depth, also at the game's start and after a tackle change.

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
