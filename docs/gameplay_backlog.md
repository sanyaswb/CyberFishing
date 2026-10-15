# Gameplay backlog

The single list of gameplay bugs, mechanics and balance work. Process: the "Gameplay changes" rules in
[DEVELOPMENT_RULES.md](../DEVELOPMENT_RULES.md). Structural cleanup stays in
[refactoring_remaining.md](refactoring_remaining.md).

Priority: **P1** breaks a session or loses progress · **P2** wrong gameplay result · **P3** polish, feel, noise.
Status: open → in progress → done (commit) or rejected (reason).

## Entry template

```text
### G-NNN Title (P?, status)
Found: date, by whom, where (index/dev, version).
Reproduce: steps or deterministic scenario.
Expected: …
Actual: …
Notes: suspected owner module, related checks.
```

## Open

### G-059–G-060 Owner reports of 2026-10-15, later (P3, done)
- G-059 Hints had three styles; the keepnet help was clipped by its column and the House notice was fixed to the viewport: one `ui-hint` with a close button, inside its container ([spec 080](../specs/080-hints-in-containers/spec.md)).
- G-060 House clock skipped minutes (01 → 04): it refreshed once per second while game time runs at x240; it now updates on every game minute ([spec 081](../specs/081-house-clock-every-minute/spec.md)).

### G-052–G-058 Owner inventory/input reports of 2026-10-15 (P2/P3, done in v0.36.0)
- G-052 Header bait glyph sat ~4px right/1px low (emoji advance wider than its grid box): one shared ui-glyph centred by measured ink ([spec 073](../specs/073-glyph-ink-centring/spec.md)).
- G-053 Wide header had four sections; header circles did not apply a waiting bait/chum; wide picks switched to the backpack although the list was visible; backpack/keepnet filters and items shared one panel ([spec 074](../specs/074-header-sections-and-collections/spec.md)).
- G-054 Portrait backpack had no backpack stats; filters reserved empty rows; container gaps differed ([spec 075](../specs/075-backpack-pager-and-capacity/spec.md)).
- G-055 Map drags with a rod lacking reel/line showed the equipment warning; dragging over a card selected it instead of scrolling (P2, [spec 076](../specs/076-scroll-input-fixes/spec.md)).
- G-056 Backpack list stopped scrolling vertically after the pager (unstyled wrapper broke the height chain; spec 076 follow-up).
- G-057 Wide left column: tab bar and each section painted their own backgrounds; one sidebar parent now owns it ([spec 077](../specs/077-inventory-sidebar-parent/spec.md)).
- G-058 Portrait rodless rod cell ran under the auxiliary row (viewport estimate of the header): equipment sized from its real row ([spec 078](../specs/078-portrait-equipment-real-size/spec.md)).

### G-051 Switch containers are taller than their tracks/close and desktop placement is left-aligned (P3, done in v0.36.0)
Found: 2026-10-15, owner mobile/landscape reference review.
Reproduce: open the three-bait header in landscape/desktop; browser measured 72px pills versus 44px tracks and close, with the group 259px left of center at a 960px preview.
Expected: common control height, aligned borders and small left item inset in both phone orientations; desktop switch group centered across the upper row.
Actual: independent outer/track/close heights, portrait-only compact styling and a left-aligned group.
Fix/evidence: remove independent outer height and vertical padding, inject one header height into close and switches, share compact geometry across orientations, and use symmetric desktop grid columns. Browser checks at 240–960px confirm equal height/top edges, fitting five-slot contents and zero desktop center offset.
Validation: real index 1280×800 and DEV 600×340 show 44px for every pill/track/close with aligned top edges and no console warnings/errors; Architecture 4/4, Quick 25/25 and Full 51/51 pass.

### G-050 Backpack items have no separate rounded container (P3, done in v0.36.0)
Found: 2026-10-15, owner portrait backpack review.
Reproduce: open the backpack; its transparent item panel merges with the large backpack illustration behind it.
Expected: one opaque rounded item container like the equipment panels, filling all free space with style-consistent padding and insets.
Actual: the portrait override deliberately removes the panel background and boundary.
Fix/evidence: reuse the existing inventory-panel mix, equipment background and panel radius; remove the transparent override and reserve a bottom inset. Browser verifies an opaque rounded full-height panel, four columns and internal scrolling.

