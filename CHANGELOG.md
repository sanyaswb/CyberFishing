# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.47.15 - Owner test zones in the code

- Test location: the owner's new castable mask and masked obstacle are in the code; the checks read the real zones (TK-086).

## v0.47.14 - Finer grid restores the zone shape

- Zone editor: snapping starts from the zones as they were before it, so after a coarse grid (160 px) a finer one gives the drawn shape back (TK-085).

## v0.47.13 - Delete a zone mask

- Zone editor: an applied zone mask can be deleted (Видалити маску), not only switched off; the zone keeps its shape (TK-084).

## v0.47.12 - Cell sizes that divide the map

- Zone editor: the cell size is chosen only from sizes that cut the location into whole cells (2560x1440: 5-160 px); a warning in the middle of the screen when the size does not fit (TK-083).
