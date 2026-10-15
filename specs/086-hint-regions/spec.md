# Hint regions and the inventory grid regression

Owner report and decision, 2026-10-15.

## G-061: equipment and keepnet sections collapsed on phones (regression of spec 080)

Measured at 320 × 640, portrait (in-app browser, JS layout readings): the main area was 58 px tall in the equipment
section (the equipment container 0 px, the tab bar at the top) and 306 px in the keepnet section (the fish list cut to
162 px); the backpack looked right (554 px) only because its list sets its own height.

Cause: the open inventory modal is a grid with `grid-template-rows: auto auto minmax(0, 1fr)` for its three children
(header, warning, main). Spec 080 moved the warning into the main area, so the modal kept three tracks for two
children and the main area landed in the second, content-sized track. The equipment container (a size container since
spec 078) has no content height and collapsed. Forcing two tracks in the browser restored 554 px for both sections
and the tab bar at the bottom.

Lesson, now in DESIGN_RULES: a grid template describes the container's children; moving a child in or out of a grid
container updates its row/column templates in the same change. The inventory UI check compares the modal's row tracks
with its children.

## Hint regions (replaces the overlay placement of spec 080)

The owner's container rule means: a hint does not float over the screen or other windows; it has its own region and,
when it appears, pushes the other elements down. The region sits at the top, above the header with the switchers,
because text is read top to bottom. With no hint it has no height; a shown hint uses the current design's spacing.

- Inventory: `inventory-modal__hints` is the modal's first row (`auto`), above the header host; then the header
  (`auto`) and the main area (`minmax(0, 1fr)`), three tracks for three children. The warning and the keepnet help
  (`KeepnetSectionView.helpNode`, placed by its host: `InventoryUI.attachKeepnetSection`) live there. While a hint is
  shown the region adds `--inventory-container-gap` below it (in portrait, where the full-screen container has no
  outer padding, around it on the top and sides); a hint is at most 30 % of the screen height and scrolls inside.
- House: an empty `house__hints` region under each sheet's handle and under the header's control row. A notice about a
  sheet action takes the open sheet's region; any other notice takes the header's region and reveals the header
  (`HouseNavigationController.revealHeader`). The region adds the sheet's heading spacing (14 px) or 12 px under the
  header row while it shows a notice.
- The overlay placements of spec 080 (absolute warning in the main area, absolute keepnet help, sticky/absolute House
  notice, `--house-layer-notice`) are removed. The shared `ui-hint` look, tones and close button stay.
- UI catalog: the keepnet preview places the help above its two halves.

No gameplay, save or formula changes.

## Verification

Inventory UI (hint region first, three children for three row tracks, warning in the region, CSS has no overlay
placement), keepnet (help placed by its host, removed on dispose), House (sheet and header regions, header revealed,
close, error tone), UI catalog, CSS usage, Architecture, Quick, Full. Owner checks the result on the published release.
