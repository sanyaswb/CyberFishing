# CyberFishing changelog

## v0.24.15 - Stable Inventory Sorting

### Added

- Added a funnel panel immediately after the subtype arrow with ascending and descending controls, sorting by type, rarity, level or power, and colour-square rarity filters.
- Added multi-rarity filtering: no selected square shows every item, while one or more selected squares show only those rarity tiers.
- Added a reusable inventory order resolver backed by one configuration for type priority and stable numeric paths; rarity colours continue to come from the existing rarity visual configuration.

### Changed

- Locked the current inventory order during a repeated socket-placement sequence, so newly compatible items appear after the existing cards instead of moving the selected source.
- Kept the placement order locked across the `2 + 2 + 1` repeated-click flow and restored normal sorting immediately after the final compatible empty cell is filled.
- Made equal sort values preserve their previous relative order without applying undocumented secondary criteria.

### Validation

- Added integration coverage for configured type order, rarity, level and power sorting, both directions and rarity filtering.
- Added a regression scenario where higher-rarity bait becomes compatible after attaching a hook but cannot displace the selected hook stack until all hook cells are filled.
- Added UI interaction and contract coverage for the funnel, direction controls, criteria and rarity squares.

## v0.24.14 - Socket Placement UX

### Changed

- Replaced the green socket outline with a translucent green background overlay that slowly pulses between 20% and 50% opacity.
- Restored repeated-click placement for items compatible with multiple assembly cells: the first click selects and highlights the choices, while the second click fills the leftmost empty compatible cell.
- Prioritized empty compatible cells over occupied replacement targets, preserving explicit replacement only after no empty compatible cells remain.
- Kept one-click placement when exactly one compatible empty cell remains, enabling the `2 + 2 + 1` click flow for three identical bait-boat sections.

### Validation

- Added integration coverage for stable left-to-right filling, empty-cell highlighting and automatic final-cell placement across all three boat sections.
- Added UI contract coverage for the outline-free green overlay, shared success colour and 20%–50% pulse range.

## v0.24.13 - Long-Press Equipment UX

### Changed

- Moved item-card actions above the image, attachment cells and parameter sections so Equip, Unequip, Disassemble and Back remain immediately accessible when a card contains many parameters.
- Made an 800 ms hold unequip any equipped item, including ordinary rods and auxiliary equipment; inventory disassembly keeps the more deliberate 1500 ms threshold.
- Restricted Disassemble to unequipped inventory items; active item cards hide the action and the command layer rejects direct attempts until the item is removed.
- Replaced the bottom hold-progress strip with a centered translucent circular sector that fills clockwise above the item visual.
- Delegated the progress colour transition to the shared degradation colour resolver: it begins with the configured neutral grey and reaches the common critical red at 100%.

### Validation

- Added UI coverage for separate equipped/inventory hold durations, ordinary equipped-item removal, circular progress markup and top action placement.
- Added degradation-colour coverage for the neutral start, translucent reusable colours and shared red completion state.

## v0.24.12 - Inventory Item Inspection

### Added

- Added context-aware inventory activation: incompatible or incomplete items open as left-panel cards with an explicit Equip reason instead of failing silently.
- Added an `inventory.showEngineStats` switch under DevTools `DEBUG`; raw EngineStats are hidden by default and appear as the final tooltip section only when explicitly enabled.
- Added equipped-rod parameter sections for the installed reel, line or leader, tackle, hooks, bait, feeder chum and float.

### Changed

- A short press on any equipped item, including a rod, now opens its detail card instead of unequipping it; explicit Unequip and the existing long-press flow remain responsible for removal.
- A complete compatible item still equips immediately from the backpack without opening its card; items with empty attachment cells open in the editor first.
- Reused the equipment compatibility policy to determine whether the card's Equip action is enabled and to provide the warning shown when it is not.
- Reordered tooltip information into primary gameplay values followed by grouped casting or retrieve calculations; the technical EngineStats block is always last.
- Increased parameter typography and made the tooltip size itself from its widest row while stretching all rows to the same width.

### Validation

- Added integration coverage for equipped-rod inspection, attached parameter sections, incompatible and slotless item cards, disabled Equip reasons and clone-safe long-press unequip cycles.
- Added UI coverage for context-aware item activation, default-hidden EngineStats, debug-last ordering and the disabled-by-default configuration.

## v0.24.11 - Tooltip Scroll Routing

### Changed

- Simplified grouped assembly-component headings to the compact `Гачок ×3` / `Черв'як ×3` format without repeating socket labels or duplicate parameter sections.
- Routed wheel input over a hovered item to its open tooltip first; inventory scrolling resumes automatically after the tooltip reaches the relevant edge.
- Centralized scrollbar dimensions and colours and applied the inventory-filter scrollbar style to the balance tooltip.

### Validation

- Added UI checks for compact grouped headings, tooltip-first wheel consumption, boundary pass-through and the shared scrollbar style source.

## v0.24.10 - Assembly Parameters and Balance Tooltip

### Added

- Added separate production-parameter sections for an assembly root and every attached component; statistically identical components such as three equal hooks are grouped into one `×3` section.
- Added a balance-only item tooltip with the in-game label, stable `EngineStats` path, factual value, balance baseline and explicit signed difference.
- Added derived rod cast distance in metres and pixels, including the signed difference from coefficient `1` and the reference distance used when no active line is available.
- Added derived reel retrieve speed and retrieve duration with explicit bearing contributions.

### Changed

- Reused `CastDistanceCalculator` and `ReelRetrieveSpeedCalculator` as the single source of gameplay formulas instead of duplicating their arithmetic in the UI.
- Applied semantic difference colours: improvements are green and regressions are red, including inverse metrics where a lower duration is beneficial.
- Restricted the hover tooltip to balancing and system values; presentation and compatibility descriptions remain outside it.
- Made the large assembly-root card hoverable so it exposes the same balance tooltip as inventory and socket items.

### Validation

- Added coverage for attached-item sections, grouping three identical hooks, the `7.12 (+2.12)` baseline case, cast range `6 m / 300 px (-300 px)`, and green negative retrieve-time effects.
- Added integration coverage for projected rod, reel and installed-line data in the shared tooltip context.

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
