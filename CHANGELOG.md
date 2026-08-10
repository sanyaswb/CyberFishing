# CyberFishing changelog

## v0.24.9 - Inventory V2 Stabilization

### Summary

- Finalized Inventory V2 equipment behavior, contextual assembly editors, saved loadout ownership and reusable item-parameter presentation.
- Stabilized contextual actions so Equip, Unequip and Disassemble appear only when valid for the selected item's current state.
- Preserved loadout custody across equip and unequip cycles and guarded loose stacks against item duplication.
- Restored non-composite lure equipment and clarified empty, unavailable and progression-locked slot visuals.
- Added the automatic `Сумісне` inventory group while preserving `Усі` as direct access to the complete backpack.
- Consolidated automated checks behind the manifest-driven runner and removed obsolete test scripts without losing distinct coverage.

### Changed

- Optimized compatible-item filtering by resolving active assembly targets once per inventory projection instead of once per candidate item.
- Kept equipment, nested assembly and inventory filtering rules delegated to their existing compatibility policies as a single source of truth.

### Validation

- Covered rod-specific equipment, reels and lines, hooks, feeder rigs, lures, bait boats, saved loadouts, nested components and UI action states.
- Verified the complete automated check catalog and JavaScript syntax after the final integration.

## v0.24.8 - Compatible Inventory Group

### Added

- Added `Сумісне` as the second inventory group immediately after `Усі`.
- Automatically activate the compatible group after equipping a rod, an individual item, an assembled item or a saved loadout.
- Include both compatible equipment roots and components accepted by currently equipped assemblies.

### Changed

- Centralized compatible inventory filtering as a context strategy that delegates to the existing equipment and assembly policies instead of duplicating item-type rules.
- Kept `Усі` available as an explicit way to restore the complete backpack without unequipping the rod.
- Added integration coverage for pole-rod filtering, nested bait compatibility, automatic activation and manual return to the full inventory.

## v0.24.7 - Missing Item Slot Visual

### Changed

- Display equipment slots with no available compatible item using the same dark well as locked slots.
- Keep the red cross exclusive to genuinely locked slots, so missing inventory and progression locks remain visually distinct.
- Preserved the missing-item warning shown after activating the dark empty slot.

## v0.24.6 - Inventory Slot Semantics and Lures

### Fixed

- Restored spinner and wobbler equipment by preventing non-composite lures from being read as assembly roots during equipment projection.
- Reserved the dark background and cross indicator for slots that are genuinely locked by game progression.
- Kept unlocked slots visually empty when no compatible loose item is currently available, while preserving their warning on activation.
- Added regression coverage for lure replacement, projection and the distinction between locked and temporarily unavailable slots.

## v0.24.5 - Reusable Check Architecture

### Changed

- Replaced scattered aggregate commands with one manifest-driven runner for quick, inventory, Inventory V2, item, gameplay and developer-tool suites.
- Added reusable scoped assertions and a shared browser-source VM runtime, then migrated the compatible domain checks away from duplicated local helpers.
- Removed the obsolete legacy inventory equip UX check and the redundant Inventory V2-only aggregate script without dropping the distinct domain, transaction, migration, integration or UI scenarios.
- Added manifest integrity validation so missing files and unregistered `*-check.js` scenarios fail before a suite starts.
- Reduced JavaScript syntax-check time by parsing regular scripts in-process and using the Node subprocess fallback only for module files or actual parse failures.
- Documented the test folder structure, commands and extension rules in `utils/testing/README.md`.

## v0.24.4 - Inventory Ownership Guard

### Changed

- Kept items taken from a saved loadout owned by that loadout while equipped and returned them to the same loadout slot when unequipped.
- Separated equipment activity from item custody so ordinary unequip actions no longer remove roots from saved loadouts.
- Merged loose non-assembly items back into their compatible backpack stacks after unequip or replacement.
- Added repeated loadout-root and loose-stack equip/unequip checks that verify stable instance identities, repository size and total quantity.

## v0.24.3 - Assembly Equip Availability

### Changed

- Disabled Equip in the reel editor while the active rod does not support a reel, without preventing line installation or other assembly editing.
- Derived assembly-editor availability from the shared equipment compatibility policy instead of item names or hard-coded item identifiers.
- Added an incompatibility warning for inactive Equip actions and covered the pole-rod/reel case in integration and UI checks.

## v0.24.2 - Contextual Assembly Actions

### Changed

- Hid the Equip action while an already equipped assembly is open and kept Unequip exclusive to that active state.
- Kept Disassemble independent from equipment state and visible only when the assembly contains attached components.
- Added UI and integration coverage for equipped and unequipped assembly action sets.

## v0.24.1 - Inventory V2 Consistency

### Changed

- Unified charge and finite-resource scales across inventory thumbnails and assembly cards through the shared resource meter renderer and color source.
- Standardized the height of resource, power, condition and segmented quality scales through one inventory parameter size variable.
- Moved production parameter labels, descriptions and aliases into configuration and resolved authored display statistics through stable schema-based identifiers.
- Made Inventory V2 the required active inventory UI so equipment compatibility cannot silently fall back to the legacy presentation rules.
- Consolidated the current Inventory V2 domain, transaction, migration, gameplay, integration and UI checks into one command and removed the obsolete legacy slot-selection check.

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