### G-048 Narrow bait cells clip art and expose square selection borders (P3, done in v0.36.0)
Found: 2026-10-14, owner's 336px screenshot with two worms and cast chum.
Reproduce: select a header bait slot; artwork sits in a roughly 17px-wide, 30px-tall cell and receives a square outline.
Expected: complete artwork inside separated circles, a circular border only for selection/focus, and opaque automatic-mode surfaces.
Actual: art is squeezed/cropped, selection is rectangular, and active background tints are transparent.
Fix/evidence: one shared switch style owns circular artwork, count separation and opaque state colors. Browser checks at 240–960px cover three bait/two chum slots, round bounds and non-overlapping counts.

### G-049 Header weight uses space needed by bait icons (P3, done in v0.36.0)
Found: 2026-10-14, owner portrait header review and fixed-100kg clarification.
Reproduce: open the narrow header with multiple bait slots, weight and close button.
Expected: weight as a lower row inside inventory-header, with a 100kg scale and icon left; 1kg fills 1%. Mobile spans the header content width; desktop follows the left panel width.
Actual: the weight badge competes for header width and has no scale.
Fix/evidence: separate header load row, shared header/main column properties, presentation config and a small renderer that reuses the shared resource meter. Focused checks cover lower-header containment, 1%/100% clamping and stable meter nodes; browser verifies mobile width and exact desktop-column alignment.

Validation for G-048–G-050 (2026-10-15): Architecture 4/4, Quick 25/25 and Full 51/51 pass with the unchanged
game-cycle baseline. Index/DEV browser smoke confirms the header-contained scale and rounded backpack panel;
DEV warning/error logs are empty. Owner visual/play acceptance is pending.

### G-042 Portrait inventory header changes composition at 520px (P3, done in v0.36.0)
Found: 2026-10-14, owner browser review.
Reproduce: use three bait slots and resize portrait through 520/521/600px while the side panel is hidden.
Expected: proportional header geometry through 820px, with numbers below artwork and all controls inside the row.
Actual: desktop icon dimensions appeared above 520px; icons/counts overlapped and controls stopped fitting.
Fix/evidence: one header unit and coordinated 820px composition; browser geometry checks at 240/280/319/320/520/521/600/740/820px confirm fitting pills and separated counts. The side panel appears at 821px.

### G-043 Equipped bait keeps the generic placeholder (P3, done in v0.36.0)
Found: 2026-10-14, owner portrait inventory review.
Reproduce: equip a worm whose catalog art is an emoji rather than an image URL.
Expected: actual equipped bait artwork replaces its empty-slot placeholder.
Actual: the generic bait SVG took precedence over the item's icon.
Fix/evidence: shared renderer chooses actual image/icon for filled slots; focused check and index/dev browser checks show the worm artwork.

### G-044 Automatic switch loses its movement on refresh (P3, done in v0.36.0)
Found: 2026-10-14, owner portrait inventory review.
Reproduce: toggle automatic bait and inspect thumb positioning and DOM identity.
Expected: working checkbox, smooth transform animation and retained focus across mode/numeric updates.
Actual: layout overrides made the thumb static and full header replacement interrupted its transition.
Fix/evidence: restored transform track, in-place header/switch updates and listener disposal checks; browser confirms transform changes and the shared 180ms transition in index/dev.

### G-045 Equipping from backpack leaves the changed equipment out of view (P3, done in v0.36.0)
Found: 2026-10-14, owner portrait inventory review.
Reproduce: equip a rod from the backpack into an empty rod slot.
Expected: return to equipment and flash the changed slot green once.
Actual: the item equipped but the backpack stayed open without this feedback.
Fix/evidence: transient feedback revision, automatic section selection and one-shot CSS flash; focused command/UI checks and production browser confirm rod tab/flash and no replay on refresh.

### G-046 Bare hook opens an empty crafting menu (P3, done in v0.36.0)
Found: 2026-10-14, owner portrait inventory review.
Reproduce: select a compatible loose hook after equipping a rod and line.
Expected: equip directly; bait is chosen through the header.
Actual: the removed bait socket left the player in an empty craft editor.
Fix/evidence: atomic prepare/equip through existing assembly operations; focused integration and production browser confirm equipment tab, fitted hook and no craft panel.

### G-047 Consumable counts ignore manual mode and duplicate uniform bait stock (P3, done in v0.36.0)
Found: 2026-10-14, owner count clarification.
Reproduce: fill three hooks with different baits, disable automatic mode, then use three identical baits.
Expected: manual mode shows total 3 and 1/1/1 for different baits; uniform filled slots show only the total in both modes. Automatic mode shows deduplicated available reserve.
Actual: backpack reserve remained visible in manual mode, and identical slot counts repeated the same pool.
Fix/evidence: the manual-mode regression failed before the fix; focused renderer, reserve-signature and integration checks cover modes, freshness/variant identity and partial targets. Browser confirms 102 + 12/80/10, 3 + 1/1/1, uniform automatic 12/manual 3 with hidden individual counts.

