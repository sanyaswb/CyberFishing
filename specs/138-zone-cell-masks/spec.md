# Feature Specification: Connected cell masks for zones

**Created**: 2026-10-23
**Status**: Implemented in v0.46.45, TK-075 controls/opacity in v0.46.46; owner visual/performance acceptance pending
**Release**: v0.47.0 (owner-approved minor release, 2026-10-23).
**Input**: Paint a fine connected mask inside each ordinary zone, bake compact JSON, optionally invert it; fishing zones are excluded.

## User Scenarios & Testing

### User Story 1 - Trace an irregular boundary (Priority: P1)
The owner selects a zone by number, enables its mesh, subdivides its cells by 2 or 4 and traces a shore without changing the global grid.

**Independent Test**: Paint a connected stair-shaped region using several drag segments, apply it and reload it from a zone file.

**Acceptance Scenarios**:
1. Mesh editing targets only the selected ordinary zone; no mesh controls exist for fishing zones.
2. LMB adds cells and RMB removes cells, both by click or drag. RMB suppresses the context menu while painting.
3. Applying a nonempty connected draft replaces the zone's effective coordinate boundary with that mask.
4. Until applied, the draft does not change gameplay. Leaving the target discards the draft and retains the last applied mask.
5. Entering mesh creation/editing immediately dims all space outside the selected host zone. The mesh stays clear; leaving mesh mode removes the dimming, without requiring hover.
6. While the mesh is active, host-zone fields (including shape and movement bounds) and its add/delete actions are visibly unavailable. Leaving/applying mesh mode restores them; selecting another number and exiting remain possible.
7. A 0–100% mask-opacity slider adjusts draft/applied mask fill immediately, letting the owner see the map texture. Contours, mesh lines and outside-host dimming remain independently visible; opacity never changes saved geometry or wave clipping.

### User Story 2 - Enforce boundaries and keep the shore still (Priority: P1)
The applied enabled mask controls real coordinate acceptance and the displayed contour. Pixi waves clip to the applied castable mask with priority over the host rectangle, so excluded shore stays still. Depth and the coarse water/depth raster remain based on the original zone data.

**Independent Test**: Check two points in the same coarse cell on opposite sides of a mask edge; only the selected side is accepted. Check masked wave clips and unchanged depth data before and after masking.

**Acceptance Scenarios**:
1. Castable, obstacle and snag masks replace their respective coordinate shapes; empty corners of the host rectangle do not constrain or add the masked area.
2. A moving zone's mask travels with its body. Movement bounds constrain the mask's occupied extents when enabled, otherwise the original body.
3. Disabling a saved mask restores the ordinary shape without deleting the saved mask.
4. Changing global cell size preserves the exact applied mask. Moving/resizing the parent transforms its local mask with it.

### User Story 3 - Validate and invert (Priority: P1)
The owner can invert selected/unselected cells and apply the result only if it is still a single figure.

**Independent Test**: Invert a valid pattern into disconnected islands; applying must fail without modifying the saved mask.

**Acceptance Scenarios**:
1. Connectivity means sharing a complete cell side; diagonal contact alone does not connect cells.
2. Empty or disconnected drafts cannot be applied or exported as saved masks. The previous applied mask remains intact.
3. Inversion rewrites selected cells in the draft; applying bakes the new coordinates, not an extra rendering-only inverse flag.
4. Compact JSON survives browser export/import and apply:zones; malformed masks are rejected before mutation.

### Edge Cases
- Holes are allowed if the occupied cells remain one side-connected component.
- Circle zones receive the same local mask editor; an enabled mask replaces the circle's effective shape within its bounding rectangle.
- Changing subdivision starts a fresh mesh for the target; applied mask stays active until another valid draft is applied.
- Imported masks must have finite positive local cell dimensions, bounded integer geometry and one component, without overlaps.
- Fast strokes fill intervening cells; changing selection/location/editor/category cancels painting and discards only the draft.
- Adaptive zones use the full map-width host rectangle, matching their editor outline; the camera clips its visible part. Saved local coordinates follow that rectangle's normal transform policy.

## Requirements

