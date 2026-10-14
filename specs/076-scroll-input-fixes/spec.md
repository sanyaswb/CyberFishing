# Scroll input: map pan without a cast-ready rod, drag-scrolling lists

Owner report: 2026-10-15. Two scroll inputs read as clicks.

## Location pan

Cause: `GameApplication` enabled pointer pan only without a rod (`!eq.rod`). With a rod that cannot cast (no reel or
no line) a drag stayed on the casting path; a held drag became a pull and the scouting state showed the missing
reel/line warning.

Change: pointer pan is enabled in scouting (outside chum aiming) whenever the equipped tackle cannot cast, using the
inventory's `evaluateCastReadiness()` (the same readiness the cast service and scouting use). `getEquipped()` keeps
one object until the equipment changes, so readiness is evaluated once per change, not per frame. A drag then pans;
a stationary tap still completes a click and shows the warning, as before.

## Item and fish lists

Cause: the lists only scrolled natively (wheel, touch panning). A mouse drag (or emulated touch) over a card did not
scroll, and its release activated the card. The filter rows already used `HorizontalScrollController`.

Change: the controller gains `axis: "y"`. The backpack item grid and the keepnet fish list attach it
(`InventoryUiBootstrap.createListScrollController`, classes `inventory-vertical-scroll[--dragging]`): a mouse drag
over any card scrolls the list and suppresses its click; touch keeps native panning and inertia, and a swipe still
never activates a card. Wheel scrolling of vertical lists stays native.

## Follow-up: the list stopped scrolling vertically

Cause: spec 075 placed the grid in an unstyled `inventory-list-panel__page` wrapper inside the pager page. The wrapper
was a plain block that grew with its cards, so the grid never had a bounded height: no wheel, touch or drag
scrolling, and the overflow was clipped by the items panel. The structure checks only asserted containment.

Change: the pager takes each page's nodes as direct children (`create([[backdrop, grid], [backpackView]])`); the
wrapper is removed. The inventory UI check asserts the exact chain pager → viewport → track → page → grid and that
each of those boxes passes a bounded height (flex, `min-height: 0`, the grid's `overflow-y: auto`). DESIGN_RULES §7
records the height-chain rule.

No gameplay, save or formula changes. Verification: application composition check (pan with a non-ready rod, cast
gesture with a ready rod), inventory UI check (mouse drag scroll, click suppression after drag/swipe, a plain press
still selects); Architecture, Quick, Full. Owner play check; no browser testing by Claude.
