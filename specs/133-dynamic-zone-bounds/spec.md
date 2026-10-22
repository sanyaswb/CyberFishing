# Feature Specification: Editable movement areas and whole-zone containment

**Feature Branch**: `develop` (existing working tree)
**Created**: 2026-10-23
**Status**: Implemented in v0.46.28; owner visual acceptance pending
**Input**: Click a moving zone to edit its movement area; bounce the whole body at the area's edge; keep manual edits inside it.

## User Scenarios & Testing

### User Story 1 - Select and edit the movement area (Priority: P1)

A developer enables dynamic editing, clicks a zone, and can drag/resize its own movement area using visible handles. Other zones' movement areas are not made editable by this click.

**Independent Test**: Select a moving body and drag a boundary edge/corner/middle. Verify the corresponding bound changes through normal zone overrides and remains around the body.

**Acceptance Scenarios**:

1. A pointer press anywhere inside an editable dynamic body selects it and exposes its movement-area handles. Its normal move/resize gestures remain available.
2. The selected body's hit region wins over its own overlapping movement area; movement-area handles win over unrelated static zone interiors.
3. Clicking another body switches the editable movement area. Leaving editing/location or resetting/importing clears that selection.
4. Boundary changes snap to the map grid, respect the existing window movement contract and cannot exclude or become smaller than their current body.

### User Story 2 - Bounce by the body's edge (Priority: P1)

The moving rectangle stays wholly within its allowed area and changes direction when its edge reaches the boundary.

**Independent Test**: Fixed velocity/clock, every edge and corner, exact contact, large time steps and a zone initially partly outside its bounds.

**Acceptance Scenarios**:

1. A rightward body reaches the right boundary with its right edge, not its centre; horizontal speed reverses, vertical motion is retained.
2. Corners reflect both axes, and large steps never leave any part outside the current allowed rectangle.
3. A valid-sized body initially outside a region is clamped into the nearest fitting region before moving. A body that cannot fit any region stays still until its data is corrected; it is never silently resized by runtime physics.

### User Story 3 - Manual edits obey the same area (Priority: P2)

Moving or resizing the paused body cannot place any part beyond its movement area. Dragging the whole body also retains existing window limits.

**Independent Test**: Drag every edge/corner and the middle past the area's boundaries, including an off-grid starting position; verify containment, snapping and minimum size.

### Edge Cases

- No bounds means unrestricted movement; an empty bounds list means no allowed movement.
- Multiple rectangles remain separate allowed regions, never one enclosing bounding box. A body must fit wholly inside one of them; runtime reflects inside its current containing rectangle rather than jumping across a gap. Editing another disjoint region does not move it around the current body; the currently containing region must continue to contain the body.
- A selected zone with no bounds has no invented area; existing configuration editing remains available.
- A bound larger than the viewport keeps the existing sliding/window coverage behavior. Area resizing may not exclude its body, even when pointer travel exceeds the screen.
- A valid change that has no feasible snapped displacement stays at its current value; no conflicting constraint is silently ignored.

## Requirements

### Functional Requirements

- **FR-001**: Expose movement-area editing only after selecting its live body while dynamic editing is enabled; preserve spec 132 pause/resume and one live body.
- **FR-002**: Movement-area hover, drawing and hit testing use the same accepted bounds, with outlines/handles distinct from the body, and clear lifecycle ownership.
- **FR-003**: Runtime containment tests the entire body's rectangle and reflects at edges, retaining configured speed magnitude and fixed-clock determinism.
- **FR-004**: Body movement/resize must remain inside an allowed movement rectangle; movement also remains within the existing window contract.
- **FR-005**: Movement-area edits must continue to contain their body. Accepted writes use the existing zone config/export path and retain other zones' live positions.
- **FR-006**: Shared rectangle containment math must serve runtime and DEV editing without a production import of DEV.
- **FR-007**: This is an explicitly requested gameplay correction as well as a DEV change; record the centre-versus-edge defect in gameplay backlog and rebaseline only if game-cycle output actually changes.

### Key Entities

- **Moving body**: authoritative live x/y/w/h from the map.
- **Movement rectangle**: one authored bounds entry with design-cell coordinates.
- **Selected area owner**: the selected dynamic zone whose bounds are currently editable; no copied gameplay position.

## Success Criteria

- **SC-001**: Every tested update leaves the whole valid-sized body within its allowed rectangle, including exact contact and large steps.
- **SC-002**: Pointer movement/resize and accepted numeric geometry edits cannot enlarge or move a body beyond its movement area.
- **SC-003**: Clicking one body exposes only its area's handles, and switching/closing leaves no stale drag target or input capture.
- **SC-004**: Bounds edits round-trip through the existing export/import workflow; unrelated live zones retain their positions.

## Assumptions

- "Click" selects the bounds on pointer press without waiting; drag still operates immediately. Mouse, touch and pen share this interaction.
- The selected containing rectangle is the editing constraint for a gesture; if several contain the body, the first configured rectangle wins.
- The owner checks dev.html on desktop and phone in both orientations: select body, drag bounds and body, inspect edge/corner bounce after resuming. No agent visual acceptance, commit or push.

## Implementation and verification

- Original defect reproduced before the fix: x=8, w=2, right limit 10, fixed 100ms step produced right edge 10.1 with positive speed.
- Shared engine rectangle containment/container selection serves DynamicZone, DEV drag and accepted numeric edits. Runtime reflection now uses the full body's legal top-left interval, handles exact contact and large steps without allocations, and retains existing RNG scheduling.
- Pressing an editable live body selects its bounds; geometry draws only that area's handles and its own hover fill. Area edge/corner/middle edits use existing snapping and config writes. Body movement intersects window/region limits; resize remains contained; changing the containing area cannot exclude the body. Disjoint regions are preserved.
- Numeric command projection constrains geometry too; normalized values synchronize back to their original controls. The selected area context clears on editor/category/location/reset lifecycle.
- Extended existing zone-editor scenarios cover the pre-fix overflow, all edges and corners, exact contact, large steps, invalid-size recovery policy, disjoint regions, click selection, area edge/corner/middle edits, body movement/resize, numeric edits and selection transfer/cleanup.
- Full 66/67: Architecture/Quick, config runtime and game-cycle passed. Game-cycle report unchanged, so no rebaseline. Only the existing committed lobby PNG fails pages-release.
- Cleanup: removed the centre-only containment closure and its movement branch; no obsolete tool, fixture, vendor file or dependency remains from this change. No browser/phone visual or performance check, commit or push.
