# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.47.2 - Clean Zone Numbers

- Zone files and npm run apply:zones write 11.7 instead of binary-fraction noise like 11.700000000000001; a field the code lacks reads немає.

## v0.47.1 - Persistent Mesh and Server-Owned DEV Shortcut

- Reopening DevTools preserves the active painted mesh. A keyboard shortcut opens DevTools in DEV through local server validation; no code definition or offline matcher ships to the browser. Static Pages requires a backend for this shortcut.

## v0.47.0 - Zone Editor and Connected Masks

- Owner-approved minor release: connected local masks, exact gameplay boundaries and shore-clipped Pixi waves, with mesh focus, painting/erasing, host-field locking and independent mask opacity.
- Zone geometry stays put across grid-size changes; grid opacity is shared by cell, mesh and perspective grids. Editor controls and dependencies are simplified. Completed tasks move to the archive while owner acceptance remains pending.

## v0.46.46 - Mesh Editing Controls and Opacity

- Mesh editing disables host-zone fields and structural actions until exit/apply. A separate mask-fill opacity slider reveals the map texture; the editor grid-opacity control now applies to the cell, mesh and perspective grids together on Canvas/WebGL.

## v0.46.45 - Connected Zone Masks

- Ordinary zones support local x2/x4 meshes: LMB paints, RMB erases, and connected masks bake to compact JSON with inversion and exact gameplay boundaries. Mesh editing dims the rest of the viewport immediately. Pixi waves follow the applied water mask, keeping excluded shore still; depth stays unchanged. Masks survive grid changes and file round-trips.

## v0.46.44 - Zones Stay Put When Grid Changes

- Changing cell size preserves exact zone sizes and positions, live moving bodies and bounds. Water clipping uses design coordinates; grid/depth coverage rebuilds from exact geometry, and subsequent editing snaps to the new grid.

## v0.46.43 - Editor Grid and Unavailable Switches

- Turning the editor off also hides its grids. Switches blocked by dependencies look dimmed and expose their unavailable state, updating as prerequisites change while keeping the blocking-control highlight on attempted activation.

## v0.46.42 - Independent Depth Display

- Depth numbers and opacity work with editing off, retaining the cached map and the editing controls' prerequisites. Tasks now require archiving completed work before every push while retaining pending owner checks.

## v0.46.41 - Cell Grid Under Editor

- Cell-grid and depth controls sit directly after background visibility in the editor. Removed line-step and snap controls and their variable logic: grid lines and snapped editing use one map cell, while moving-body and float translation stay continuous.

## v0.46.40 - Fight Sector Stays Drawn

- The fight sector and the line radius stay drawn while a fish is on: built from the rod with the fight frame's radius.
