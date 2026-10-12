# Feature Specification: Live Bait, Keepnet, and Fisherman's House Aquarium

**Feature Branch**: `develop` (existing checkout; no branch created)  
**Created**: 2026-10-11  
**Status**: Implementation in progress; remaining work is tracked in `tasks.md`  
**Input**: Owner's live-bait, keepnet, aquarium, house, and free-action requirements. The owner requested English specification text.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Turn a small catch into live bait (Priority: P1)

After landing an eligible crucian, a player may claim it, release it, or turn it into live bait. The bait retains the individual fish's identity and can be selected for a later cast. If the player has an aquarium with room, the fish goes there; otherwise it goes to the keepnet with a visible survival countdown.

**Why this priority**: This is the smallest complete playable loop and establishes ownership of a caught fish.

**Independent Test**: Land crucian fish at 100 g and 101 g, exercise all three outcome choices, inspect the keepnet and selected bait, cast once, then reload and verify the resulting facts.

**Acceptance Scenarios**:

1. **Given** a landed crucian weighing exactly 100 g, **when** the player selects “Use as live bait”, **then** one live bait is created from that exact fish and placed in the aquarium if owned and not full, otherwise in the keepnet.
2. **Given** a landed crucian heavier than 100 g or a different species, **when** the outcome appears, **then** the live-bait action is unavailable and claiming or releasing still works.
3. **Given** a live fish in the keepnet, **when** the configured survival duration expires, **then** it becomes unusable as bait and its loss is shown; it cannot be selected or cast.
4. **Given** an available live bait selected for a compatible hook, **when** a cast consumes that bait, **then** that fish is removed exactly once and its movement uses only the source species' `swim` state at a configurable 50% speed.

---

### User Story 2 - Inspect a separate keepnet (Priority: P2)

The player opens a “Keepnet” button next to Inventory. It opens a matching two-column panel: keepnet view and parameters on the left, caught fish and filters on the right. Live fish show remaining time. Only the house aquarium accepts feed.

**Why this priority**: Players need a clear place to find claimed catches and dying live bait.

**Independent Test**: Open and close both panels, filter multiple catches, and observe a live-fish countdown without changing inventory equipment or feeding the keepnet.

**Acceptance Scenarios**:

1. **Given** claimed catches and live fish, **when** Keepnet opens, **then** the left side shows its view and parameters and the right side shows fish with functional filters.
2. **Given** a live fish in the keepnet, **when** the panel is open, **then** its countdown is visible and updates without needing a page reload.
3. **Given** either panel is open, **when** the other button is used, **then** focus and closing behavior remain coherent and the player is not left behind overlapping modal dialogs.

---

### User Story 3 - Keep bait alive in an aquarium (Priority: P3)

The player visits a separate Fisherman's House page with horizontally navigable rooms, a postapocalyptic/futuristic room background, and the aquarium rendered as a separate layer on a table. Each present fish species has one feed slot. A slot's bar shrinks faster with more fish of that species. Feed goes to the least full slot, breaking ties by the larger fish count. When a slot runs empty, that species enters a death countdown and its fish die in a random order until feed is restored.

**Why this priority**: It provides the intended long-term care loop and a scalable house interface.

**Independent Test**: Install the aquarium, transfer eligible bait, create two species using configurable eligibility, advance time while away, add feed, and verify slot order, capacity, survival, and room navigation.

**Acceptance Scenarios**:

1. **Given** an owned aquarium with capacity, **when** live bait is added, **then** it appears in its species slot and counts toward total capacity.
2. **Given** several partial slots, **when** a feed portion is used, **then** the lowest percentage slot becomes 100%; tied percentages choose the species with more fish.
3. **Given** a fed slot, **when** time passes, **then** its bar decreases at its species/count rate and its fish do not die while the bar is above zero.
4. **Given** a slot that reaches zero, **when** its survival countdowns elapse, **then** affected fish die in a randomized but reproducible order; restoring feed before a fish's deadline protects that fish.
5. **Given** the house page, **when** the player navigates left or right, **then** the room viewport changes without losing aquarium state.

---

### User Story 4 - Upgrade care without currency (Priority: P4)