Validation for G-038–G-047: Architecture 4/4, Quick 25/25 and Full 51/51 pass; game-cycle baseline unchanged.
Index/dev browser smoke passes with no warning/error logs in the changed flow. Behavior is documented in
[inventory-behavior.md](inventory-behavior.md). Owner visual/play acceptance is pending.

### G-041 Header pills hide a third bait and its reserve (P3, done in v0.36.0)
Found: 2026-10-14, owner `inventory-switcher-mob-v2.png` sketch.
Reproduce: equip three different baits with backpack reserves 12/80/10 and leave cast chum empty.
Expected: three separate icons with their quantities below, total 102 beside A, an empty pill with total zero, and a compact close button in the mobile header row.
Actual: the earlier compact contract capped the icons at two and showed no individual reserves.
Fix/evidence: spec 072 v2 header; focused checks failed before the change and pass for exact reserves, deduplicated totals and independent third-slot replacement. Architecture, Quick and Full required; owner visual acceptance pending.

### G-038 Backpack shortcut reopens the previously selected keepnet (P2, done in v0.36.0)
Found: 2026-10-14, owner portrait inventory review.
Reproduce: open keepnet, close the inventory, then press the location backpack button; also press backpack while keepnet is open.
Expected: select the requested backpack section; pressing its shortcut while already there closes it.
Actual: the generic toggle reopened keepnet or closed the wrong section.
Fix/evidence: section-specific shortcut; the focused UI regression failed before the fix and passes after it.

### G-039 Bait selection remains nested inside hook crafting (P3, done in v0.36.0)
Found: 2026-10-14, owner portrait inventory review and sequential-selection clarification.
Reproduce: equip one/two hooks, then try to select or replace bait through the header; inspect hook cards.
Expected: available header icons, one-click sequential filling, one proposed replacement with repeat-click confirmation; worm beside worm + bread proposes replacing bread.
Actual: the icons only toggled automatic mode; hooks exposed nested bait compartments and selection.
Fix/evidence: spec 072; focused checks verify exact stock changes, no mutation during proposal, highlighting, cancellation and lock policy. Owner visual acceptance pending.

### G-040 Chum header includes hand and boat supplies (P2, done in v0.36.0)
Found: 2026-10-14, owner portrait inventory review.
Reproduce: equip cast chum, hand chum and boat cargo, then inspect the header pill.
Expected: only cast-tackle chum and its refill stock; configured multiple slots follow the bait icon contract.
Actual: the header combined all three sources and showed multiple unrelated portions.
Fix/evidence: tackle-only target projection and refill scope; the focused integration regression failed before the fix and passes after it.

### G-036 House day/night images step instead of blending (P3, done in v0.36.0)
Found: 2026-10-14, owner House review against the test location.
Reproduce: open the House around 17:00–21:00 or 05:00–09:00 game time (timeScale 240, optionally DEV ×5) and watch the room art.
Expected: the same continuous crossfade and layer composition as the test location.
Actual: opacity changed only on the 1 s House refresh (3–17 % jumps); the House always stacked three layers.
Fix/evidence: shared `timeOfDayLayers` for location Canvas and House DOM; House blends each refresh with a linear CSS transition. Map/House layer and no-write checks in house-check. Spec 063; owner visual acceptance pending.

### G-037 House DevTools ignore aquarium visual edits and miss validation (P3, done in v0.36.0)
Found: 2026-10-14, owner DEV House review.
Reproduce: dev.html → House, DevTools → CONFIG.liveBait.visual: change gridSizePx or showZone.
Expected: the aquarium grid/zone reacts immediately; House DevTools validate edits like the location page.
Actual: the motion keeps the startup snapshot of the frozen liveBait config; no validation, production item catalog.
Fix/evidence: House startup applies `config-updated` visual edits; shared DEV validation composition. The startup check failed before the fix. Spec 064; owner check pending.

### G-033 Selected feed is separate from active information and cannot reopen its list (P3, done in v0.35.0)
Found: 2026-10-14, owner House review and compact-text correction.
Reproduce: choose a feed, inspect the remaining open list, plain preview and separate active-feed caption; try clicking the preview to change the draft.
Expected: one shared item row right of the equal-height action; selection closes the list, preview reopens it, text is compact and warnings remain below. Disabled action reads Load when reserve exists.
Actual: list remains open, preview lacks row styling/quantity, active information is duplicated and preview cannot reopen selection. Putting the warning inside the row makes it oversized.
Fix/evidence: the focused selection-close check failed before the fix. One row template/style now owns preview/list rendering; countdown and available-stock label checks pass with stock, failure and remount scenarios. Spec 062; owner visual/input acceptance pending.

