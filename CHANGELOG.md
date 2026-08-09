# CyberFishing changelog

## v0.24.0 - Inventory V2 and Assemblies

### Changed

- Rebuilt the inventory around clear equipment slots for rod, reel, line or leader, tackle and float, plus hand chum, landing net, bait boat and the future gas-mask slot.
- Added assembly editors for reels, feeder rigs, hooks and bait boats. Their contents stay together as one prepared item in the backpack and can be equipped, removed or disassembled when needed.
- Added smart inventory filtering while editing an assembly: the backpack shows only components that can be installed into the currently open item, including newly available nested slots.
- Added saved equipment loadouts that preserve the five main equipment slots and their assembled contents, with preview, partial equip and disassembly actions.
- Added global auto-refill options for bait and chum. Exact previously used variants are restored after the relevant fishing, hand-chum or bait-boat action when available.
- Added safe transitions when changing rods: incompatible equipped items are returned to the backpack instead of being lost.
- Updated the craft editor into a production-style vertical card with item artwork, centered sockets and structured gameplay parameters above its actions.

## v0.23.68 - Config-Disabled Item Pulse

### Changed

- Added `uniqueEffects.itemPulseEnabled` as the configuration switch for unique inventory item pulsing.
- Set item pulsing to `false` while retaining the animation implementation for later re-enabling.
- Kept item glow and item pulse independent and left unique fish victory animation unchanged.

## v0.23.67 - Double Inventory Slots

- Doubled equipped and backpack item cells from 50×50 px to 100×100 px.
- Added `--inventory-slot-size` as the single source of truth for both inventory grids and item cells.
- Scaled item icons, Level badges, stack quantities and compact Capacity bars proportionally with the shared cell size.
- Added a CSS contract proving both grids and item cells use the shared 100 px slot configuration.

## v0.23.66 - Universal Degradation Colors

- Added an immutable degradation color configuration and reusable resolver for Capacity, condition, fuel, charge and future consumable resources.
- Added startup validation for degradation range, stops and RGB color contracts.
- Capacity now uses its own continuous color scale: red at 1%, through orange and yellow, to green at 100%.
- Kept each Capacity fill a single solid color selected at its current percentage, with the unused track remaining neutral gray.
- Removed the visual dependency between Capacity and item rarity or Power.
