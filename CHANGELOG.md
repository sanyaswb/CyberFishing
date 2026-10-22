# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.46.25 - Consistent DevTools Tree Order

- Every DevTools section shows direct controls first, nested sections next and its description last, preserving keyboard order and partial refresh behavior.

## v0.46.24 - Independent Zone Visibility

- DevTools: show zones without editing, toggle all zone categories together, and keep the map and perspective grids mutually exclusive with synchronized switches.

## v0.46.23 - Editor Controls at the Top

- DevTools «РЕДАКТОР»: location is the first dropdown, followed directly by the editor controls; removed the nested location and editor disclosures.
