# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.47.11 - Zones Snap to the New Grid

- Location editor: turning on a category's editing (or changing the cell size while editing) moves its zones onto the current grid, so they snap to the new cells; other categories keep their exact geometry.

## v0.47.10 - Catalog Rows and Viewport Triggers

- The UI catalog shows every element of a tab alone in its own centred row, without frames or backgrounds; 320 / 820 / 2560 triggers in the header lay the elements out at that size, and switching a tab removes the others from the page.

## v0.47.9 - Catalog Blocks One at a Time

- The UI catalog shows one centred 320 x 640 window at a time through a second tab level; inventory blocks (left panel, tabs, filters, list, header) are cropped from the whole inventory, and the keepnet is its section.

## v0.47.8 - Shorter Catalog State Lists

- Each UI catalog card offers 3-5 main states instead of up to 15.
