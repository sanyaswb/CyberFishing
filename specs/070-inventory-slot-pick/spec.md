# Inventory pick: from an empty cell to the backpack and back

Owner instructions: 2026-10-14. The hint system (highlighted slot + highlighted compatible cards) was built for the
landscape layout where the item list sits beside the loadout; in portrait the equipment section has no list
(spec 069). One flow for every layout replaces it.

1. **Empty cell → backpack.** Activating an empty equipment cell (loadout panel or a socket of the rod's craft panel)
   that has an accessible compatible item opens the backpack section with the "compatible" category and highlights the
   cards that fit that cell. A cell without such an item keeps the existing warning and does not switch sections.
2. **Card → equipment.** Activating a card while picking returns to the equipment section. An item without its own
   sockets is equipped at once; an item with sockets (reel, hook, ...) opens its craft panel, as the highlighted-slot
   branch already did. A failed activation keeps the pick and the backpack.
3. **Craft panel sockets.** An empty socket of a non-rod craft panel picks the same way: backpack, cards accepted by
   that socket highlighted, the activated card fills exactly that socket, then the craft panel returns. This replaces
   the "select a component first" warning, which is removed.
4. **Ending a pick.** Selecting a section tab, closing the inventory (section returns to equipment), opening another
   panel or completing the pick ends it. Category, subfilter and sort changes keep it, so the player can browse.
5. **Rod craft panel availability.** Its empty sockets use the loadout availability policy, so a socket without an
   accessible compatible item shows the same warning instead of opening an empty backpack.
6. **Rodless rod cell (follow-up).** Without a rod the single rod cell fills the free height of the equipment
   section (its reference height stays the minimum and the gaps stay), because a rod is taller than wide.

Landscape keeps the item list beside the loadout on the equipment tab; direct card activation there is unchanged.
No gameplay, save or formula changes.

Verification: integration checks for slot pick, socket pick, return and cancellation; Architecture, Quick, Full;
unchanged game-cycle digest. Owner visual acceptance; no browser testing by Claude.
