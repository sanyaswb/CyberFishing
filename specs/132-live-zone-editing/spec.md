# Feature Specification: Edit the live zones in one place

**Feature Branch**: `develop` (existing working tree)
**Created**: 2026-10-22
**Status**: Implemented in v0.46.27; owner visual acceptance pending
**Input**: Make the interface intuitive, remove duplicate authored/live zone drawings, and move category editing controls into «Зони».

## User Scenarios & Testing

### User Story 1 - One zone to see and edit (Priority: P1)

The developer edits the same zone currently used by the game. Enabling visibility and editing together never adds a stationary duplicate.

**Why this priority**: Two indistinguishable rectangles for one zone make selection and editing misleading.
**Independent Test**: Move a dynamic zone away from its starting point, enable its editing and visibility, and verify that exactly one zone rectangle appears at its current position and can be moved there.

**Acceptance Scenarios**:

1. **Given** one dynamic zone has moved, **When** dynamic editing is enabled, **Then** it stops at its current position and that same rectangle is editable.
2. **Given** it is editable, **When** its visibility or «Показати всі» is enabled, **Then** no second rectangle appears.
3. **Given** it was moved or resized, **When** dynamic editing is disabled, **Then** it resumes motion from the resulting position, with the resulting size.
4. **Given** several dynamic zones, **When** one is edited, **Then** the others retain their paused current positions rather than returning to their old starts.

### User Story 2 - Editing controls beside zone settings (Priority: P2)

The developer opens «Зони» and sees switches «Редагувати ігрову», «Редагувати перешкоди», «Редагувати зачепи», «Редагувати рухомі», «Редагувати всі», «Показати всі», followed by the existing category subsections.

**Why this priority**: Editing and visibility belong to the same objects and should be found together.
**Independent Test**: Toggle each category and the aggregate editing control, then verify selection and drag permission for every zone of that category.

**Acceptance Scenarios**:

1. **Given** editing is enabled, **When** a category's editing switch is enabled, **Then** all its zones are editable; other categories remain unchanged.
2. **Given** the editor is off, **When** category editing is requested, **Then** it stays off and the editor prerequisite is highlighted using spec 131.
3. **Given** all required physics switches are on, **When** «Редагувати всі» is enabled, **Then** all four category editing switches agree; changing one updates the aggregate.
4. **Given** «Зони» is open, **Then** no separate «Зони для редагування» section or per-zone editing checklist exists.

### Edge Cases

- Editing requires the editor and the corresponding category's physics; unmet prerequisites are identified, never enabled automatically. «Редагувати всі» requires all four physics switches.
- Visibility remains independent of editing. Motion boundaries remain a distinct outline of the permitted movement area, not another zone.
- Moving zones stop only while their loaded location, editor and dynamic-category editing are active. Turning off editing or leaving that location releases the pause.
- Add/delete/import/reset retain location binding and existing validation. Import/reset clear category editing choices; deleting one zone does not turn off editing of its category.
- Changed cell size uses current game geometry for hit testing and converts edits into design-cell coordinates once.

## Requirements

### Functional Requirements

- **FR-001**: Add the intuitive-interaction principle to DESIGN_RULES.md.
- **FR-002**: Draw each dynamic zone exactly once from its live position for both editing and visibility; never draw its authored starting rectangle as an additional zone.
- **FR-003**: Use the same current zone geometry for drawing, hover and drag selection; current coordinates shown in zone fields are snapshots of that same object.
- **FR-004**: Replace per-zone editing choices with four category switches and «Редагувати всі» at the top of «Зони», before «Показати всі» and the category subsections.
- **FR-005**: Pause dynamic motion on enabling «Редагувати рухомі» and resume from the edited position when it is disabled. Owner explicitly chose this behavior on 2026-10-22.
- **FR-006**: A geometry edit must persist the current positions of the affected dynamic category instead of resetting untouched zones to their old starts. Export reflects accepted edits through the existing zone file workflow.
- **FR-007**: Preserve prerequisite feedback, independent visibility/grids, snapping, minimum size, movement window limits and location binding.
- **FR-008**: Keep production gameplay, randomness, timing, save format and game-cycle baseline unchanged; the motion pause exists only through injected development capability.

### Key Entities

- **Live zone**: the authoritative current game position and dimensions owned by the location map.
- **Authored zone**: persisted zone definition; updated from a deliberate edit, not drawn as a second object.
- **Category editing choice**: one session flag per category, distinct from physics and visibility.
- **Movement boundary**: the area where a dynamic zone may move; not a second zone.

## Success Criteria

### Measurable Outcomes

- **SC-001**: With N dynamic zones, every editing/visibility combination draws at most N zone bodies, plus separately identifiable movement boundaries and handles.
- **SC-002**: Drawing and hit testing select the same current rectangle after movement, camera changes and cell-size changes.
- **SC-003**: Paused zones move zero distance while editable and resume from accepted coordinates after editing ends.
- **SC-004**: Four category switches and both aggregates remain consistent after individual changes and panel reopening, without duplicate editable-zone state.

## Assumptions

- Existing top-level editor enablement remains the master input mode. Editing categories requires it; visibility does not.
- Category editing affects all zones in the category, including a newly added zone; no second per-zone permission set remains.
- Motion direction/timers after an accepted config reload retain the existing reload behavior; this change guarantees positions and dimensions, not a new motion algorithm.
- Owner checks dev.html on desktop and phone in both orientations: category layout, one moving zone body, boundaries, pause, drag/resize and resume. No agent visual acceptance or push.

## Implementation and verification

- Four category editing flags replace the per-zone permission set. The six requested controls live directly under «Зони»; the old section, setEditable/zoneRemoved methods and index-shift permission assertions are removed, with no remaining source consumers.
- Dynamic bodies and their handles use the map's current dynamic overlay only. Drag hit testing reads live map geometry, including scaled static geometry, and converts accepted changes to design cells.
- ZoneEditorConfigEdits builds command/UI snapshots from current dynamic coordinates, normalizing deliberate edits through the existing validated config writer. Numeric fields and untouched dynamic siblings retain their current placements across accepted config reloads; add clones the current shape.
- The DEV flags provider supplies the pause choice through a predicate composed into GameWorld. LocationMap.update accepts an optional dynamic-motion pause; normal production defaults remain unchanged, including environmental updates and randomness when unpaused.
- Map revision changes refresh paused coordinate fields after asynchronous config reload, without continuous DOM refresh. DevTools owns/disposes the section subscription on panel rebuild and disposal.
- The existing zone-editor scenario now uses real LocationMap, DynamicZone and GameWorld with fixed RNG to verify one live body per zone, pause, current-position hit testing, resize, drag, sibling preservation, no writes before validation and resume. Existing gesture, lifecycle and config-runtime scenarios pass.
- Full 66/67: Architecture/Quick and game-cycle passed, baseline unchanged. Only the existing pages-release failure remains: the committed assets/lobby/lobby-background.png violates the release WebP rule.
- Utils cleanup: removed obsolete per-zone permissions and their index-shift assertions; retained meaningful drag/hover scenarios. No script, fixture, vendor file or dependency became unused. No browser visual check, phone performance measurement, commit or push was performed.
