# CyberFishing changelog

## v0.23.67 - Double Inventory Slots

### Changed

- Doubled equipped and backpack item cells from 50×50 px to 100×100 px.
- Added `--inventory-slot-size` as the single source of truth for both inventory grids and item cells.
- Scaled item icons, Level badges, stack quantities and compact Capacity bars proportionally with the shared cell size.

### Tests

- Added a CSS contract proving both grids and item cells use the shared 100 px slot configuration.

## v0.23.66 - Universal Degradation Colors

### Added

- Added an immutable degradation color configuration and reusable resolver for Capacity, condition, fuel, charge and future consumable resources.
- Added startup validation for degradation range, stops and RGB color contracts.

### Changed

- Capacity now uses its own continuous color scale: red at 1%, through orange and yellow, to green at 100%.
- Kept each Capacity fill a single solid color selected at its current percentage, with the unused track remaining neutral gray.
- Removed the visual dependency between Capacity and item rarity or Power.

### Tests

- Covered exact color anchors, interpolation, clamping, immutable results and production Capacity integration.

## v0.23.65 - Power-Segment Item Level

### Changed

- Item Level is now derived automatically from the normalized Power scale.
- Split Power into six equal segments that map to Levels 1 through 6.
- Removed manually authored `progressionProfile.level` values from all gameplay items.
- The dependency remains one-way: Power determines Level, while Level never feeds back into Power.
- Level badge colors continue to match the item rarity frame.

### Tests

- Covered all six segment boundaries, maximum Power, unavailable Power and legacy manual Level values.
- Added production coverage proving every item Level matches its calculated Power segment.

## v0.23.64 - Rarity-Colored Item Level

### Changed

- The Level badge border and number now always use the item rarity frame color.
- Removed authored Level from progression-gradient color calculation.
- Level remains an independent conditional number and does not affect Power.

### Tests

- Added a visual contract requiring Level badges to inherit `--rarity-color` and forbidding a separate Level color variable.

## v0.23.63 - Solid Capacity Color

### Changed

- Capacity fill now uses one solid color selected from the rarity palette at the current capacity percentage.
- Applied the same color rule to compact fishing-line thumbnails and detailed Capacity tooltips.
- The unused part of every Capacity scale remains neutral gray.

## v0.23.62 - Independent Item Condition

### Added

- Added an immutable Condition descriptor sourced from runtime durability, authored durability or the configured full-condition default.
- Added a bottom-up Condition fill to item thumbnails: 100% fills the complete rarity background and 20% leaves only the lower 20% filled.
- Added explicit authored `progressionProfile.level` values for every gameplay item.

### Changed

- The rarity frame now remains full while only its background height represents Condition.
- Power loader fill now uses one solid color resolved at the current Power position; the unfilled remainder stays neutral gray.
- Item Level is no longer calculated from Power and remains independent from functional stats such as boat upgrade level.

## v0.23.61 - Dynamic Line Capacity

### Added

- Added an independent line-capacity descriptor sourced from inventory, equipped reel and active line state.
- Added compact Capacity loader bars to fishing-line thumbnails.
- Added live Capacity updates while the inventory is open during active fishing.

### Changed

- Fishing-line details now show Capacity instead of the nominal Power scale.
- Capacity details expose remaining meters, reel maximum, used meters and the exact percentage.
- Other item types keep their existing Power and Quality presentation.

## v0.23.60 - Power Loader Scale

### Changed

- Power now uses loader-style filling in the detailed item tooltip.
- The filled percentage reveals the matching portion of the rarity gradient while the remaining percentage stays neutral gray.
- Removed the standalone vertical Power marker.

## v0.23.59 - Detailed Progression Scales

### Changed

- Item thumbnails now show only the numeric power Level in a dedicated square badge without an `L` prefix.
- Moved the Power gradient and segmented Quality scales from item thumbnails into the detailed hover tooltip.
- Kept exact Power, Quality, source metric and comparison-range values in the detailed item view.

## v0.23.58 - Item Power, Level and Quality