### Functional Requirements
- **FR-001**: Each castable/obstacle/snag/moving body MUST offer local mesh editing with subdivision 2/4, independent of fishing zones.
- **FR-002**: LMB MUST add and RMB MUST remove cells, including continuous strokes.
- **FR-003**: Applying MUST require a nonempty side-connected selection; no invalid draft may overwrite applied geometry.
- **FR-004**: An enabled applied mask MUST take priority over the original body for effective coordinate queries and its visible contour.
- **FR-005**: Pixi wave clipping MUST prioritize the applied enabled castable mask, including holes and stepped shores. Adjacent baked rectangles MUST form one wave surface without internal still seams. Depth sampling/parameters and the coarse water raster MUST stay unchanged.
- **FR-006**: Mask coordinates MUST survive global-grid changes and file round-trips without shape drift.
- **FR-007**: Inversion MUST recompute occupied coordinates and obey the same connectivity rule.
- **FR-008**: Baked storage MUST merge redundant adjacent cells; runtime drawing MUST use cached geometry without per-frame rebuilding of topology.
- **FR-009**: Mesh creation/editing MUST immediately dim the rest of the viewport outside the active host zone, on both renderer paths, and clear that dimming with mesh mode.
- **FR-010**: Active mesh editing MUST disable host-zone geometry/shape/bounds and structural mutations in the editor UI, restoring them on exit without losing the draft through an accidental outer edit.
- **FR-011**: DEV MUST provide a shared session mask-fill opacity setting from 0 to 100%, updating draft/shown applied masks on both renderer paths without rewriting mask data or rebuilding topology.
- **FR-012**: The editor's existing grid-opacity setting MUST control cell-grid, mesh-grid and perspective-grid lines together; mask fills and zone contours remain independent.

### Key Entities
- Host zone: existing ordinary zone, retaining its original geometry as the fallback and local coordinate frame.
- Applied mask: enabled flag and baked local occupied-cell geometry, authoritative in the zone config.
- Draft mesh: editor-only cell selection, target identity, subdivision and stroke; never gameplay state.

## Success Criteria
- **SC-001**: All tested same-coarse-cell point pairs obey the exact fine mask boundary.
- **SC-002**: Every applied mask has exactly one occupied component; invalid paint/inversion leaves the previous mask unchanged.
- **SC-003**: A filled rectangular selection bakes to one rectangle rather than one record per cell.
- **SC-004**: Mask toggles change wave clips with enabled/disabled fallback while preserving depth and the water raster; saved masks survive 40→17→40 global-grid changes.
- **SC-005**: Unchanged masks do not allocate/recompile topology each frame; no listeners or stale draft targets remain after closing/rebuilding.

## Owner decisions and assumptions

- Owner confirmed: real boundaries plus contour; depth and the coarse water raster unchanged; disconnected inversions cannot apply; global-grid changes preserve exact masks.
- Owner correction (2026-10-23): Pixi waves follow the applied castable mask with priority, keeping excluded shore still. This supersedes the initial unchanged-wave/clipping requirement. Draft painting changes waves only after applying.
- Owner addition: RMB removes selected cells (2026-10-23); LMB adds them.
- Owner addition: dim the rest of the area immediately while creating/editing a mesh (2026-10-23). The clear area is the host mesh rectangle, including cells not yet selected.
- Connectivity is side adjacency. A mask edits the body of a zone; the moving body's rectangular travel area remains a separate constraint.
- Saved geometry is local to the host so it follows movement and proportional resize. Global mesh density is not written into or changed by mask editing.
- A partially covered edge cell is clipped to the host rectangle. Masks begin inside that rectangle; an active circle mask may replace its round shape within that rectangle.
- Owner acceptance: dev.html, desktop both orientations — all four categories, LMB/RMB strokes, immediate outside-host dimming and cleanup, disjoint rejection, inversion, disabled fallback, runtime casts/obstacles, moving shape, grid changes and JSON round-trip. Trace a stepped shore and check that Pixi waves stay inside the applied castable mask, including holes, without still internal seams; disabled masks restore the ordinary water area. Check Canvas fallback and phone performance overlay. Agent does no visual check, commit or push.

## Implementation and verification

- Pure bounded codec, four-neighbor validation, merged rectangle baking and cached exact queries/contours.
- Applied data remains with the zone; the injected ZoneMaskEditor owns only the unapplied draft. Selected-number LMB/RMB painting, continuous strokes, inversion, apply/disable and lifecycle cancellation use existing controls/config/export paths.
- Castable/obstacle/snag coordinate queries prioritize enabled masks without changing depth or coarse water data. Moving-body bounds use occupied extents. Masked contours and immediate outside-host focus use shared cached Canvas/WebGL commands.
- Applied castable masks drive water clip rectangles; the displacement field computes a cached union envelope, avoiding internal rectangle seams and keeping excluded shore still. Global cell-size changes retain exact normalized geometry.
- Focused zone-editor, apply-zones, config-runtime, scene-layer and game-cycle passed. Final Full: **67/67**, including Architecture and Quick; game-cycle baseline unchanged. v0.46.45/CHANGELOG updated; obsolete utilities/dependencies: none. No browser visual or phone performance check, commit or push.
- TK-075/v0.46.46: native fieldset locks the active host's complete parameter tree and structural actions; mesh/number controls stay usable, with restoration on exit/apply. Session mask opacity changes only view revisions, preserving draft/topology/config. Cell, mesh and perspective grids share the existing opacity value. Expanded functional scenarios and Full **67/67** passed, including both renderer commands; owner visual/performance checks pending.
