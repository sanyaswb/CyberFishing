# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.47.7 - Compact UI Catalog

- The DEV UI catalog is a compact landing page: group tabs, one-line cards, frames resized by dragging their edge, readings at 0 / 50 / 100 %, no scrollbars and no explanatory text.

## v0.47.6 - Inventory Icons Without Preload Warnings

- The inventory warms its slot placeholder icons through the image loader instead of link preload in the page head, so the console no longer warns that they were preloaded but not used.

## v0.47.5 - Agent Workflow Rules

- AGENTS.md records the version, commit and push rules (patch per task, minor only with the owner's approval, push on command with Pages and task archiving) and working rules learned in practice.

## v0.47.4 - Test Location Zones Applied

- The test location's castable zone is the owner's edited one (11.7..29.7 cells with a painted mask); water-metric follows the authored water edges.