The aquarium, feed portions, automatic feeder, and each one-level capacity upgrade have working buttons with the Ukrainian price label “Безкоштовно” (“Free”). The feeder uses available feed stock while the player is away. No wallet, payment, or premium entitlement is introduced.

**Why this priority**: All requested controls must work during the current no-currency development stage.

**Independent Test**: Obtain each free item, upgrade from level 1 to 10 one click at a time, check each capacity, exhaust feed stock with the automatic feeder, and verify that no balance changes occur.

**Acceptance Scenarios**:

1. **Given** no aquarium, **when** its “Безкоштовно” button is pressed, **then** it is installed at level 1 with capacity 5.
2. **Given** a level below 10, **when** Upgrade is pressed once, **then** level increases by exactly one and capacity follows the specified table.
3. **Given** an enabled feeder and feed stock, **when** a species slot needs feed, **then** one portion is taken from stock using the same slot-priority rule; when stock is empty, the feeder cannot create feed.
4. **Given** any requested purchase action, **when** it is completed, **then** the price reads “Безкоштовно” in the UI and no currency state is created or required.

---

### Edge Cases

- Exactly 100 g is eligible; invalid, missing, or negative catch weights are not. If the aquarium is full, an eligible catch goes to the keepnet and the player is told why.
- A fish cannot be claimed, released, or converted twice. A dead, released, or consumed fish cannot return to live storage.
- Keepnet time begins when bait enters it. A house transfer does not reset elapsed keepnet time. A transfer into an unfed aquarium remains at risk.
- While a species slot has feed, its fish survival countdowns are paused. Refeeding a starving slot pauses each survivor's remaining countdown; it does not revive dead fish.
- On reload or return from another page, elapsed real time is applied once in chronological order before the view is shown. Backward wall-clock changes cannot extend timers.
- Equal slot percentages and equal fish counts use a stable species order. Death order is randomized once per starvation episode and persisted so reloads do not reroll outcomes.
- A room or fish asset that is absent uses an accessible placeholder; missing art does not prevent gameplay.
- At level 10 the upgrade action is disabled. Feed cannot be applied to a nonexistent or already-full slot.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The catch outcome MUST offer Claim, Release, and Use as live bait. The third action MUST be enabled only for a configured species and weight threshold, initially `crucian_stalker` at no more than 0.100 kg.
- **FR-002**: Each landed fish MUST have one stable identity and one current disposition. A successful outcome action MUST change that disposition exactly once.
- **FR-003**: Live bait MUST reference its source fish species and individual catch. Its movement MUST use only that species' existing `swim` state with a configurable speed multiplier (initially 0.5), without copying the full fish definition or entering other states.
- **FR-004**: Live-bait lifetime MUST be a configured minimum/maximum range. One duration MUST be sampled per fish using the game's injected random source, displayed as a countdown, and preserved across page reloads.
- **FR-005**: An eligible converted fish MUST enter an owned aquarium if capacity permits, otherwise the keepnet. Keepnet fish MUST lose survival time and MUST NOT accept feed.
- **FR-006**: The Keepnet button MUST appear beside Inventory and open a separate two-column view with a left keepnet visual and parameters and a right fish list and working filters.
- **FR-007**: The aquarium MUST have one feed slot per species present, a capacity limit by level, and a visible bar per slot. If several species are present, bars MUST occupy equal divisions of the available bar area.
- **FR-008**: Each species slot MUST consume feed over elapsed real time at a configurable base rate modified by the count of fish in that slot. More fish MUST consume feed faster.
- **FR-009**: A feed portion MUST set exactly one eligible slot to 100%, choosing the lowest percentage first, then the larger fish count, then stable species order.
- **FR-010**: Fish MUST be protected while their species slot contains feed. When it empties, per-fish survival countdowns MUST run and fish MUST die in a randomized order if not fed in time.
- **FR-011**: The aquarium, feed supply, automatic feeder, and upgrades MUST have functional actions labeled “Безкоштовно”. The automatic feeder MUST consume stored feed portions under the same priority rule.
- **FR-012**: Aquarium levels 1–10 MUST have capacities 5, 6, 7, 8, 16, 18, 20, 22, 24, and 48 respectively. One upgrade action MUST raise exactly one level.
- **FR-013**: All new numeric gameplay parameters, including lifetime range, movement reductions, feed rate/count scaling, feed portion behavior, capacity schedule, and feeder trigger, MUST come from feature configuration.
- **FR-014**: The Fisherman's House MUST be a separate page with room navigation left and right. A DEV-only temporary navigation button MUST open it until a lobby exists.
- **FR-015**: The room background and aquarium art MUST be separate layers. Room 1 uses the supplied day/evening/night backgrounds for each of its five levels under `assets/house/room-1/lvl-1` through `lvl-5`; `room--1_aqua.png` remains a transparent layer above the table.
- **FR-016**: Catch, live-bait, keepnet, aquarium, feed, and feeder state MUST persist consistently across navigation and reload without rewriting unrelated existing saves or silently replacing them with defaults.
- **FR-017**: A selected live bait MUST enter the existing compatible fishing flow and be consumed exactly once according to a documented cast/bite/loss rule. An expired fish MUST never remain selectable.
- **FR-018**: The new live-bait type MUST have a configured bait identity and source-species reference; one actual bait instance MUST remain the caught fish record rather than a second writable copy.
- **FR-019**: Game time MUST have one persistent source shared by the fishing location and house page. Both surfaces MUST use the same day/evening/night blend thresholds and continue advancing across navigation.
- **FR-020**: Room 1 MUST have five persistent levels. Starting upgrades to levels 2, 3, 4 and 5 MUST take 2, 8, 16 and 48 real hours respectively; an active upgrade MUST survive reload and may be finished immediately with a working “Безкоштовно” control.
- **FR-021**: During renovation the room MUST show a dark translucent overlay, the supplied transparent `under-renovation.png` at full brightness, a central countdown and a completion button.
- **FR-022**: The house page MUST use a full-viewport room scene, compact functional controls, and upward-opening bottom menus. Decorative headings and prose without an action or useful state MUST be removed.
- **FR-023**: The fixed translucent house header MUST slide into view on downward scroll and hide on upward scroll.

