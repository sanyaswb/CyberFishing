# Full-screen portrait inventory

Owner instructions: 2026-10-14, after spec 067. Adjusts its layout; section state, keepnet integration and save data
are unchanged.

## Landscape (two columns)

- The equipment container sits at the top of its column with the container's outer inset (no vertical centering).
- "Landscape" means the separate-container layout: every landscape viewport and every UI surface wider than 820 px.
  Narrow landscape phones (≤ 820 px) no longer fall back to the stacked layout; its rules apply only in portrait.

## Portrait (UI surface ≤ 820 px and portrait orientation)

- The inventory fills the screen with no page scroll: header, optional warning and the section area. The section
  area has three rows: summary (content height), content (the rest) and the tab bar, always at the bottom, never
  covered; the safe-area inset stays below it.
- Only the item list and the keepnet fish list scroll, inside their own containers, without a visible scrollbar.
- Header: weight on the left, both automatic switches centered in the same row as the close button on the right.
  At ≤ 520 px the switch pill has the height of its inner track (the track's border coincides with the pill's), and
  the weight stacks its icon above the value to keep the row within 320 px.
- Equipment: the unit-scaled loadout (spec 067), additionally limited to 55 % of the logical height, above the item
  list.
- Backpack: the backpack illustration is the faded background of the section; filters and the scrolling item list
  lie over it.
- Keepnet: a compact summary (help, occupancy counter and meter, status) above filters and the scrolling fish list;
  the keepnet illustration is the faded background of that list.

## Ownership

- `InventoryUI` adds one root modifier per active section (`inventory-modal--section-equipment|backpack|keepnet`,
  literal names from `INVENTORY_SECTIONS`) only when the section changes; CSS places the hosts.
- `KeepnetSectionView` adds a decorative `keepnet-section__backdrop` image to its content; it is visible only in the
  portrait layout.
- Styles stay with their owners: `modal.css` (rows/areas), `loadout.css` (equipment and backpack summary),
  `list-and-filters.css` (list height/scroll), `keepnet.css`, `header.css`, `auto-switch.css`.

## Verification

Static contracts for the portrait rows/areas, the orientation guard, list height/scroll without a scrollbar, the
header row and the compact switch; runtime checks for the section modifier and the keepnet backdrop. Architecture,
Quick and Full. Owner visual acceptance; no browser testing by Claude.
