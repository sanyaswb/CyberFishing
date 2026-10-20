# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.45.38 - Inventory Hold Recognition Delay

- Restore a shared 300ms recognition delay before every inventory cell's 200ms hold countdown (500ms total). Keep progress hidden and avoid animation frames during recognition; preserve short clicks, movement/cancel and the separate green-pick cancellation. Full: 65/65, including focused UI/platform, Quick and Architecture. Owner timing acceptance pending.

## v0.45.37 - Stable Inventory Selector Startup

- TK-014: pending selector artwork incorrectly enabled classic backpack/keepnet shortcuts before radial readiness. Separate pending, ready and failed preload so radial startup never flashes classic controls; preserve explicit classic mode, failure fallback and disposal. Committed release Full: 65/65 including selector regressions, Architecture, Quick and Pages; the pick-cancel controller is included. Owner startup acceptance pending.

## v0.45.36 - Uniform Inventory Hold Speed

- Apply 200ms holds from pointerdown to all inventory cells: backpack, saved kits, equipment, editor and header bait. Remove the activation delay through shared defaults; preserve existing cell actions, cancellation and click suppression. Full: 64/65, including UI/platform, Architecture and Quick; Pages still requires the prior uncommitted pick-cancel controller. Owner acceptance pending.

## v0.45.35 - Header Bait Hold Ring

- Restore animated header bait hold feedback as a thin ring without a shadow. Remove bait at 200ms from pointerdown with no activation delay; preserve cancellation, release-click suppression, artwork refresh and other item timings. Full: 64/65, including UI/platform, Architecture and Quick; Pages still requires the prior uncommitted pick-cancel controller. Owner visual acceptance pending.

## v0.45.34 - Quick Tackle Attachment State

- Fix TK-011 acceptance: repeated equipment-cell picks initialize/prepare attachment-capable roots, so an equipped hook immediately accepts bait and a feeder rig accepts chum. Header activation repairs a previously saved loose equipped root missing that state without changing its identity or save format. Cover single/stack hooks, both list layouts, chum, repaired reload and persistence rollback. Owner acceptance pending.
- Hold an equipped bait header icon to return its portion to the backpack using normal equipped-item timing. Preserve hook/siblings/A, cancel stale holds and consume the release click across slot updates; active green targets retain 200ms pick cancellation. Full: 64/65; the prior uncommitted pick-cancel controller still blocks Pages.

## v0.45.33 - Organized DevTools Sections

- Complete TK-013 and all eight subpoints: one Inventory group, root Overlay → CONFIG → DEBUG, grouped databases and Spine by skeleton name, top free-shop button and bottom Service tools. Collapse read-only descriptions per section and use background-only action hover with visible keyboard focus. Preserve live setting paths, module toggles and shop grants. Full: 64/65; the prior uncommitted pick-cancel controller still blocks Pages. Owner visual acceptance pending.

## v0.45.32 - Transient Touch Button Feedback

- TK-012: touch/non-hover controls reuse component hover colors only during native active presses across HUD, toolbar, inventory, keepnet, House and DEV. Preserve desktop hover, keyboard focus, disabled/selected states and hit geometry; no extra input listeners. Full: 64/65 pass; Pages release awaits the prior pair's new controller being committed. Owner visual acceptance pending.

## v0.45.31 - Targeted Inventory Pick Subfilters

- TK-011: empty equipment/editor cells open Compatible scoped to the exact target and select every available matching subtype. Preserve explicit browsing, sorting and repeated picks. Deterministic integration regression passes; owner acceptance pending.

## v0.45.30 - Complete Inventory Pick Interactions

- Complete TK-010 including equipment/editor repeat selection and 200ms hold/right-click cancellation. Keep portrait inline choices, use the first displayed compatible candidate, suppress the click after cancellation and disable browser context menus.
- Missing bait/chum prerequisites show the existing warning and flash the responsible rod/tackle cell red through the shared full-cell feedback. Focused, Architecture and save checks pass; Full and owner acceptance remain pending.

## v0.45.29 - Repeat Header Consumable Selection

- TK-010: repeat a highlighted bait/chum icon to equip exactly one first currently displayed compatible item. Respect list order, validate live target/custody/reservation, preserve manual confirmation and make an empty list a no-op. Inventory UI/integration regressions pass; Full and owner acceptance pending.
