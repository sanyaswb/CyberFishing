# Portrait section swipe and the joined backpack panel

Owner request, 2026-10-15 (release 0.37.1).

## Swipe across sections

Portrait already swipes the backpack pager between Items and Backpack (spec 075). Swipes now also walk the inventory
sections in tab order, Equipment | Backpack (Items, Backpack) | Keepnet, as one chain:

- On the Items page a left swipe first shows the Backpack page; the next left swipe opens the Keepnet. Back the same
  way: on the Keepnet a right swipe opens the Backpack section on its Backpack page, then Items, then Equipment.
- Entering the Backpack section by tab, toolbar button or pick still starts on Items (spec 075); only a swipe back from
  the Keepnet enters on the Backpack page.
- The first and the last section stop the chain; a short, vertical or cancelled gesture changes nothing; the click that
  ends a swipe is suppressed.

Ownership: `SwipePagerController` (platform) gains `onEdge` (a committed swipe past the first or last page),
`ignoreSelector` (gestures starting in a nested pager or a horizontal filter row stay theirs), a configurable position
property/dragging class, and `isEnabled`. `InventoryUI` attaches a second controller to `inventory-main` (no
transient position; class `inventory-main--swiping`) and receives the pager's edges through the grid renderer's
`onPagerEdge`. The direction of a swipe is kept until the section changes and picks the Backpack entry page
(`InventoryGridRenderer.showBackpackPage` -> `InventoryCollectionPagerRenderer.selectLast`).

Breakpoints stay in CSS: portrait sets `--inventory-swipe: on` on the modal and the bootstrap's `isEnabled` reads the
computed flag. Wide layouts therefore swipe neither sections nor pages (the pager's hidden Backpack page could
previously be selected there by a mouse drag).

Touch: `touch-action` resolves only up to the nearest scroller (spec 079), so portrait gives `pan-y` to
`inventory-main` and to each vertical scroller inside it (`inventory-main__left`, loadout panel, assembly editor,
saved-loadout preview, keepnet summary). Filter rows keep `pan-x pan-y`, lists keep their own `pan-y`.

## Joined panel under the pager tabs

In portrait the items panel (`inventory-pager__viewport`) continues the frame of the Items/Backpack tabs: a border in
`--inventory-equipment-tab-border` on the left, right and bottom, no top border (the tab baseline is its top edge).

## Verification

Inventory UI check: edge chaining both ways, the Backpack entry page from the Keepnet, the main-area swipe, the ignore
rule for pager gestures, the disabled flag, the CSS flag/touch-action/border rules. Architecture, Quick, Full;
game-cycle digest unchanged. No gameplay, save or formula changes. Owner touch check on a phone; no browser testing by
Claude.
