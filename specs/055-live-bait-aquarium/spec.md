# Feature Specification: Live Bait, Keepnet, and Fisherman's House Aquarium

**Feature Branch**: `develop` (existing checkout; no branch created)  
**Created**: 2026-10-11  
**Status**: Implementation in progress; remaining work is tracked in `tasks.md`  
**Input**: Owner's live-bait, keepnet, aquarium, house, and free-action requirements. The owner requested English specification text.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Turn a small catch into live bait (Priority: P1)

After landing an eligible fish of any species, a player may claim it, release it, or turn it into live bait. The bait retains the individual fish's identity and can be selected for a later cast. If the player has an aquarium with room, the fish goes there; otherwise it goes to the keepnet with a visible survival countdown.

**Why this priority**: This is the smallest complete playable loop and establishes ownership of a caught fish.

**Independent Test**: Land crucian fish at 100 g and 101 g, exercise all three outcome choices, inspect the keepnet and selected bait, cast once, then reload and verify the resulting facts.

**Acceptance Scenarios**:

1. **Given** a landed crucian weighing exactly 100 g, **when** the player selects “Use as live bait”, **then** one live bait is created from that exact fish and placed in the aquarium if owned and not full, otherwise in the keepnet.
2. **Given** a landed fish heavier than 100 g, **when** the outcome appears, **then** the live-bait action is unavailable and claiming or releasing still works.
3. **Given** a live fish in the keepnet, **when** the configured survival duration expires, **then** it becomes unusable as bait and its loss is shown; it cannot be selected or cast.
4. **Given** an available live bait selected for a compatible hook, **when** a cast consumes that bait, **then** that fish is removed exactly once and its hook movement uses the common configured swim profile at 50% output, independently of its retained skin.

---

### User Story 2 - Inspect a separate keepnet (Priority: P2)

The player opens a “Keepnet” button next to Inventory. It opens a matching two-column panel: keepnet view and parameters on the left, caught fish and filters on the right. Live fish show remaining time. Only the house aquarium accepts feed.

**Why this priority**: Players need a clear place to find claimed catches and dying live bait.

**Independent Test**: Open and close both panels, filter multiple catches, and observe a live-fish countdown without changing inventory equipment or feeding the keepnet.

**Acceptance Scenarios**:

1. **Given** claimed catches and live fish, **when** Keepnet opens, **then** the left side shows its view and parameters and the right side shows fish with functional filters.
2. **Given** a live fish in the keepnet, **when** the panel is open, **then** its countdown is visible and updates without needing a page reload.
3. **Given** either panel is open, **when** the other button is used, **then** focus and closing behavior remain coherent and the player is not left behind overlapping modal dialogs.
4. **Given** several retained fish of the same species, **when** Keepnet opens, **then** one thumbnail card represents that species with its individual count in the bottom-right corner. Filters apply before grouping; capacity still counts individuals.
5. **Given** a species card, **when** it is activated, **then** the same dialog shows every individual with its own caught image, weight, saved rarity, level and live-bait timer. Back/Escape restores the species overview; countdown refresh retains focus, images and scroll position.
6. **Given** an individual detail card, **when** the player converts, selects, transfers or releases it, **then** the existing application command acts on that exact fish ID. Release requires an inline confirmation, stale/expired fish report an error, and the last removed individual returns the dialog to the overview.

---

### User Story 3 - Keep bait alive in an aquarium (Priority: P3)

The player visits the Fisherman's House and keeps all live bait in one aquarium. A shared feed bar appears above the aquarium only after aquarium feed is added, with a circular feed image on the left and the bar vertically centered to its right. Aquarium feed is separate from ordinary fishing groundbait. When feed expires, a starvation countdown begins; each inhabitant has an independently randomized death deadline within the last feed quality's survival window. Feeding survivors cancels those deadlines. Species affect skins, not care or bait identity.

**Why this priority**: It provides the intended long-term care loop and a scalable house interface.

**Independent Test**: Feed several species together, verify all eleven pack durations and population penalties, exhaust each quality, reload during starvation and rescue survivors.

**Acceptance Scenarios**:

1. **Given** an owned aquarium, **when** an eligible fish enters, **then** it joins the shared population and retains its skin and identity.
2. **Given** several species and a selected feed pack, **when** feeding, **then** one pack protects every inhabitant for the population-adjusted duration.
3. **Given** positive shared feed, **when** real time passes, **then** the bar decreases and every aquarium inhabitant stays protected.
4. **Given** depleted feed, **when** time advances, **then** individual fish die at their saved random deadlines within the quality window; reload and repeated display refreshes cannot reroll them, and timely refeeding rescues survivors.
5. **Given** the house page, **when** the player navigates left or right, **then** the room viewport changes without losing aquarium state.

