# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.46.29 - Free Moving-Zone Placement

- Dynamic bodies translate continuously in the editor. Fresh locations choose random grid-aligned starts inside movement bounds; editing retains exact positions and gameplay RNG stays independent.

## v0.46.28 - Whole-Zone Movement Bounds

- Moving zones bounce with their full body inside their allowed area. In DEV, click a body to edit its movement bounds; body and area move/resize edits keep containment and use the same config/export path.

## v0.46.27 - Edit the Live Zones

- DevTools Zones groups category editing and visibility controls, draws each moving zone only once at its current position, pauses it for editing, and resumes from the edited position. Config edits preserve current positions; design rules require intuitive, unambiguous interaction.

## v0.46.26 - Explain Blocked DevTools Switches

- Dependent switches reject activation while a declared prerequisite is off and outline the blocker for three seconds or until enabled. Editable zones and depth numbers require the editor; visibility and grids stay independent.
