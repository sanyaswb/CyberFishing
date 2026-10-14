# One parent container for the inventory's left column

Owner instructions: 2026-10-15, option 2 after the wide-layout review.

Cause: in wide layouts the left column had no parent. The tab bar (`inventory-section-tabs`) painted its own
background, and every section painted its own outer frame differently: the equipment loadout panel (surface colour,
top corners rounded), the keepnet summary (surface colour, all corners rounded) and the backpack view (no frame). The
column never read as one block.

1. **Sidebar parent.** `InventoryUI` wraps the section content host (`inventory-main__left`) and the tab bar
   (`inventory-main__tabs`) in `inventory-main__sidebar`. In wide layouts it is the grid area `left` over the whole
   content height: a flex column with the section content above and the tab bar at its bottom. It alone owns the
   background (`--inventory-equipment-surface`), the radius (`--inventory-panel-radius`) and the clipping.
2. **Transparent tab bar.** The tab bar only positions its tabs; it paints no background.
3. **No outer section frames.** Inside the sidebar the equipment loadout panel, assembly editor, saved-loadout preview
   and keepnet summary paint no outer background or border. Their inner containers (equipment cells, backpack image
   and stats panels, keepnet visual) stay. The backpack view gets the shared container gap as its inset.
4. **Portrait.** The sidebar is `display: contents`, so the content row, the item row and the bottom tabs keep their
   grid areas and order; the full-screen container stays the background.

No gameplay, save or formula changes. Verification: inventory UI check (sidebar holds the content host and the tab bar,
transparent tab bar, no outer section frames, portrait `display: contents`), CSS usage, Architecture, Quick, Full.
Owner visual acceptance; no browser testing by Claude.
