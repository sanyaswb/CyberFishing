# CyberFishing changelog

## v0.45.3 - Radial Inventory Selector

- Implement TK-008 alternative radial inventory selector in the toolbar: a quarter-circle SVG trigger and three annular sectors ("Екіпіровка", "Рюкзак", "Садок") based on the owner's design references.
- Preserve classic UI by default; add a live DevTools boolean switcher (`CONFIG.ui.inventorySelector.radialEnabled`) with schema validation, reset and export support that toggles modes immediately without reloading or losing state.
- Support desktop hover with transparent keep-open area, mobile press-and-drag with pointer capture and release selection, keyboard navigation (Enter/Space/Escape/Tab) and `prefers-reduced-motion`.
- Add UI catalog production preview for all selector states and interaction tests in `task-interactions-check.js`.

## v0.45.2 - Pending Tasks Cleanup

- Remove completed TK-001–TK-007 specifications and checked acceptance items from `tasks.md`; retain TK-008 and the three outstanding owner checks. Completed tasks are removed after implementation and automated verification.

## v0.45.1 - Full-Container Equip Feedback

- Extend TK-003.3 to the two success flashes after equipping: cover the entire field/editor tab, including the expanded active area and inset, with one rounded overlay. Preserve timing, reduced motion and one-time feedback; keep the owner's editor acceptance open (G-091).

## v0.45.0 - Camera-Edge Pointer Aim

- Restrict TK-002's centred 80px pointer lead to the corresponding location camera limit. Free camera travel uses raw pointer aim; reaching/leaving an edge is reflected after the pan step and on release. Reuse the projector's authoritative camera bounds for casting, recasting and hand chum (G-090).

## v0.44.1 - Phone-Only Notice Sheets

- Limit TK-001 bottom sheets to UI surfaces up to 820px; restore wide inventory/House top notices, full borders and original inline timers. Remove border-bottom only on phone sheets and prevent the empty top hint region from shifting mobile content. Resize safely switches the same notice between modes (G-089).

## v0.44.0 - Viewport-Centred Pointer Aim

- Amend TK-002: pointer aim recentres at the game viewport midpoint regardless of the initial contact. Keep the shared preview/edge-pan/release mapping and 100px smooth ramp, reduce the maximum lead from 100px to 80px, and preserve keyboard aiming and vertical power (G-088).

## v0.43.2 - Radial Inventory Selector Brief

- Document TK-008 in `tasks.md` with the owner's open/closed references: preserve classic UI, add a live DevTools mode switch, and define radial geometry, animated sectors, desktop hover retention, touch hold/move/release, accessibility and acceptance checks. Implementation is pending; gameplay is unchanged.

## v0.43.1 - Wide Inventory Section Swipes

- Complete TK-007: mouse/touch swipes on the wide backpack and keepnet switch sections directly, without selecting hidden portrait pages. Use the touched column's width for the gesture threshold; preserve editor and filter gesture ownership.

## v0.43.0 - Interaction Refinements

- Implement TK-001–TK-007: bottom notice sheets with drag dismissal, pointer aim lead, editor return routes and full-tab highlights, clipped sticky corners, reliable artwork swipes, bare-line rod speed and double-activation day/evening/night clocks.
- Track completed work and owner acceptance in `tasks.md`; preserve save formats and the game-cycle baseline.

## v0.42.3 - Implementation-Ready Task Briefs

- Replace `tasks.txt` with `tasks.md`: clarify TK-001–TK-007 against current code, with implementation boundaries, acceptance criteria, checks and explicit working assumptions. Gameplay is unchanged.

## v0.42.2 - Restore Original Scaling

- Restore the original sine/tangent visual scaling and 0°/30° location angles. Remove angle-dependent physical zoom and automatic fitting; keep the engine's 50 px/m base, the existing 30 m distance profile and gameplay settings (G-076, spec 113).
- Retain the DEV zone editor, metre grid, black background, readable angle/distance controls and export/import/reset; Overlay stays off by default.

## v0.42.1 - Independent Tilt and Length

- Location tilt and length can be tuned independently: projection scale fits automatically, using the same metric for physics, grid and rendering. Restore the test location's original 30° shore angle and 30 m far distance; compression starts at the lower green-zone edge (G-074, spec 112).
- DEV Overlay starts off by default and can still be enabled manually (G-075).

## v0.42.0 - Per-Location Water Tilt

- Each location can set `distanceProfile.tiltDegrees`: 90° looks down, 45° is oblique, smaller angles look lower along the water. The shared metric applies it to distances, movement, grid and area shapes; the rod keeps its screen scale. Existing profiles default to 90° (G-073, spec 111).
- The zone editor shows readable angle/distance controls, the minimum distance for the selected angle and export/import/local reset buttons. Incompatible edits are explained and rejected before changing config. Long DEV labels wrap instead of being cut off.