### Added

- Added independent Power, power Level and Quality descriptors without changing authored rarity.
- Added 17 explicit comparison groups, fixed/catalog baselines and numeric, derived, target-range and composite metric strategies.
- Added cached immutable progression read models during inventory hydration and a dedicated inventory view factory.
- Added compact `L` badges, marker/fill Power gradients, segmented Quality bars and exact progression details in tooltips.
- Added an `ITEM PROGRESSION` DevTools section with group, metric, baseline, level, quality, range and composite diagnostics.
- Added startup validation and a focused production/regression check for progression configuration and lifecycle behavior.

### Changed

- Migrated all 21 gameplay items to explicit progression groups and canonical quality values; three technical records explicitly opt out.
- Made line Power depend on strength-to-diameter efficiency rather than remaining length.
- Made reel Power composite and boat Power depend on the current upgrade-level stat.
- Kept derived progression out of save and stacking identity while preserving runtime quality as canonical instance data.
- Continued to source every Power, Level and Quality color from the ordinary rarity palette, excluding gold.

### Fixed

- Durability and remaining line length can no longer change nominal Power or power Level.
- Different runtime quality can no longer merge through ordinary stacking or detached-line merging.
- Unique rarity no longer implies maximum item strength, Level or Quality.

## v0.23.57 - Configurable Item Rarity Glow

### Added

- Added `CONFIG.rarity.visual.uniqueEffects.itemGlowEnabled` as the single switch for unique item glow.

### Changed

- Temporarily disabled unique item glow while keeping the gold background and border pulse active.
- Kept Victory UI fish glow independent from the item-only switch.

## v0.23.56 - Universal Item Rarity

### Added

- Added explicit authored rarity profiles for every loot item and a null-profile allowlist for build containers and templates.
- Added immutable item rarity descriptors, an authored strategy, a strategy registry and a domain resolver prepared for future rolled strategies.
- Added an inventory item factory that migrates saved instances and assigns rarity once at the inventory boundary.
- Added a DOM adapter that converts shared rarity visuals into CSS variables for inventory, equipment and tooltips.
- Added startup and production validation for item profiles, unique IDs, required color stops and forbidden item-owned rarity colors.
- Added focused regression coverage for all six visual classes, 5/6/9/12-tier scales, runtime-state independence, stacking, CSS layering and reduced motion.

### Changed

- Moved the shared rarity palette and effects into a dedicated visual config while preserving `CONFIG.rarity.visual` as the public source.
- Extended the existing `RarityVisualResolver` for item descriptors; ordinary scales now end at legendary and reserve gold for unique entities.
- Routed configured inventory, cached saves, build templates and detached line segments through the same item factory.
- Separated the persistent rarity frame (`::before`) from selected, equipped and compatible interaction rings (`::after`).
- Made stack and line-merge compatibility include the stored runtime rarity descriptor.

### Fixed

- Changing durability, quantity or remaining line length can no longer affect an instance's rarity.
- Selected and equipped styles no longer overwrite the item's rarity border.
- Unique item pulsing no longer requires per-frame DOM updates and is disabled by `prefers-reduced-motion`.

## v0.23.55 - DevTools Parameter Aliases

### Added

- Added a declarative DevTools parameter-alias schema for displaying one canonical setting in multiple sections.
- Added a generic control-binding registry that synchronizes every boolean, number, text or enum control bound to the same canonical path.
- Added legacy override normalization so imported alias paths collapse into their canonical runtime override.
- Added a focused architectural regression check for alias resolution, synchronized controls, override precedence and single-source storage.

### Changed

- `Fixed Catch > hasAnomaly` is now a linked UI view of `God Mode > forceAnomalyChance`; changing either switch immediately updates both.
- Fixed Catch anomaly generation now reads only the canonical God Mode flag and continues to use the shared species/location anomaly resolver.
- Canonical runtime override values take precedence if an imported file contains both a canonical path and an old alias path.

### Removed