---

### User Story 4 - Upgrade care without currency (Priority: P4)

The aquarium, feed portions, automatic feeder, and each one-level capacity upgrade have working buttons with the Ukrainian price label “Безкоштовно” (“Free”). The feeder uses available feed stock while the player is away. No wallet, payment, or premium entitlement is introduced.

**Why this priority**: All requested controls must work during the current no-currency development stage.

**Independent Test**: Obtain each free item, upgrade from level 1 to 10 one click at a time, check each capacity, exhaust feed stock with the automatic feeder, and verify that no balance changes occur.

**Acceptance Scenarios**:

1. **Given** no aquarium, **when** its “Безкоштовно” button is pressed, **then** it is installed at level 1 with capacity 5.
2. **Given** a level below 10, **when** Upgrade is pressed once, **then** level increases by exactly one and capacity follows the specified table.
3. **Given** an enabled feeder and selected aquarium-feed stock, **when** shared feed reaches its configured threshold, **then** one pack refills protection for all inhabitants; empty stock cannot create feed.
4. **Given** any requested purchase action, **when** it is completed, **then** the price reads “Безкоштовно” in the UI and no currency state is created or required.

---

### Edge Cases

- Exactly 100 g is eligible; invalid, missing, or negative catch weights are not. If the aquarium is full, an eligible catch goes to the keepnet and the player is told why.
- A fish cannot be claimed, released, or converted twice. A dead, released, or consumed fish cannot return to live storage.
- Keepnet time begins when bait enters it. A house transfer does not reset elapsed keepnet time. A transfer into an unfed aquarium remains at risk.
- Feeding replaces the active pack and cancels the current starvation episode for survivors. A new depletion starts a new episode. Before the first feeding the default Simple one-hour window applies, but no feed bar is shown.
- On reload or return from another page, elapsed real time is applied once in chronological order before the view is shown. Backward wall-clock changes cannot extend timers.
- Equal death deadlines remain valid coincident random outcomes; the gameplay rule is independently randomized deadlines across a quality window, replacing the old death-order tie requirement T050.
- A room or fish asset that is absent uses an accessible placeholder; missing art does not prevent gameplay.
- At level 10 the upgrade action is disabled. Feed cannot be applied to a nonexistent or empty aquarium.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Claim, Release, and Use as live bait MUST be available for every configured fish species at positive weight up to 0.100 kg inclusive.
- **FR-002**: Each landed fish MUST have one stable identity and one current disposition. A successful outcome action MUST change that disposition exactly once.
- **FR-003**: All eligible fish MUST use one common live-bait identity. Individual source species, artwork, weight, rarity and unique/anomaly facts remain attached to the fish record. The existing bait-only hook movement remains separate from wild-fish fights.
- **FR-004**: Keepnet/hook unfed lifetime MUST remain sampled once from the configured 30–60 minute range and preserved across reload. Aquarium starvation uses its own quality-based episode deadlines.
- **FR-005**: An eligible converted fish MUST enter an owned aquarium if capacity permits, otherwise the keepnet. Keepnet fish MUST lose survival time and MUST NOT accept feed.
- **FR-006**: The Keepnet button MUST appear beside Inventory and open a separate two-column view with a left keepnet visual and parameters and a right fish list and working filters.
- **FR-007**: The aquarium MUST have one shared feed bar for every inhabitant, independent of species. Show it above the aquarium only after the first feed addition, with a circular image and a horizontal bar to its right. At zero show a countdown to the end of the starvation window and the next death.
- **FR-008**: Feed protection MUST shrink over real elapsed time. Duration is base pack duration minus its penalty for each additional fish beyond the first, clamped to a configurable one-minute minimum. Population changes recompute total duration without resetting elapsed time.
- **FR-009**: One feeding action MUST consume one selected aquarium-feed pack and replace the shared feed with that pack at full duration. Species-specific feed slots and their priority rule are removed.
- **FR-010**: When shared feed reaches zero, each living aquarium fish MUST receive one death deadline in (episode start, episode start + survival window], independently randomized and persisted/reproducible. Windows are Simple 1 hour, Good 3 hours, Premium 6 hours. By the end all unrescued inhabitants die. Refeeding cancels surviving deadlines; dead fish stay dead.
- **FR-011**: Aquarium feed packs, aquarium, automatic feeder and upgrades MUST have working Free controls. The feeder uses the selected pack from its finite stock at the configured threshold and protects the whole aquarium. It cannot substitute ordinary fishing groundbait.
- **FR-012**: Aquarium levels 1–10 MUST have capacities 5, 6, 7, 8, 16, 18, 20, 22, 24, and 48 respectively. One upgrade action MUST raise exactly one level.
- **FR-013**: All new numeric gameplay parameters, including lifetime range, movement reductions, feed rate/count scaling, feed portion behavior, capacity schedule, and feeder trigger, MUST come from feature configuration.
- **FR-014**: The Fisherman's House MUST be a separate page with room navigation left and right. A DEV-only temporary navigation button MUST open it until a lobby exists.
- **FR-015**: The room background and aquarium art MUST be separate layers. Room 1 uses the supplied day/evening/night backgrounds for each of its five levels under `assets/house/room-1/lvl-1` through `lvl-5`; `room--1_aqua.png` remains a transparent layer above the table.
- **FR-016**: Catch, live-bait, keepnet, aquarium, feed, and feeder state MUST persist consistently across navigation and reload without rewriting unrelated existing saves or silently replacing them with defaults.
- **FR-017**: A selected live bait MUST enter the existing compatible fishing flow and be consumed exactly once according to a documented cast/bite/loss rule. An expired fish MUST never remain selectable.
- **FR-018**: A common live-bait catalog identity MUST be used for every eligible source species, without duplicating fish into inventory bait records.
- **FR-019**: Game time MUST have one persistent source shared by the fishing location and house page. Both surfaces MUST use the same day/evening/night blend thresholds and continue advancing across navigation.
- **FR-020**: Room 1 MUST have five persistent levels. Starting upgrades to levels 2, 3, 4 and 5 MUST take 2, 8, 16 and 48 real hours respectively; an active upgrade MUST survive reload and may be finished immediately with a working “Безкоштовно” control.
- **FR-021**: During renovation the room MUST show a dark translucent overlay, the supplied transparent `under-renovation.png` at full brightness, a central countdown and a completion button.
- **FR-022**: The house page MUST use a full-viewport room scene, compact functional controls, and upward-opening bottom menus. Decorative headings and prose without an action or useful state MUST be removed.
- **FR-023**: The fixed translucent house header MUST slide into view on downward scroll and hide on upward scroll.
- **FR-024**: Keepnet MUST use square species stack cards with centered caught artwork and bottom-right counts. Choose representative by highest known rarity, then highest weight, then stable fish ID. Any anomalous or unique fish MUST have an individual card; unknown historical special status is conservatively kept separate. Detail actions still target exact individual IDs.
- **FR-025**: A live bait on the hook MUST reserve one keepnet slot for safe retrieval. A new fishing session MUST return an interrupted surviving hook fish to the keepnet without resetting its lifetime; creating the house service MUST NOT cancel an active cast. Expiry, feed projection and automatic feeder thresholds MUST agree between display updates, commands and offline settlement.

