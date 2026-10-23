# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.46.39 - One Look for the Fishing Zones

- The game's fight-area zones take the editor's look (colours, thin solid outlines); with the equipment's values the editor's float anchor sits on the real float and moves it while waiting, within the line's reach.

## v0.46.38 - Float Stays on the Water

- Location editor: the conditional float stays on the water when the equipped line is longer than it.

## v0.46.37 - Fishing Zones from the Equipment

- Location editor: "Брати значення зі спорядження" takes the line length and the net from the game's equipment for the fishing zone previews.

## v0.46.36 - Show Switches Redraw

- Location editor: fishing zones show at once and without the editor (editing still needs it); switches that need a parent (overlay master, editor, the zone shown) are blocked and name it; previews start at the canvas middle while no cast moved the rod.

## v0.46.35 - Fishing Zones Tab

- Location editor: Зони риболовлі — line length and a conditional float for the fight sector and line radius, hand chum zone, test chum zones that look like real ones.

## v0.46.34 - Zones Measured from the Castable Area

- Location editor: the game's overlays measured from the castable bottom edge live in its list and preview the real values; hand chum's far line and the half-circles' anchors are dragged like zones; net and fish are chosen from lists.

## v0.46.33 - Lobby Background in WebP

- The lobby background ships as WebP (15.4 MB PNG -> 0.56 MB); the PNG master moved to asset-sources.

## v0.46.32 - Water Only in Castable Zones

- The water animates only inside the castable zones: with several zones a mask clips it and the waves fade at each zone's edges.

## v0.46.31 - Selected Zone Input

- Zone hover and editing follow the selected number in each category. Other bodies cannot steal the selection; changing it clears hover and cancels stale dragging, with an additional ID check for moving zones.

## v0.46.30 - Moving-Zone Shapes

- Choose Circle or Square before adding a moving zone, or change the selected body shape. Circular contours, uniform resizing and numeric diameter edits agree across WebGL, Canvas and pointer input; export/import and apply:zones preserve shape while legacy rectangles remain compatible.
