# Backpack pager on touch: the list declares its own pan axis

Owner report: 2026-10-15, Chrome device emulation and a phone: the backpack pager swipes with a mouse but not by
touch; a horizontal touch swipe shows Chrome's round history-navigation arrow instead.

Cause: `touch-action` is resolved from the touched element up to its nearest scroll container only. A swipe starts on
a card inside the item grid, which is a vertical scroller with the default `auto`, so the pager viewport's
`touch-action: pan-y` never applied. The browser claimed the horizontal pan, could not scroll the grid sideways,
chained it to the page's history gesture and sent `pointercancel`, so `SwipePagerController` never moved. A mouse has no
touch-action, which is why the same controller worked.

Change: the shared drag-scroll class of vertical lists, `inventory-vertical-scroll`, declares the native pan axis it
owns (`touch-action: pan-y`), mirroring `inventory-horizontal-scroll` (`pan-x pan-y`). Vertical touch scrolling stays
native with inertia; horizontal touch swipes now reach the same `SwipePagerController` path that works with a mouse.
The pager viewport keeps `pan-y` for pages without their own scroller (the backpack view). No new gesture code.

DESIGN_RULES §7 records the rule; the inventory UI check asserts the list's pan axis. No gameplay, save or formula
changes. Verification: inventory UI check, CSS usage, Architecture, Quick, Full. Owner touch check; no browser testing
by Claude.