### G-034 Desktop menu changes height while the mouse moves between its buttons (P3, done in v0.35.0)
Found: 2026-10-14, owner mouse review.
Reproduce: hover a compact dock button, then move through a gap or handle without leaving the container.
Expected: hold container height while the cursor remains inside; the handle has no hover highlight and cannot initiate expansion.
Actual: individual hover loss shrinks the container and shifts its handle/buttons; the handle also highlights.
Fix/evidence: HouseView latches desktop mouse hover until dock exit, with a CSS minimum height matching the compact/full button transition. Focused checks cover gaps, handle, exit, touch/hybrid policy, 100 events/one write and listener disposal. Shared handle custom property removes only this instance's hover background. Owner visual/input acceptance pending.

### G-035 House buttons stay full-width on desktop and repeat stat words (P3, done in v0.35.0)
Found: 2026-10-14, owner layout request.
Reproduce: inspect House install/upgrade actions in landscape and aquarium target level/capacity.
Expected: content width with padding in landscape, full container width only in portrait, and shared level/fish icons with target numbers in upgrade.
Actual: actions are always stretched, and upgrade repeats level/capacity words.
Fix/evidence: responsive container styles and a shared SVG symbol source implement the layout; numeric target/accessible-name and shared catalog checks pass. Owner visual acceptance pending.

### G-029 Aquarium refeeding discards time and can consume fresh packs repeatedly (P2, done in v0.35.0)
Found: 2026-10-14, owner feeding-mechanic request.
Reproduce: load Simple, immediately load Premium, or load it at exactly half of the Simple duration.
Expected: reject choice/loading before 50% elapsed; then add new protection to the remainder, display the latest feed and restart the gate.
Actual: every load immediately consumes inventory and replaces the previous protection.
Fix/evidence: the initial deterministic regression failed on immediate fresh-pack consumption. Shared domain budget, command gate and snapshot v5 carry preserve time and inventory across reload/offline, population changes, stale second-page commands and transaction recovery. Spec 061; Architecture 4/4, Quick 25/25, Full 51/51 and console-only smoke pass. Owner play acceptance pending.

### G-030 Feed rows consume immediately and require plus/quantity controls (P3, done in v0.35.0)
Found: 2026-10-14, owner House request.
Reproduce: open feeding, press a row's plus control; compare one-pack and multi-pack stock behavior.
Expected: whole-row selection of exactly one draft; the main action becomes Load and consumes one pack only after confirmation, with the selected item previewed on the right.
Actual: one pack consumes immediately; larger stocks open a quantity dialog.
Fix/evidence: production picker replaces the dialog with semantic row buttons, shared selected styles, deferred confirmation, lock explanation/focus and changed-stock handling. Catalog uses the same picker and time policy. Focused picker/catalog lifecycle checks pass; owner visual/input acceptance pending.

### G-031 Aquarium counter position and reserve row no longer match the owner layout (P3, done in v0.35.0)
Found: 2026-10-14, owner revised layout.
Reproduce: inspect level/capacity status and the reserve text in the House panel.
Expected: label on the left, count on the right, scale below; the reserve row is replaced by feeding and its item preview.
Actual: counts are below the scale/label per the earlier layout request, and reserve text consumes a separate row.
Fix/evidence: shared parameter headers and production HTML implement the new layout; focused House markup checks and the actual catalog view pass. Supersedes G-027's count/reserve placement. Owner visual acceptance pending.

### G-032 Initial aquarium fish and swimming zone are too small (P3, done in v0.35.0)
Found: 2026-10-14, owner visual tuning request.
Reproduce: use the initial visual configuration in the House/catalog aquarium.
Expected: nominal fish size 60px and relative zone width 0.80.
Actual: size 10px and width 0.65.
Fix/evidence: configuration values changed with their existing origins, height, spread and boundary-fitting policy retained. Deterministic motion checks still keep every fish inside its zone. Owner visual acceptance pending.

### G-026 House sheet disappears below the viewport and jumps back on release (P3, done in v0.35.0)
Found: 2026-10-14, owner visual/input review.
Reproduce: drag a sheet handle down and release; drag upward on desktop.
Expected: smooth height collapse ending at the persistent compact footer, without a reset or replayed entrance animation.
Actual: release resets the drag transform before dismissal, full-sheet translation goes offscreen, then the compact footer returns; removing drag state can restart the entrance animation.
Fix/evidence: shared height animation replaces translation/keyframes; dismissal is selected before visual reset. Focused checks cover the release value, compact target, upward settling, scaled coordinates, cached geometry, bounded resize writes and complete cleanup. Owner visual/input acceptance pending.

