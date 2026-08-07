# CyberFishing changelog

## v0.23.68 - Config-Disabled Item Pulse

### Changed

- Added `uniqueEffects.itemPulseEnabled` as the configuration switch for unique inventory item pulsing.
- Set item pulsing to `false` while retaining the animation implementation for later re-enabling.
- Kept item glow and item pulse independent and left unique fish victory animation unchanged.

### Tests

- Covered disabled pulse descriptors and DOM classes, configuration re-enabling and CSS class gating.

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
