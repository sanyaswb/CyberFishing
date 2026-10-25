# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.47.25 - Batteries power the bait boat

- Bait boat runs on a battery in its new slot: 5/7.5/10 min of motion per battery at levels 1/2/3, a third while waiting, nothing while idle; the charge is saved and only falls; one battery in the starting inventory and once for existing saves (spec 143).

## v0.47.24 - Aim lead in two edge zones

- Casting aim: a 200 px zone along each screen edge leads the line towards it, smoothly from 0 at the zone border to 80 px at its middle and up to the edge, at any width and always; replaces the camera-edge lead (TK-093).

## v0.47.23 - Game UI hides while aiming

- Casting aim: while a cast is aimed every game UI element (clock, fullscreen button, toolbar, version badge, DevTools button) fades out and returns on release; the split inventory stays (TK-092).

## v0.47.22 - No aim jump at the map edge

- Casting aim: when the camera stops at the map edge, the aim line stays under the finger and the lead grows smoothly from there, instead of jumping (TK-091).

## v0.47.21 - Cut and merged zones keep one shape

- Zone editor: a RMB cut keeps one shape (L, ring) and splits only pieces that fall apart; zones of a type that overlap or touch merge on release; other controls inactive while drawing; «Редагувати все» is a switch that restores (spec 141 R2).

## v0.47.20 - Draw new zones on the grid

- Zone editor: «Додати зону» draws new zones on the grid (LMB rectangle, RMB cut, dimmed where a zone cannot go), «Застосувати»/«Скасувати» (spec 141).

## v0.47.19 - All zones of a category

- Zone editor: «Всі» at the end of every category's «Номер зони» lets any zone of the category under the pointer be moved and resized (TK-090).

## v0.47.18 - All chum zones at once

- Zone editor: «Всі» at the end of «Номер зони прикормки» lets any chum zone under the pointer be moved and resized (TK-089).

## v0.47.17 - Game chum zones in the editor

- Zone editor: the game's own chum zones on the location are listed first in «Редагувати зони прикормки» (marked «гра») and can be moved and resized (TK-088).

## v0.47.16 - Edit everything button

- Zone editor: «Увімкнути» is now «Увімкнути редагування»; the «Редагувати все» button under it turns every editing switch on with the parents it needs (TK-087).