### G-027 Aquarium status duplicates upgrade text and scatters counts/actions (P3, done in v0.35.0)
Found: 2026-10-14, owner House review.
Reproduce: inspect aquarium level/capacity/feed stock and compare aquarium/auto-feeder install buttons.
Expected: readings below level scales; continuous grey/free-capacity meter filled green-to-red by occupancy; reserve within status; one target level/capacity upgrade label and uniform primary install actions.
Actual: right-hand capacity count, duplicate next-level list, separate reserve row and differently styled feeder installation.
Fix/evidence: production markup and shared meter/button styles implement the layout; funded/unfunded presenter ports and occupancy boundaries are checked. Current prices remain zero and production has no wallet; no payment/save behavior is introduced. Catalog adds full/unaffordable examples. Owner visual acceptance pending.

### G-028 Automatic feeder remains interactive without usable stock (P3, done in v0.35.0)
Found: 2026-10-14, owner House review.
Reproduce: install/enable feeder, exhaust its reserve, then inspect or attempt to change the switch.
Expected: bare slider without an outer pill; disabled/inactive while no usable feed remains, with the enabled model preference retained.
Actual: nested outer pill and an active enabled switch with empty stock.
Fix/evidence: the empty-stock check fails before the fix. Shared compact switch styling removes the outer container; selected-stock availability controls disabled/checked display and disabled events cannot dispatch. Catalog no-feed state reuses the same sources. Owner visual/input acceptance pending.

### G-025 House footer lacks reference states and explicit touch navigation (P3, done in v0.35.0)
Found: 2026-10-14, owner screenshots and touch clarification, fisherman-house.
Reproduce: compare closed/hover/open footer states; on a phone swipe upward, choose a section and then another miniature; swipe down over the backdrop.
Expected: compact accessible icon row; upward gesture reveals all names; selected section opens with other buttons miniature; direct switching and downward dismissal work without hover. Mobile fills available width, wide layouts are capped; footer glass reuses header styling and has no black gradient.
Actual: footer is fully hidden by default, labels always visible when shown, hover only lifts 12px, a black gradient/glow is retained, and open-sheet backdrop cannot receive the scene swipe.
Fix/evidence: the compact-footer accessibility check failed before the change. Production HTML, HouseView, shared sheet handles/gesture adapter and one CSS owner implement all states. UI catalog demonstrates the same compact/expanded/open states. Footer/sheet bottom borders are removed. Focused contracts verify switching, gesture cancellation, scaled handles, focus/disposal and styling reuse; Architecture 4/4, Quick 25/25, Full 51/51 and console-only loads pass with the unchanged game-cycle baseline. Owner visual/input acceptance pending.

### G-021 Fullscreen border differs from adjacent controls (P3, done in v0.35.0)
Found: 2026-10-14, owner review, shared game/House HUD.
Reproduce: compare fullscreen with the clock and other buttons.
Expected: common border thickness and appearance.
Actual: fullscreen uses a 1px green border while neighbouring controls use 2px borders.
Fix/evidence: HUD and toolbar share border width/color tokens; fullscreen no longer overrides the border. Shared style contracts and owner visual acceptance apply.

### G-022 Version jumps above bottom actions on narrow screens (P3, done in v0.35.0)
Found: 2026-10-14, owner review, index/dev v0.34.4.
Reproduce: shrink the viewport through 520px with the version badge visible.
Expected: version stays at the bottom action edge with equal height/gaps; excess text clips horizontally.
Actual: a media query changes the badge's bottom offset from 8px to 72px.
Fix/evidence: one composed `GameToolbar` flex row owns bottom placement and visible action spacing; badge shrink/clip has no breakpoint jump. Focused lifecycle/style contracts cover planned widths 240–1920px and production/DEV startup cleanup. Owner visual acceptance pending.

### G-023 Opposite House gesture switches panels immediately (P3, done in v0.35.0)
Found: 2026-10-14, owner review, House navigation.
Reproduce: open the header, then swipe/scroll upward once; reverse from the open category menu.
Expected: first close the opposite zone, then open the requested zone with another gesture; wheel input controls panels only.
Actual: one gesture switches zones; multiple wheel events can issue multiple commands and horizontal wheel pans the room.
Fix/evidence: `house-check` and `house-navigation-check` failed before the fix. State transitions close before opening; a direction/idle-gap wheel latch emits one command per burst without horizontal pan. Inventory wheel behavior is preserved. Owner input acceptance pending.

