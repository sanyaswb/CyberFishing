# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.50.85 - No jump on the first press

- TK-279 (spec 173): pressing a zone that runs past the window (the test water below the screen) no longer pulls it up into the window; it moves only where it is dragged and never further out.

## v0.50.84 - Zones stay on the map

- TK-278 (spec 173): in a narrow window a zone wider than the window (e.g. a full 2560 px zone) could be dragged off the map; moving and resizing now stop at the map's edges (a zone already partly beyond them never goes further out).

## v0.50.83 - DevTools edge opens on hover again

- TK-274.1 (spec 173 F2): while editing zones, the cursor resting at the left edge (~150 ms) opens DevTools again; a cursor sweeping past, a held button or a zone editor gesture (drag, drawing, mask) never does; a press or a finger swipe still opens it; strip 16 px.

## v0.50.82 - Clip zones to the castable area

- TK-277 (spec 173 F3): every zone list but the castable one has «Обрізати по ігровій зоні»: the selected zone is cut to the water exactly on the castable mask's grid (a mask where the shore is ragged; separate pieces become separate zones); a moving zone's movement area is cut instead.