### Key Entities *(include if feature involves data)*

- **Caught fish**: One landed individual, with stable ID, species ID, weight, and disposition.
- **Live-bait type**: One common configured bait identity for every eligible species; individual bait is a designated caught fish.
- **Live bait**: A living caught fish designated for use on a hook, with sampled survival duration and remaining time.
- **Keepnet**: The location for claimed catches and live bait without aquarium protection.
- **Aquarium**: Owned state, level, capacity, contained fish, shared feed and starvation episode.
- **Feed stock**: Count of available portions; consumed only by manual or automatic feeding.
- **Automatic feeder**: Owned and enabled state; acts on feed stock without generating it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a deterministic acceptance run, 100% of 100 g eligible fish of any species catches show all three choices and 100% of 101 g catches show only Claim/Release.
- **SC-002**: In 100 repeated outcome and cast scenarios, no fish is duplicated, consumed twice, or revived after death/release.
- **SC-003**: After a simulated 24-hour absence and reload, displayed feed and survival times match the configured elapsed-time rules within one display tick.
- **SC-004**: All ten level capacities match the specified sequence and each click advances by one level in an acceptance run.
- **SC-005**: A player can navigate from the DEV page to the house, maintain the aquarium, return, and open Keepnet without losing fish or feed state.

## Assumptions

