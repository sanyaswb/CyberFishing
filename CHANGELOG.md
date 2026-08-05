# CyberFishing changelog

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

### Tests

- Covered production profiles, invalid bounds and duplicate unique IDs, immutable descriptor migration, shared fish/item colors and startup rejection of invalid rarity configuration.

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

### Tests

- Covered declarative alias discovery, bidirectional UI synchronization, legacy override normalization, canonical precedence and the absence of duplicate config storage.

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

### Tests

- Covered inherited fight release, held button press, mismatched press/release targets, pointer cancellation, both Victory actions and Fixed Catch anomaly precedence.

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

### Tests

- Covered inherited raw pointer release, an inherited same-gesture click, a new click outside the actions and a new click on the Claim action.

## v0.23.52 - God Mode Anomaly Chance

### Added

- Added the `CONFIG.debug.godMode.forceAnomalyChance` switch to force eligible anomaly rolls to a `100%` chance while God Mode is enabled.
- Added the active override to bite tick diagnostics and the chance-detail overlay.
- Added a DevTools description for the new God Mode switch.

### Changed

- Extended `FishAnomalyVariantResolver` with a non-mutating chance override; the configured species chance remains unchanged.
- Kept anomaly species support and location restrictions active even when the God Mode chance override is enabled.

### Tests

- Added regressions for a normally failing high anomaly roll, the forced `100%` result, location restrictions and unique level-skin routing.

## v0.23.51 - Rarity and Uniqueness Separation

### Changed

- Removed `rarity.isRarest`; weight rarity now contains only weight-derived values such as stars, half-steps and `isMaximum`.
- Made `fish.isUnique` the single source of truth for Victory's pulsing golden theme.
- Renamed `CONFIG.rarity.visual.maximum` to `CONFIG.rarity.visual.uniqueEffects` so animation settings describe their actual unique-fish responsibility.

### Fixed

- A low-weight anomalous fish can now remain at `0.5` stars with `rarity.isMaximum: false` while still receiving its unique sprite and golden Victory theme.
- Maximum star rarity without an anomaly remains an ordinary fish and does not receive the unique animation.

### Tests

- Added regression coverage comparing ordinary and unique `0.5`-star fish, Victory state transfer and the absence of anomaly-derived fields inside `rarity`.

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

### Tests

- Added regressions for exact anomaly chance boundaries, location restrictions, ordinary maximum-weight fish, anomalous level-six fish, all six fixed-catch skins and live DevTools anomaly toggles.
