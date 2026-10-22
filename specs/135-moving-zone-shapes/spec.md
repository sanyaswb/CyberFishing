# Feature Specification: Moving-zone shapes

**Created**: 2026-10-23
**Status**: Implemented in v0.46.30; owner visual acceptance pending
**Input**: Owner requests a separate circle/square parameter when creating moving objects.

## User Scenarios & Testing

### User Story 1 - Choose a shape (Priority: P1)
The owner chooses Circle or Square before adding a moving zone.

**Independent Test**: Create each shape and inspect its saved shape and independent identity.

**Acceptance Scenarios**:
1. Given the moving-zones section, choosing Circle then adding creates a circular moving body.
2. Choosing Square then adding creates a square body; old zones retain their dimensions.
3. Removing the last moving zone still permits creation of either shape with valid motion defaults.

### User Story 2 - Edit and retain shape (Priority: P1)
The visible, selectable body matches its chosen shape throughout editing and export.

**Independent Test**: Select a circular boundary, drag/resize it, export/import and compare its shape and size.

**Acceptance Scenarios**:
1. The corners outside a circle do not select or highlight its body.
2. Resizing or editing the diameter keeps a circle round and wholly inside its movement bounds.
3. Changing the selected body's shape retains its current position subject to containment.
4. Export, browser import and applying zones to code retain the shape. Older files without a shape remain accepted.

### Edge Cases
- Legacy rectangles retain existing width/height when loaded; choosing a new shape normalizes both sides to the smaller current side.
- A containing region limits the full diameter. Motion stays continuous, pauses for editing and resumes from the edited position.
- Circle selection and resize use cardinal contour points; its bounding-box corners are not body targets.
- An unknown shape or unequal circle dimensions in an imported file is rejected before mutation.

## Requirements

### Functional Requirements
- **FR-001**: Creation MUST offer Circle/Square as a separate parameter before adding a moving zone.
- **FR-002**: The chosen shape MUST persist across configuration, live motion and file round-trips.
- **FR-003**: Circular rendering and pointer hit testing MUST agree in WebGL and Canvas fallback.
- **FR-004**: Circle resizing and numeric size edits MUST keep equal dimensions and existing movement constraints.
- **FR-005**: Existing zones and files without a shape MUST retain rectangular behavior and dimensions.
- **FR-006**: New empty-list zones MUST have valid identity, motion defaults and movement bounds.

### Key Entities
- Shape: Circle or Square for newly created moving bodies; omitted shape means legacy rectangle.
- Circle size: diameter, stored as equal width and height; position is its top-left bounding-box corner.

## Success Criteria
- **SC-001**: Both creation choices produce valid zones that survive export/import/code serialization.
- **SC-002**: All tested body hits match the circle; outside corners are excluded.
- **SC-003**: Diameter remains equal on both axes after drag/numeric edits, movement and config refresh.
- **SC-004**: Existing rectangular scenarios and game-cycle baseline remain valid.

## Assumptions
- Movement bounds stay rectangular. This request changes body shape only.
- Circle means a circle in the current map plane, projected by the existing viewport transform.
- Existing code has no gameplay inclusion consumers for dynamic zones; this feature does not introduce a new buff/collision mechanic.
- New-form selection is local editor UI state; selected-zone shape is authored configuration.
- Owner checks dev.html, desktop/phone and both orientations: create both forms, circle contour hover/drag/resize, motion/bounce, export/import, Canvas fallback and phone performance overlay. Agent does no visual check or push.

## Implementation and verification

- Creation has a separate Circle/Square select; selected shapes have a shape select and one diameter/side field. An empty list produces valid moving-zone defaults and full-map bounds. Legacy unequal rectangles keep their dimensions and an explicit rectangle label until the owner changes shape.
- Optional authored shape travels into DynamicZone; motion/random starts retain the existing full-body bounding-box constraints. Uniform size edits are projected through the current command owner; diameter writes also work when editing another unloaded location.
- Shared annotation records distinguish rect/ellipse, reset the discriminator on reuse and invalidate on live shape changes. Native Pixi/Canvas ellipse primitives share the same geometry. Circle hit testing excludes empty corners and uses contour/cardinal resize handles; square and circle resizing retain equal sides.
- Existing zone-editor scenarios now exercise empty-list creation, choice overriding a copied template, unique identity, numeric size coupling, continuous circle dragging, contour resize containment, excluded corners, unchanged cache work and both renderer paths. Browser file export/reset/import retains circles. apply-zones exercises a complete circle write/read round-trip and rejects unknown/nonuniform shapes; legacy files remain valid.
- Full 66/67 includes Architecture/Quick and unchanged game-cycle. Only pre-existing committed lobby PNG fails pages-release. No baseline/guard changes; no visual/phone performance check, commit or push.
- No obsolete tools, scripts, fixtures, vendor files or dependencies were replaced by this feature; no new assets or generated source. Owner acceptance remains pending.
