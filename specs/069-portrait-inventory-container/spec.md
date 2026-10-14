# Portrait inventory: one full-screen container

Owner instructions: 2026-10-14 (annotated screenshot), refining spec 068 for portrait (UI surface ≤ 820 px).

1. **Full-screen container.** The inventory is one dark container (`--inventory-equipment-surface`) without outer
   padding; only the safe-area insets stay clear. Header, section and the bottom tabs live inside it.
2. **Header mini panel.** All top controls sit in a rounded panel (`--inventory-equipment-panel`,
   `--inventory-header-radius`) inset by `--inventory-mobile-inset`; no divider line. Weight left, switches centered
   in the remaining width (side columns fit their content, so the weight never runs under the switches), close right.
3. **Equipment without the item list.** The equipment section shows only the loadout, which fills the content row
   (its unit fits between the header and the tabs). Items belong to the backpack section; activating an empty slot
   still highlights compatible items and selects the "compatible" category for the backpack list. Landscape keeps
   the item list beside the loadout. This supersedes spec 068's "loadout above the item list" for portrait.

Backpack and keepnet sections keep spec 068's arrangement, inset by `--inventory-mobile-inset` inside the container.

Verification: static contracts for the full-screen container, hidden equipment list, equipment row and the header
panel; Architecture, Quick, Full. Owner visual acceptance; no browser testing by Claude.
