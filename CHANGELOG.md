# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.50.99 - Rain stays with the world

- TK-271.2 (owner): rain drops and the rings they leave on the water stay where they fall in the location when the camera moves or the window is resized; a narrower window shows fewer drops at the same density instead of squeezing them all in («Крапель при силі 1» is now the rain over the whole rain area).

## v0.50.98 - Living waves

- TK-289 (spec 172 D7): the waves follow the weather: higher and faster with wind and travelling with it, calmer at night, much higher, longer and faster in a storm, changing over a few seconds; the float rocks with the same sea. They are no longer uniform: patches of higher and lower waves drift over the water, each wave component breathes on its own rhythm, longer waves travel faster.

## v0.50.97 - Line on the rod obeys the equipping rule

- TK-288: the line already on the rod (the starting equipment, older saves) now gets the same length rule as equipping it: the bamboo pole (5 m, no reel) holds 10 m of line and the other 15 m goes back to the backpack (it used to keep all 25 m and cast 24.8 m).

## v0.50.96 - Float depth 0.1 m is kept

- TK-192.1: a float depth the player sets to 0.1 m is kept (it used to turn into half the range on the next frame, so the cast fell from 25 to 15 m while the track still showed 0.1); before a choice the depth is half the current tackle's deepest depth, also at the game's start and after a tackle change.