### G-024 House sheet floats above the bottom and mismatches dock width (P3, done in v0.35.0)
Found: 2026-10-14, owner review, room/aquarium/bait sheets.
Reproduce: open any category sheet on mobile or desktop.
Expected: sheet touches the bottom edge; buttons sit within its width with side insets of 20px mobile / 40px desktop.
Actual: sheet bottom is 94/106px above the screen and its 740px maximum width differs from the 1100px dock.
Fix/evidence: shared outer width and dock-height tokens anchor sheets at zero bottom, reserve content clearance and set the requested button insets. Focused CSS geometry contracts pass; owner visual acceptance pending.

### G-020 House navigation prototype leaves gaps on ultra-wide screens (P2, done in v0.35.0)
Found: 2026-10-14, owner review, House navigation prototype.
Reproduce: choose a 21:9 or wider viewport and inspect the room's left/right sides.
Expected: fill the viewport using the same cover principle as the test location.
Actual: height-only art sizing leaves empty side regions when the viewport is wider than the artwork.
Fix/evidence: art width uses `max(viewport width, viewport height × artwork ratio)` with centred vertical overflow. All five room levels are verified as 2752×1536. The focused CSS geometry contract covers 21:9 and 32:9; final visual acceptance belongs to the owner.

### G-018 House interior cannot be explored (P2, done in v0.35.0)
Found: 2026-10-14, owner request, Fisherman's House v0.34.4.
Reproduce: open the separate House page on a portrait viewport and drag or wheel over the room artwork.
Expected: pan through the full room with the map's inversion/sensitivity/distance settings; HUD and lower panels retain their screen positions.
Actual: the artboard is centred in a clipped scene; gestures only toggle the header/dock.
Fix/evidence: `utils/house-navigation-check.js` failed on touch movement before the fix. House composes the existing horizontal scroll adapter with manual scene gestures, physical/logical coordinate conversion and `input.mapPan`. Horizontal gestures pan the room; vertical gestures reveal header/menu, and background clicks toggle the zones. See [House navigation contract](../specs/060-house-navigation-header/spec.md). Commit and owner input acceptance pending.

### G-019 House header duplicates and relocates shared HUD controls (P3, done in v0.35.0)
Found: 2026-10-14, owner request, House/test comparison v0.34.4.
Reproduce: compare the clock/fullscreen controls on the test location and House, including accelerated DEV time.
Expected: reuse the same HUD components in one row with equal heights; scale the entire row when needed. The latest owner instruction adds borderless Play/category buttons and tap/swipe sheet dismissal.
Actual: clock/fullscreen have separate House sizes/positions and a scroll-controlled header; accelerated DEV time rearranges its rows.
Fix/evidence: common `hud-control` styles, `FullscreenControl` and `TimeDisplay`; bounded `HudRowSizer` adapts the single row. Header/menu visibility follows scene gestures, while shared sheet handles close panels with preserved focus/Escape and no cross. Architecture 4/4, Quick 25/25, Full 51/51 pass; console-only startup checks are clear. Commit and owner visual/input acceptance pending.

### G-016 Missing-rod warnings interrupt map navigation (P2, done in v0.35.0)
Found: 2026-10-14, owner request, index/dev v0.34.4.
Reproduce: with no equipped rod, press the map and drag horizontally with a finger or mouse.
Expected: distinguish a completed click from navigation; allow map exploration without opening Inventory. Equipped casting/fight and chum aiming keep their gestures.
Actual: power casting warns on pointerdown, and the viewport rejects panning while the pointer is held.
Fix/evidence: `utils/scouting-input-check.js` failed on the early warning before the fix. Pointer navigation is latched per gesture, accumulates movement between frames and supports injected inversion, sensitivity, distance and wheel settings. See [map input contract](../specs/059-map-navigation-input/spec.md). Commit and owner feel acceptance pending.

### G-017 Clock clicks fall through to fishing input (P2, done in v0.35.0)
Found: 2026-10-14, owner request, HUD clock in index/dev v0.34.4.
Reproduce: click the passive clock or disabled DEV time control without an equipped rod.
Expected: the clock owns its hit area in every state; enabled DEV acceleration clicks change time without a fishing warning.
Actual: the base clock has `pointer-events: none`, and only the active DEV variant intercepts hit testing.
Fix/evidence: the base clock accepts pointer hit testing and all clock variants use the existing UI event shield; focused coverage checks passive/disabled shielding. Commit and owner browser acceptance pending.

