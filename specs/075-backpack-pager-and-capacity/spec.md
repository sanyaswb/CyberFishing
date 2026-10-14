# Backpack pager, backpack view and capacity scale

Owner instructions: 2026-10-15, building on spec 074.

1. **Backpack view.** One container holds the backpack image (the nested loadout panel/primary/cell is removed); a
   separate stats container below it holds the capacity scale. Portrait and landscape share this view.
2. **Capacity scale.** The stats show the shared scale composition (`inventory-scale`: SVG icon, resource meter and a
   counter) with the carried item count over a presentation maximum: `N / 100`. Gameplay keeps its unlimited
   inventory capacity (`UnlimitedInventoryCapacityPolicy`); 100 is presentation config only, like the 100kg load
   scale. The load scale moves onto the same `inventory-scale` block and `InventoryScaleRenderer`.
3. **Portrait pager.** In portrait the backpack's items panel is a two-page pager with tabs above it in the main
   tab style: "Предмети" (left) and "Рюкзак" (right). A horizontal swipe (or a tab) moves between the item list and
   the backpack view; both pages slide with the finger and settle on release. Vertical list scrolling is untouched.
   Entering the backpack section shows the items page, so picks always land on the highlighted list.
4. **Wide layouts.** No pager tabs or second page: the backpack view (image and stats) stays in the left column.
5. **Filters and spacing.** The filters panel stacks only its visible rows (no reserved empty grid rows); opening
   subfilters or sorting pushes the items panel down. Every gap between containers uses one token: the mobile
   inset on phones, the content-column gap on wide layouts.

Ownership: `SwipePagerController` (platform/browser) owns pointer gestures and writes only the transient drag
position; `InventoryCollectionPagerRenderer` (presentation) builds tabs/viewport/pages and the page index;
`InventoryGridRenderer` composes the pager. CSS owns which layouts show the pager. No gameplay, save or formula
changes.

Verification: UI checks for the pager structure, tab/index update, swipe commit/cancel and click suppression,
the backpack view and capacity reading, the filters stack and gap tokens; Architecture, Quick, Full. Owner visual
acceptance; no browser testing by Claude.
