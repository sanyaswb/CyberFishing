# Feature Specification: Zones stay in place when grid size changes

**Created**: 2026-10-23
**Status**: Implemented in v0.46.44; owner acceptance pending
**Release**: v0.47.0 (owner-approved minor release, 2026-10-23).
**Input**: Existing zones must be recalculated for a smaller grid while remaining in the same places.

## User Scenarios & Testing

### User Story 1 - Refine the grid without moving zones (Priority: P1)
The owner changes cell size to edit more precisely without changing the layout.

**Independent Test**: Compare map-space positions and extents before and after 40 → 30 → 20 → 40 changes.

**Acceptance Scenarios**:
1. Castable zones, obstacles, snags and movement bounds retain their exact map-space rectangles, including non-divisible dimensions.
2. Water clipping and the editor's contours agree after changing the grid.
3. Editing afterward snaps to the new cell size, while existing positions are not automatically snapped.

### User Story 2 - Keep live moving bodies in place (Priority: P1)
A moving zone keeps its current position, size and shape during grid changes.

**Independent Test**: Move a body away from its authored start, change cell size, then compare its position and next displacement.

**Acceptance Scenarios**:
1. A paused or moving body retains its current map position and diameter/side rather than returning to its authored start.
2. Changing grid size does not randomize positions or advance movement randomness.
3. Export retains authored design coordinates; editing a moving body afterward uses the applied map's coordinate scale.

### Edge Cases
- Non-divisible cell sizes and fractional authored coordinates must not round or collapse a small zone.
- Repeated shrink/grow cycles must not accumulate layout drift.
- Fractional geometry still produces valid integer-indexed gameplay/depth cells: every intersected cell is covered.
- Adaptive widths retain their existing screen-width policy; changing the raster must not move their viewport boundaries.
- Deleted IDs are not restored; newly added moving IDs use their authored position during refresh.

## Requirements

### Functional Requirements
- **FR-001**: Existing map-space geometry MUST be invariant under a grid-size change.
- **FR-002**: Moving bodies MUST retain live positions and continuous motion through this change.
- **FR-003**: Grid and depth data MUST rebuild for the new size without fractional array access or invalid dimensions.
- **FR-004**: Rendered water and zone contours MUST use the same coordinate basis.
- **FR-005**: Authored design coordinates and file compatibility MUST stay unchanged.
- **FR-006**: Future snapped edits MUST use one new cell; free body/float translation stays continuous.

### Key Entities
Authored zone: stable design-space geometry. Live map geometry: derived cell coordinates. Raster cell: integer gameplay/depth sampling unit. Live moving body: authoritative current position and motion.

## Success Criteria
- **SC-001**: Tested zone/map extents differ by less than 1e-8 map pixels after shrink/grow cycles.
- **SC-002**: Live moving positions and physical displacements are unchanged by the grid transition within the same tolerance.
- **SC-003**: All tested grid rebuilds, clipping, export and subsequent edit scenarios remain valid.

## Assumptions
- Existing production config defines a fixed design cell size (currently 40 px); changing it is outside scope.
- Cell-based physics still samples a raster; partial-cell coverage is derived from exact geometry, not a second authored shape.
- Fresh-page random placement remains as specified in spec 134; grid changes in an existing map do not select a new start.
- Owner checks dev.html, both orientations: several sizes including 30/17, all zone types/bounds, water edges, moving circles, next drag and export. Phone performance overlay remains an owner check. No agent visual check, commit or push.

## Implementation and verification

- LocationMap retains exact scaled rectangles; integer raster loops cover intersected cells. The applied cell size is stored alongside the built grid, independently of mutable config references.
- During grid changes live body positions, velocity and direction timer are rescaled by ID. Motion configuration uses the same design-to-runtime scale, including default speeds; no start/direction RNG is consumed by rebuilding the grid.
- Authored water clipping and diagnostic bounds use design cells. DEV geometry, dragging, command snapshots and depth cache use the applied map cell size while reload is pending. Adaptive movement bounds follow exact viewport edges, leaving integer columns for raster coverage only.
- Existing zone-editor scenario first failed before the fix on pending-resize command units. It now covers 40→30→17→20→100→40, static categories and depth/collision/snags, 5px geometry, circular live positions/bounds/speed, mask and annotation agreement, no RNG draws, unchanged authored geometry, next 20px drag and adaptive viewport edges.
- Focused zone-editor/config-runtime/game-cycle and Full 67/67 passed, including Architecture/Quick. Baselines/guards unchanged. No obsolete utilities, fixtures, vendor files or dependencies were introduced or replaced; cleanup completed.
- Owner visual and phone performance checks remain pending; no commit or push.