### G-009 DEV calendar acceleration (P3, done in v0.35.0)
Found: 2026-10-14, owner request, DEV game and Fisherman's House v0.34.4.
Reproduce: enable calendar acceleration under DEBUG and repeatedly click the time display.
Expected: DEV-only ×1.5 steps of0.5 through×5, then×1; the hours, day/night phase and House lighting advance together; production receives no acceleration rate. See [spec058](../specs/058-dev-time-controls/spec.md).
Actual: time display is passive, no controlled acceleration cycle, and House has no DEV tools.
Notes: transient multiplier on the shared calendar clock; fishing/real-time care remain unchanged. Validation/commit status recorded separately from owner browser acceptance.

### G-008 Live bait and aquarium care are not implemented (P2, in progress)
Found: 2026-10-11, owner request, index/dev v0.32.1.
Reproduce: land a 0.100 kg `crucian_stalker`, open the catch outcome, then inspect Inventory and the house page.
Expected: a third action converts the exact catch into live bait; the keepnet or fed aquarium owns its survival timer, and one selected survivor can be cast once. See [spec 055](../specs/055-live-bait-aquarium/spec.md).
Actual: Claim/Release only return to scouting; no caught-fish storage, survival, house runtime, or live-bait cast path exists.
Notes: use a fake clock and seeded RNG to check eligibility, single disposition, death/feeding, reload, and one-hook consumption.

### G-001 Fish developer diagnostics in the production console (P3, open)
Found: 2026-10-10, Claude, reading the fight composition (v0.32.0).
Reproduce: `index.html`, fight a fish until it is exhausted in phase 2, or until it breaks out of the centre while
mastery is applied.
Expected: the production console stays empty during a fight (the rule from spec 020).
Actual: production composition injects `ConsoleLogger` as the fight logger
(`bootstrap/production/fishing_services_composition.js`, `fightLogger`). `Fish` logs `[DEBUFF] …` and `[MASTERY] …`
lines through it.
Notes: confirmed by reading the code; not yet reproduced in the browser. Likely fix: production composes no fight
logger (or an inactive one) and DEV composes the console logger.

### G-003 Item cards show raw values instead of the display map (P3, open)
Found: 2026-10-11, Claude, browser check of spec 050 (dev.html).
Reproduce: open the inventory and hover the day float.
Expected: "Огрузка: Легка", "Кріплення: Глухий" (the `displayStats` maps in the item catalog).
Actual: "Огрузка light", "Кріплення fixed".
Notes: `InventoryItemParametersResolver` first adds rows from the raw effective stats. The mapped `displayStats` row
with the same parameter id is then skipped as already rendered.

### G-007 Bait boat ignores the water metric (P2, open)
Found: 2026-10-11, owner request after spec 053; verified by reading the code (develop b2aa5b1e).
Reproduce: test location (30 m profile), send a bait boat to the far edge of the castable water.
Expected: the boat keeps its speed in metres everywhere, so far away it covers fewer map pixels per second, like the
tackle since 053.
Actual: `BaitBoat.update` integrates speed, braking, arrival radii, sensors and drift in map pixels; far away it is up
to ≈ 6.4× faster in metres.
Notes: task in [054](../specs/054-bait-boat-water-metric/spec.md) (ground plane scope around `boat.update`, like
`GroundPlaneScope`).

## Owner play notes

## Fixed in v0.33.1

### G-009 Retained catches lose rarity and live-bait art (P2, done)
Found: 2026-10-12, Keepnet review.
Reproduce: retain a catch with numeric rarity 3/12, convert it and reload.
Expected: both catch and live bait show the same image and rating.
Actual: the save accepted strings only and discarded numeric rarity; live-bait views omitted art.
Fix/evidence: validated snapshot v2 and v1 migration; `keepnet_lifecycle_scenarios.js` failed on the missing rating before the fix and passes after it. Lost historical ratings remain unknown.

### G-010 Live-bait display and candidates disagree with elapsed care (P2, done)
Found: 2026-10-12, Keepnet review.
Reproduce: advance a fake clock past life expiry before the 10-second care tick, or keep the same species in a fed aquarium and an unfed keepnet.
Expected: expired fish are unavailable; aquarium feed protects only aquarium residents.
Actual: selected bait remained an attraction candidate; keepnet countdown incorrectly reused aquarium protection; auto-feed projection was absent.
Fix/evidence: detached event-time read projection, exact hook expiry check and persisted elapsed care even when a command is rejected; deterministic clock checks pass.

### G-011 Hook return can overflow the keepnet (P2, done)
Found: 2026-10-12, Keepnet review.
Reproduce: use a one-slot keepnet, cast its live fish, claim another catch, retrieve the bait.
Expected: capacity reserves the returning individual.
Actual: a hook freed its slot and retrieval could exceed capacity.
Fix/evidence: hook reservation and aquarium-cast capacity check; capacity regression passes.