- Every catalog species is eligible up to 100 g.
- Aquarium losses represent starvation. Predator interaction inside the aquarium is outside this revision.
- The explicit capacity table is authoritative where the informal progression formula is discontinuous (levels 4→5 and 9→10).
- Inventory owns aquarium-feed pack stock, separate from ordinary groundbait. The aquarium feature stores active protection, selection and feeder settings.
- One-fish durations are the table baseline; penalties apply to N−1 additional fish. Refeeding replaces rather than accumulates duration. New arrivals during starvation join the remaining episode window and cannot extend its end.
- The feature remains client-authoritative until the separately specified backend foundation is implemented; cloud progress format changes require their own coordinated contract update.
- The owner has supplied all five room levels, three light variants per level, the aquarium overlay, and the renovation overlay under `assets/house/room-1/`.

## Owner revision: shared aquarium feed and fish presentation (2026-10-12)

This revision supersedes species-specific feed allocation and the unused death-order tie mechanic.

| Quality | Pack grams → one-fish minutes | Penalty per additional fish | Starvation window |
| --- | --- | --- | --- |
| Simple | 500 → 30; 1000 → 60; 1500 → 90 | 5 minutes | 1 hour |
| Good | 500 → 40; 1000 → 80; 1500 → 120; 3000 → 240 | 4 minutes | 3 hours |
| Premium | 500 → 60; 1000 → 120; 1500 → 180; 5000 → 600 | 3 minutes | 6 hours |

- **FR-026**: Aquarium fish MUST initially render as approximately 10×10 px thumbnail skins, moving slowly with independent random direction changes inside a bounded aquarium area. Visual motion never owns gameplay or care state.
- **FR-027**: Fish size, size spread, speed range, direction-change interval range, normalized aquarium zone coordinates, and green debug grid visibility MUST be editable through DEV configuration, including the embedded house preview.
- **FR-028**: Fish thumbnails MUST be generated as separate reduced-resolution assets through the image conversion utility; full-resolution caught art remains intact. Missing thumbnail artwork uses an accessible fallback.
- **FR-029**: Snapshot v1/v2 MUST migrate to v3 without changing inventory v4 or resurrecting terminal fish. Old feed stock becomes Simple 500 g packs. The smallest occupied old slot fraction becomes shared Simple protection; existing starvation time is retained for legacy unfed fish. Unknown historical anomaly/unique facts MUST remain unknown rather than inferred from current rarity balance.

Acceptance: verify every table entry for one and three fish; all inhabitants protected while feed is positive; distinct repeatable random deadlines bounded by each quality window; rescue and re-depletion; long offline intervals and backward clocks; stock exhaustion; ordinary groundbait isolation; safe legacy migration; representative art and special-fish isolation; bounded visual movement and DEV editing.

## Owner revision: inventory feed packs and mobile controls (v0.34.1)

- **FR-030**: Each of the eleven aquarium-feed packs is a separate catalog item held in the existing inventory. DEV Tools acts as a temporary free shop, grouped into labeled sections with buttons in the DEV style. Acquired packs appear under Groundbait → For aquarium; ordinary fishing groundbait remains separate in use.
- **FR-031**: Inventory categories and checkbox subfilters support smooth native touch scrolling with inertia on phones, preserving mouse grab/wheel controls and taps on checkboxes.
- **FR-032**: The aquarium Feed button toggles its own list container. Only available positive-quantity inventory packs appear. Each wrapper row has a square image/emoji and quantity badge on the left, name in the center and square [+] action on the right. No free acquisition control remains on the aquarium page.
- **FR-033**: A pack count of one feeds immediately. With two or more, open a centered accessible quantity dialog showing quantity, square [−]/[+] controls, a draggable horizontal slider from 1 to available count, Confirm and Cancel. Cancellation consumes nothing; stale counts must not overspend.
- **FR-034**: Feeding quantity Q consumes exactly Q inventory packs and sets shared protection to max(minimum, pack base × Q − penalty × (N−1)). Population penalty applies once to the combined amount; feeding still replaces current protection. The active cell records pack and applied quantity. The feeder consumes one selected pack per refill.
- **FR-035**: Inventory records are the sole stock owner. Prior feature stock migrates once into inventory. Feature snapshot v4 removes persisted stock and adds active quantity; inventory remains schema v4. Feed consumption and feature activation commit together with recoverable write-ahead persistence. Corrupt bytes, stale writes, storage failures, read projection, reload and interrupted migration cannot duplicate packs or claim unsaved success.

Acceptance: buy each pack in DEV, inspect Groundbait/For aquarium filter, use one/count/multi slider/Cancel, deplete exact quantities, reload and recover interrupted writes. Verify a two-item stock produces exactly two rows. Test phone category/subfilter swipe and checkbox taps, plus desktop mouse dragging.
