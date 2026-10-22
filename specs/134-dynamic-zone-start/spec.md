# Feature Specification: Free translation and random grid starts

**Created**: 2026-10-23
**Status**: Implemented in v0.46.29; owner visual acceptance pending
**Input**: Move dynamic bodies without snapping; choose a random grid-aligned start inside movement bounds on fresh page load.

## User Scenarios & Testing

### User Story 1 - Precise placement (Priority: P1)
The owner pauses a moving body and translates it by fractions of a cell.

**Independent Test**: A subcell drag changes coordinates by that exact travel.

**Acceptance Scenarios**:
1. Dynamic-body middle dragging ignores the snap multiplier and stops the whole body at screen/region edges.
2. Resizing, bounds dragging and static editing retain grid snapping.
3. Refreshing parameters preserves fractional positions; disabling editing resumes there.

### User Story 2 - Varied starts (Priority: P1)
A fresh location starts moving bodies at random legal grid positions before continuous motion.

**Independent Test**: Controlled random draws select both extreme legal positions, with full containment.

**Acceptance Scenarios**:
1. Fresh map creation randomly selects a legal grid-aligned top-left position.
2. Editing an already loaded map does not randomize again.
3. Disjoint fitting bounds participate; stationary zones retain their configured position.

### Edge Cases
One legal position uses that position. With no legal grid start or no bounds, retain configured geometry. Random selection may repeat between loads. Invalid sizes are never silently resized.

## Requirements

### Functional Requirements
- **FR-001**: Dynamic body translation MUST be continuous, respecting full-body bounds and window limits.
- **FR-002**: Other grid-based edits MUST retain their current snapping.
- **FR-003**: Fresh moving starts MUST use map-grid alignment, full-body containment and the injected random source.
- **FR-004**: Runtime refresh MUST preserve exact edited coordinates.
- **FR-005**: Authored geometry and save formats MUST stay intact.

### Key Entities
Moving body: authoritative live rectangle. Legal start: aligned top-left where the entire body fits a configured rectangle.

## Success Criteria
- **SC-001**: Subcell translation works with snap set to one or multiple cells.
- **SC-002**: Every controlled start is aligned and contained; extreme draws cover legal extrema.
- **SC-003**: Refresh and resume retain edited fractional coordinates without random jumps.

## Assumptions
Fresh map creation includes location re-entry. Grid means active map cells, independent of DEV snap multiplier. Consecutive random positions may repeat. Owner checks dev.html in both orientations: subcell movement, limits, resume and repeated reloads. No agent visual check.

## Implementation and verification

- DynamicZone samples legal integer top-left positions across fitting rectangles only at map construction. Bootstrap injects independent session randomness; the seeded gameplay stream is untouched. Refresh never randomizes.
- Dynamic x/y scaling retains fractional positions; static scaling and dimension snapping retain their existing behavior. DEV body translation uses continuous travel and exact window/region limits; resizing and bounds dragging keep snapping.
- Pre-fix deterministic scenario failed: controlled low draw retained [1,1] instead of legal first start [0,0]. Expanded zone-editor covers extreme draws, disjoint/no-fit/single-position cases, stationary zones, independent RNG, fine-grid refresh and fractional dragging with multi-cell snap.
- zone-editor, config-runtime and game-cycle passed, baseline unchanged. Full 66/67 includes Architecture/Quick; only known pages-release failure from committed lobby PNG. No guard/baseline changes.
- No obsolete tools, fixtures, dependencies or generated source were introduced. Owner visual checks remain pending; no commit or push.