### G-012 Automatic feeder ignores a nonzero configured trigger (P2, done)
Found: 2026-10-12, Keepnet review.
Reproduce: configure 50% trigger and ten-second feed duration, advance six seconds with one spare portion.
Expected: refill at five seconds, then display 90%.
Actual: settlement only scheduled feed exhaustion, leaving 40% at six seconds.
Fix/evidence: schedule the configured threshold as a care event; online/read/offline projections agree at 90%.

### G-013 Reload strands a living bait on an interrupted hook (P2, done)
Found: 2026-10-12, Keepnet review.
Reproduce: reload a fishing session after moving a selected fish to hook.
Expected: the surviving individual returns to the keepnet with remaining life.
Actual: new session has no cast ID but saved fish stays on hook and blocks selection.
Fix/evidence: fishing bootstrap explicitly recovers interrupted casts; house startup preserves active casts; reload checks verify life and identity, with no resurrection.

### G-014 Keepnet cannot inspect same-species catches clearly (P3, done)
Found: 2026-10-12, owner request.
Reproduce: retain several fish of one species with different weights and images.
Expected: one species thumbnail/count and a same-dialog list of individuals with weight and rarity.
Actual: flat text-only cards, no details and a full DOM rebuild every countdown tick.
Fix/evidence: species projection, card renderer and stable dialog refresh; `keepnet-check.js` covers navigation, exact IDs, images, ratings, actions, filters and focus.

### G-015 Full aquarium/keepnet outcomes lack a visible explanation (P2, done)
Found: 2026-10-12, spec 055 T051 and Keepnet review.
Reproduce: convert at victory with a full aquarium, or claim into a full keepnet.
Expected: show fallback destination or rejection and allow retry after freeing capacity.
Actual: fallback closed silently; rejected claims gave no feedback.
Fix/evidence: committed outcome metadata and injected presentation callback open Keepnet with the reason; victory retry/duplicate-input checks pass.

Add observations here in any form; Claude turns them into numbered entries.

## Done / verified

- Stage 6 defect: Fixed Catch with a spinner/wobbler/jig bite read the nonexistent `CONFIG.float.biteSequence`.
  Verified fixed 2026-10-10 by reading the code: `FixedCatchHook` takes the sequence from
  `BiteRules.selectBiteSequence` and creates no fish when there is none.
- Stage 6 defect: `DepthSelectorUI` requested an animation frame after `dispose()`. Verified fixed 2026-10-10 by
  reading the code: `DepthSelector` tracks pending frames, cancels them in `dispose()` and refuses new ones once
  disposed.
- G-002 Sliding float: done in [050](../specs/050-sliding-float/spec.md). A new catalog item; with it the selected
  depth costs no cast distance. Max depth stays line − rod, and the fixed float keeps line − depth.
- G-004 DEV item grant: done in [051](../specs/051-dev-item-grant/spec.md). DevTools → "🎁 ВИДАТИ ПРЕДМЕТ" adds any
  catalog item to the inventory, including the sliding float.
- G-005 Depth selection UX: done in [052](../specs/052-depth-selector-ux/spec.md). A float button with a slide-down
  depth track; while the track is open, a dashed cast limit line dims the unreachable water. The cast bar is removed.
  The owner checks the visuals.
- G-006 Perspective metres on the water: done in [053](../specs/053-water-metric/spec.md). One water metric per location
  (`MAP_DB.<id>.distanceProfile`, live in DevTools); casting, the fight and the tackle run in ground metres. The test
  location reaches 30 m at its far edge. Accuracy stays in map pixels (owner). Owner play check pending: hand chum reach (13.6 m).

### Shared aquarium feeding and safe fish stacks (2026-10-12, P2)

Reproduction: retain several species, add feed and let it expire; current care allocates separate species slots and uses keepnet lifetimes, while equal-death random order is unused. Keepnet groups special catches with ordinary catches. Expected: one shared three-quality pack bar, population penalties, saved independent starvation deadlines within 1/3/6 hours, and separate special-fish cards with rarity/weight stack representatives. Spec: specs/055-live-bait-aquarium/spec.md, T059–T065. Focused deterministic coverage is recorded in quickstart after validation.

### Inventory aquarium feed and phone filters (v0.34.1, P2)

Reproduction: DEV shop cannot grant aquarium packs; feed is held outside inventory, house acquisition lists every pack even without stock, and the touch shield/pan-y rule prevents horizontal phone scrolling. Expected: inventory-owned packs, grouped free DEV shop, available-only feed rows with exact quantity dialog, and native kinetic scrolling without toggling a checkbox during a swipe. Specs/055 FR-030–FR-035 and T066–T071.
