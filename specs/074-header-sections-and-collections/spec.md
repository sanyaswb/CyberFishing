# Two-section header, consumable slot apply, visible-list picks and collection containers

Owner instructions: 2026-10-15.

1. **Wide header: two sections.** Above 820px the header has the content columns' two sections in one row: the load
   meter over the left panel; the consumable switches (centred) and the close button (right) over the right panel.
   All controls share one vertically centred row. Mobile keeps its own composition.
2. **Consumable slot apply.** While a backpack bait/chum waits for confirmation (all slots filled, one header circle
   proposed), pressing any header slot of that kind applies the selected item to that slot at the first press: the
   proposed circle or another one. Without a pending item a header slot still opens the pick (spec 072).
3. **Highlighted circle.** The proposed/selected header circle gets the green success outline and the same green
   pulse inside the circle as highlighted equipment cells (`inventory-compatible-slot-pulse`).
4. **Picks without a section switch where the list is visible.** An empty equipment cell, craft socket or header
   slot opens the backpack only when the item list is not already on screen. The UI reports `listVisible` with the
   action, read from the rendered item host (CSS stays the single owner of the breakpoints); landscape layouts keep
   the equipment section and highlight the list beside it.
5. **Backpack containers.** The item list is two containers: filters (categories, subfilters, sort) in their own
   panel, a gap, then the items panel. In portrait the backpack illustration lies faded inside the items panel; the
   separate summary column is not shown in portrait.
6. **Keepnet containers.** The keepnet content uses the same shared collection block: back/heading/filters panel, a
   gap, then the fish-list panel with the faded keepnet inside it in portrait.

The shared `inventory-collection` block (shared-controls.css) owns the two-panel structure, gap, scrolling items panel
and backdrop; components mix it in. No gameplay, save or formula changes.

Verification: integration checks for header slot apply and visible-list picks; UI checks for the header columns,
the highlighted circle, the collection structure in backpack and keepnet; Architecture, Quick, Full. Owner visual
acceptance; no browser testing by Claude.