### Key Entities *(include if feature involves data)*

- **Caught fish**: One landed individual, with stable ID, species ID, weight, and disposition.
- **Live-bait type**: Configured bait identity linked to an existing source species; individual bait is a designated caught fish.
- **Live bait**: A living caught fish designated for use on a hook, with sampled survival duration and remaining time.
- **Keepnet**: The location for claimed catches and live bait without aquarium protection.
- **Aquarium**: Owned state, level, capacity, contained fish, and per-species feed slots.
- **Feed stock**: Count of available portions; consumed only by manual or automatic feeding.
- **Automatic feeder**: Owned and enabled state; acts on feed stock without generating it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a deterministic acceptance run, 100% of 100 g eligible crucian catches show all three choices and 100% of 101 g catches show only Claim/Release.
- **SC-002**: In 100 repeated outcome and cast scenarios, no fish is duplicated, consumed twice, or revived after death/release.
- **SC-003**: After a simulated 24-hour absence and reload, displayed feed and survival times match the configured elapsed-time rules within one display tick.
- **SC-004**: All ten level capacities match the specified sequence and each click advances by one level in an acceptance run.
- **SC-005**: A player can navigate from the DEV page to the house, maintain the aquarium, return, and open Keepnet without losing fish or feed state.

## Assumptions

- The initial eligible species is the existing `crucian_stalker` (“Карась-сталкер”); additional species can be configured later without introducing a second fish catalog.
- “Fish may be eaten by another fish” is represented in the initial version as randomized loss after starvation; predator interactions are a later mechanic.
- The explicit capacity table is authoritative where the informal progression formula is discontinuous (levels 4→5 and 9→10).
- One feed portion refills one selected species slot to 100%. Feed is species-specific by slot allocation, not by introducing separate consumable item types now.
- A newly created species slot starts empty and must be fed to protect its fish.
- The feature remains client-authoritative until the separately specified backend foundation is implemented; cloud progress format changes require their own coordinated contract update.
- The owner has supplied all five room levels, three light variants per level, the aquarium overlay, and the renovation overlay under `assets/house/room-1/`.
