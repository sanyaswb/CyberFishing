# Feature Specification: DevTools parameter prerequisites

**Feature Branch**: `develop` (existing working tree; no branch change)
**Created**: 2026-10-22
**Status**: Implemented in v0.46.26; owner visual acceptance pending
**Input**: A dependent parameter must not turn on while its prerequisite is off; highlight the blocking parent red for three seconds or until enabled.

## User Scenarios & Testing

### User Story 1 - Explain a blocked activation (Priority: P1)

A developer tries to enable an editable zone with the editor off. The zone stays off and the editor's enabling control is revealed and highlighted.

**Why this priority**: A switch that appears enabled but cannot work gives misleading feedback.
**Independent Test**: With editing off, activate an unchecked zone by pointer or keyboard; its value and the zone state remain unchanged, and the blocking editor control is identified.

**Acceptance Scenarios**:

1. **Given** editing is off, **When** an unchecked editable zone is activated, **Then** it remains unchecked and the editor's enable control receives a red outline.
2. **Given** that outline is visible, **When** three seconds elapse, **Then** it disappears.
3. **Given** that outline is visible, **When** the editor is enabled earlier, **Then** it disappears immediately; a subsequent zone activation succeeds.
4. **Given** a previously checked zone, **When** editing is off, **Then** it can still be unchecked; no child is enabled automatically.

### User Story 2 - Consistent lifecycle and declared dependencies (Priority: P2)

The same rule applies to other controls with a confirmed prerequisite, without treating every nested section as a dependency.

**Why this priority**: Independent zone visibility and grids must stay usable outside editing.
**Independent Test**: Depth-number activation is blocked by the disabled editor; zone visibility and grids remain independent. Rebuilding or closing the panel leaves no pending feedback work.

**Acceptance Scenarios**:

1. **Given** editing is off, **When** depth numbers are enabled, **Then** they stay off and the same blocking editor control is highlighted.
2. **Given** editing is off, **When** zone visibility or either grid is enabled, **Then** the established independent visibility behavior is preserved.
3. **Given** repeated blocked attempts, **When** the last attempt occurs, **Then** the three-second interval restarts without accumulating timers.
4. **Given** active feedback, **When** its controls are rebuilt, removed or disposed, **Then** it is cleared and pending work is cancelled.

### Edge Cases

- An already checked child retains its stored choice when the parent turns off; turning the child off remains allowed.
- A collapsed ancestor is opened to reveal the blocker without enabling it or moving keyboard focus.
- A dependency is checked using current state on every attempt, including changes made through another control.
- Multiple declared prerequisites: the first unmet prerequisite is shown; another attempt after resolving it identifies the next.

## Requirements

### Functional Requirements

- **FR-001**: Block activation of a dependent switch while a declared prerequisite is unmet, with zero authoritative-state writes.
- **FR-002**: Highlight the blocking parameter with a red outline for 3000 ms from the most recent blocked attempt, or until that parameter is enabled, whichever occurs first.
- **FR-003**: Keep the child switch's displayed value synchronized with its previous value after rejection; allow deactivation.
- **FR-004**: Reveal a blocker inside collapsed sections; preserve keyboard focus and existing focus decoration.
- **FR-005**: Apply the rule to editable-zone switches and depth-number visibility, whose editor dependency is confirmed in current consumers.
- **FR-006**: Provide the same declared-prerequisite behavior for other switches without guessing dependencies from section nesting, names or generic `enabled` properties.
- **FR-007**: Clear feedback on control removal, panel close/rebuild and disposal; no continuous polling or animation loop.
- **FR-008**: Preserve independent zone/grid visibility, physics, runtime config paths, saved values and production behavior.

### Key Entities

- **Prerequisite**: a parameter identity and a current-state condition required for activation.
- **Blocked activation**: rejected switch-on attempt naming the first unmet prerequisite.
- **Feedback**: temporary highlight of the blocking parameter, never an owner of parameter values.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every attempted activation in the two confirmed dependent control groups is rejected while editing is off, without changing its value.
- **SC-002**: Feedback ends at 3000 ms on a controlled clock or immediately on prerequisite activation.
- **SC-003**: Repeated attempts keep at most one pending feedback timer; removing the controls leaves zero.
- **SC-004**: Pointer and keyboard activation follow the same rule; independent visibility and grids retain their accepted behavior.

## Assumptions

- First delivery covers the two dependencies verified in code: editable zones and depth numbers require enabled editing. No other gameplay dependency is invented.
- Only switch-on is blocked; existing stored child choices are preserved and are never automatically activated.
- This is a DEV interface change. Appearance and phone acceptance belong to the owner; no commit or push is requested.
- Owner acceptance: dev.html, desktop and phone, try an unchecked zone/depth switch with editing off; see the editor control outlined, wait three seconds, repeat then enable editing, and retry the child.

## Implementation and verification

- Shared prerequisite contract in DevToolsUI; explicit mappings for editable zones and depth-number visibility.
- DevToolsDependencyFeedback owns one injected timer and transient blocker decoration; bindings supply the existing control rows. Bootstrap composes feedback and the browser scheduler.
- Existing zone-editor scenarios cover rejection without writes, live readiness, repeated attempts, 2999/3000 ms boundaries, early resolution, disclosure reveal and removal/close/rebuild/disposal. Config-runtime verifies scheduler composition and duration.
- Full: 65/67 initially; the composition test needed the new constructor spies, then its focused rerun passed. Final combined result 66/67; the only remaining failure is the existing committed lobby PNG in pages-release. Architecture, Quick and game-cycle passed; baseline unchanged.
- No browser visual verification, commit or push. Utils cleanup audit: no tool, helper, fixture or dependency became obsolete.
