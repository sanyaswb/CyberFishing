# Feature Specification: Intuitive inventory icons and automatic refill controls

**Feature Branch**: `develop`

**Created**: 2026-10-13

**Status**: Implemented for patch v0.34.3; visual acceptance belongs to the owner.

**Input**: Replace inventory compartment labels with centered, minimalist light-grey vector illustrations; align the dependent compartments to the rod; combine selected bait/chum imagery and large A switches with eligible stock counts; keep filter scrollbars clear. Apply the same minimal-text direction to future designs.

## User Scenarios & Testing

### User Story 1 - Recognize equipment compartments (Priority: P1)

The player recognizes empty rod, line, float, reel, tackle, net, groundbait, boat and gas-mask compartments from their illustrations, without reading permanent labels.

**Why this priority**: Empty compartments must explain what belongs there before the player equips anything.

**Independent Test**: Open inventory with empty, filled and locked equipment slots, then select items through the existing interactions.

**Acceptance Scenarios**:

1. **Given** an empty visible compartment, **When** inventory opens, **Then** its purpose is shown by a centered monochrome illustration and an accessible name.
2. **Given** a filled compartment, **When** inventory opens, **Then** the actual item artwork takes the placeholder's place and existing actions remain available.
3. **Given** three visible compartments beside the rod, **When** the layout changes size, **Then** they align to the rod compartment's top, center and bottom with free space between them.
4. **Given** a locked compartment, **When** it is pressed, **Then** its purpose remains recognizable and the existing explanatory warning appears.

### User Story 2 - See and control automatic refill (Priority: P1)

The player sees the equipped bait/groundbait and its automatic refill state in two matching pill-shaped controls.

**Why this priority**: The setting and the consumable it controls must be understandable together.

**Independent Test**: Select bait and groundbait, enable and disable each switch, then consume or move matching inventory stock.

**Acceptance Scenarios**:

1. **Given** no selected consumable, **When** inventory opens, **Then** the bait/groundbait illustration appears at the left of its control.
2. **Given** a selected consumable, **When** inventory opens, **Then** its actual artwork replaces that illustration.
3. **Given** an enabled switch, **When** it is displayed, **Then** its round A thumb is on the right with green illumination and the available matching inventory quantity appears on the left of the track.
4. **Given** a disabled switch, **When** it is displayed, **Then** the A thumb moves left, remains visible without green illumination and the stock number disappears.
5. **Given** stock in stacks, equipped items and saved loadouts, **When** the count is displayed, **Then** only eligible matching inventory units are counted, with duplicate selected references counted once.
6. **Given** a previously selected consumable has been exhausted, **When** its refill choice is remembered, **Then** available matching reserve stock can still be displayed without choosing a different item.

### User Story 3 - Use filters on a narrow screen (Priority: P2)

The player swipes category, subtype and sorting controls without scrollbars overlapping their contents.

**Independent Test**: Expand both filter sections and scroll them at widths of 320px and above.

**Acceptance Scenarios**:

1. **Given** a horizontal scrollbar is visible, **When** categories, subfilters or sort controls overflow, **Then** the scrollbar has reserved space below the controls.
2. **Given** a 320px viewport, **When** inventory is used, **Then** the two switches fit, four item icons remain visible per row and equipment compartments stay inside the dialog.

### Edge Cases

- No selected consumable and no remembered refill choice: show its placeholder; enabled reserve count is zero.
- Several selected references use the same consumable: show their artwork without counting reserve stock repeatedly.
- Selected consumables differ: count each distinct eligible refill choice once.
- Reserved items, nested components, loaded assemblies and different item variants do not inflate refill stock.
- A rod's capabilities hide some equipment slots: preserve visibility rules and distribute the remaining visible compartments over the rod's height.
- Missing item artwork uses the existing item fallback; meaningful accessible names and explanations remain available.
- Keyboard focus, touch activation and reduced-motion preferences remain supported.

## Requirements

### Functional Requirements

- **FR-001**: Equipment placeholders MUST use a consistent, minimalist vector style with closely related light-grey tones and transparent backgrounds, recognizable at small sizes.
- **FR-002**: Compartment names MUST remain available through accessible names and contextual hints, without permanent text labels above each equipment slot.
- **FR-003**: Actual equipped artwork MUST replace the placeholder; selection, removal, warnings, slot visibility, saved loadouts and attachments MUST preserve their existing behavior.
- **FR-004**: The dependent compartments MUST align over the full rod compartment height, with three compartments at top/center/bottom.
- **FR-005**: Bait and groundbait MUST each have one pill-shaped container with selected-item imagery on the left and a large automatic refill switch on the right.
- **FR-006**: Each switch MUST contain a round A thumb: left and muted when off, right and green when on. No persistent automatic-refill text labels may appear.
- **FR-007**: The stock count MUST appear in the track's free left side only while enabled and MUST derive from the actual refill eligibility rules without consuming inventory.
- **FR-008**: Filter rows MUST reserve room for their horizontal scrollbar and a clear gap below the control content.
- **FR-009**: Layout MUST continue supporting 320px width, four inventory icons per row, equal spacing and usable control targets.
- **FR-010**: Gameplay, saved settings, save format, timing and the automatic refill choices MUST remain unchanged.

### Key Entities

- **Equipment compartment**: An existing visible slot, its purpose, occupancy, availability and accessible name.
- **Automatic refill control**: A selected consumable or placeholder, the saved enabled state and a derived reserve quantity.
- **Eligible reserve stock**: Inventory units the existing refill rules can take for selected or remembered consumables; displayed read-only.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All nine requested equipment categories are recognizable through illustrations without permanent compartment labels.
- **SC-002**: Both automatic refill controls communicate off/on state, selected item and enabled reserve count without visible explanatory labels.
- **SC-003**: Enabling, disabling, consuming, reserving and replenishing inventory produce the correct count and preserve saved settings.
- **SC-004**: At 320px width, four inventory item icons fit per row and neither switches nor filter scrollbars overlap neighboring content.
- **SC-005**: Existing gameplay and save compatibility checks pass unchanged; the owner performs visual acceptance.

## Assumptions

- Reserve count means the total eligible matching units available in inventory, rather than the quantity currently on a hook/in a feeder or all items in a broad category.
- Groundbait includes selected hand, tackle and boat groundbait governed by the existing auto-groundbait setting. Aquarium-only feed is a separate purpose and does not count.
- A filled compartment displays the actual item; the section illustration is its empty-state placeholder.
- The existing branch, browser-free verification and commit/Pages publishing workflow from v0.34.2 continue for this patch.

## Design direction for future changes

Use intuitive imagery and spatial grouping before permanent explanatory text. Prefer recognizable vector symbols, actual selected-item artwork, small numeric indicators and consistent control silhouettes. Keep placeholder artwork minimalist and monochrome in light-grey tones; reserve green illumination for an active automatic mode. Place illustrations at the centers of their compartments and preserve equal gaps. Names and detailed explanations belong in accessible labels, contextual hints or help popovers. Keep necessary item parameters, warnings, confirmations and quantities readable: reducing text must never hide an action's consequence or useful state. Retain the 320px/four-icons constraint and account for scrollbar space in every scrolling control row.

## Verification record

The specification quality checklist is complete; no extension hooks are configured. Focused inventory UI, integration and reserve-count checks pass. Architecture passed 2 checks, Quick passed 18 and Full passed 44, including the unchanged game-cycle baseline and save compatibility checks. All 11 vector assets parse successfully. Browser and visual checks were intentionally left to the owner, as requested.