- Removed the duplicated `CONFIG.debug.fixedCatch.hasAnomaly` value and its separate Fixed Catch branch from fish construction.
- Removed the possibility of contradictory anomaly booleans being stored by DevTools.

## v0.23.54 - Victory Button Gesture UX

### Added

- Added `VictoryActionGestureResolver` as the single policy for canvas Victory button gestures.
- Added pointer gesture and cancellation data to the reusable input snapshot without per-frame object allocation.
- Added Fixed Catch regressions for God Mode anomaly forcing and location restrictions.

### Changed

- Victory Claim and Release now follow standard game UI behavior: the pointer must be pressed and released on the same action, but holding duration does not affect activation.
- Fixed Catch anomaly construction now uses the shared `FishAnomalyVariantResolver` for God Mode overrides.
- Clarified the separate Fixed Catch and God Mode anomaly controls in DevTools tooltips.

### Fixed

- Slow clicks and held presses on Claim or Release now activate the selected action.
- A pointer gesture that began during the fish fight cannot activate Victory after the window appears.
- Pressing outside an action, releasing on a different action, or receiving `pointercancel` no longer activates Victory.
- `godMode.forceAnomalyChance` now affects eligible Fixed Catch fish instead of being overwritten by `fixedCatch.hasAnomaly: false`.

### Removed

- Removed the short-click gesture identifier introduced for Victory; button activation no longer depends on the gameplay hold threshold.

## v0.23.53 - Victory Gesture Isolation

### Added

- Added a monotonic pointer-gesture identifier to the reusable input snapshot so states can distinguish inherited and newly started interactions without per-frame allocation.
- Added a focused Victory input regression check.

### Changed

- Split Failed and Victory state dependencies so each outcome state receives only the services it uses.

### Fixed

- Releasing a long LMB fishing pull over a Victory action no longer closes the Victory window.
- Victory actions now accept only a filtered short click or tap whose gesture started after Victory opened.
- Space-based pulling remains unchanged because keyboard release does not create a pointer click.

## v0.23.52 - God Mode Anomaly Chance

### Added

- Added the `CONFIG.debug.godMode.forceAnomalyChance` switch to force eligible anomaly rolls to a `100%` chance while God Mode is enabled.
- Added the active override to bite tick diagnostics and the chance-detail overlay.
- Added a DevTools description for the new God Mode switch.

### Changed

- Extended `FishAnomalyVariantResolver` with a non-mutating chance override; the configured species chance remains unchanged.
- Kept anomaly species support and location restrictions active even when the God Mode chance override is enabled.

## v0.23.51 - Rarity and Uniqueness Separation

### Changed

- Removed `rarity.isRarest`; weight rarity now contains only weight-derived values such as stars, half-steps and `isMaximum`.
- Made `fish.isUnique` the single source of truth for Victory's pulsing golden theme.
- Renamed `CONFIG.rarity.visual.maximum` to `CONFIG.rarity.visual.uniqueEffects` so animation settings describe their actual unique-fish responsibility.

### Fixed

- A low-weight anomalous fish can now remain at `0.5` stars with `rarity.isMaximum: false` while still receiving its unique sprite and golden Victory theme.
- Maximum star rarity without an anomaly remains an ordinary fish and does not receive the unique animation.

## v0.23.50 - Anomaly-Driven Unique Fish

### Added

- Added a species-level `anomalyVariant` policy with its own chance, anomaly identifier and allowed locations.
- Added an independent anomaly roll after a base fish bite and exposed `hasAnomaly` on the caught-fish state.
- Added production checks for every configured level-specific unique fish asset.

### Changed

- A fish is now unique only when it carries an anomaly; weight still determines its level and star rarity but no longer decides uniqueness.
- Routed anomalous crucian-stalker catches to `crucian_stalker--{level}-uniq.webp`, including all six weight levels.
- Kept fixed catches and live DevTools edits synchronized through the same anomaly, rarity and image resolvers.
- Removed the obsolete `rarityProfile`, `uniqueAtHalfSteps` and `uniqueAnomalyId` implementation instead of retaining a compatibility branch.
