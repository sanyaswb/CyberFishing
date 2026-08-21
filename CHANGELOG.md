# CyberFishing changelog

## v0.24.32 - Classic Bridge Build Foundation

### Added

- Added an executable Stage 2 execution-state contract with derived batch sequencing and an explicit `esmRuntimeIntegrationStarted` lifecycle flag.
- Added exact migration-bridge identity, registry consumer set-equality, minimal wrapper AST and recursive approved dependency-closure validation.
- Added a deterministic Vite IIFE bridge builder with graph diagnostics, safe staging and preservation of the previous validated output on failure.

### Changed

- Made the development server validate and build active approved bridges before opening its HTTP port.
- Moved the package contract to Stage 2.0 while preserving CommonJS tooling, `index.html` ownership and the classic runtime.
- Made the Stage 1 closure historical through exact reversible semantic release deltas instead of unrestricted path exceptions.

### Validation

- Kept the bridge registry empty: no runtime bridge artifacts or production ESM modules are active in this release.
- Preserved 424 classic scripts, 771 confirmed dependency edges, 855 global identities and 203 exact known-debt diagnostics.
- Made no gameplay, UI, fishing-physics, inventory or save-format changes.

## v0.24.31 - Modular Architecture Foundation

### Added

- Added an evidence-backed migration manifest for all 424 current JavaScript modules, including providers, consumers, environment capabilities and 771 confirmed source dependency edges.
- Added executable architecture guards for dependency boundaries, SCC cycles, global namespace growth, browser capabilities, development leakage and ESM conventions.
- Added reproducible package infrastructure with an exact Vite version, an isolated native ESM fixture runtime and a synthetic Vite build smoke check that leaves the classic game graph untouched.
- Added the approved Stage 2 batch freeze: one bridge-build prerequisite and four ordered engine batches covering nine dependency-free modules.

### Changed

- Classified every current source module by target boundary, target path, roles, migration wave and explicit blockers.
- Converted current architecture violations into 203 exact reviewed `KNOWN-DEBT` records while keeping new, changed or stale violations as hard failures.
- Fixed the Stage 2 compatibility strategy to synchronous classic IIFE artifacts built from ESM wrappers, preserving `program-init` availability for eager legacy consumers such as `RenderPass` subclasses.

### Validation

- Kept `index.html` as the production entrypoint with 424 classic scripts and no production ESM or Vite game bundle in Stage 1.
- Verified Architecture, Quick and full regression suites, reproducible `npm ci`, and browser startup without console errors.
- Made no gameplay, UI, fishing-physics, inventory, save-format or game-state semantic changes.

## v0.24.30 - Effective Item Rarity Read Model

### Added

- Added `EffectiveItemRarityResolver` as the single read-model boundary that combines authored `ItemDefinition.rarityProfile` with an optional instance-specific rarity fact.
- Added a snapshot round-trip regression check covering rarity restoration, localized labels, CSS projection, filtering and default sorting.

### Changed

- Restored authored rarity descriptors while hydrating Inventory V2 items after save/load without duplicating authored rarity in canonical snapshots.
- Made Inventory V2 cards, parameters, balance tooltips, filters, sorting and assembly grouping consume the restored `item.rarity` descriptor instead of reading `rarityProfile` at runtime.
- Kept the default inventory order explicit: rarity descending (`unique`/`legendary` first, `common` last), with the original repository order preserved for equal rarity.

### Fixed

- Fixed missing rarity frames, backgrounds and CSS variables after Inventory V2 snapshot restoration.
- Fixed rarity labels silently falling back to `Звичайний` when a valid domain descriptor had no presentation-level `id`.
- Fixed technical items without a rarity descriptor receiving a misleading empty `has-rarity` card state.
- Fixed items without a rarity capability being counted and filtered as `common`; they now remain visible only in unfiltered views and sort after graded items.
- Completed isolated test-runtime dependency loading for item views introduced by the rarity reconstruction boundary.

## v0.24.29 - Final Item Stat Contract

### Changed

- Moved assembly and compatibility metadata out of `gameplayStats`. Runtime consumers now read `capabilities`, `equipmentCapabilities`, `requiresTag` and `assemblyProfileId` only from the item definition.
- Removed unconsumed `rigPower` and `sensitivity` stats and their Inventory V2 parameter metadata.
- Hardened item validation against generic `level`, `power` and `type`, plus metadata stored inside numerical gameplay stats.
- Removed legacy progression and power aliases from runtime sorting; the final runtime contract is based on `itemType`, `variant`, `effectiveStats`, explicit domain levels and optional descriptors.

### Tests

- Added a final stat-contract audit that scans production item definitions and verifies canonical metadata consumers and sorting keys.

## v0.24.28 - Hook Domain Semantics

### Added

- Added `hookSizeGrade` as the explicit hook-to-fish compatibility parameter and `hookPowerGrade` as the input to the preserved hook power formula.
- Added `HookPowerPolicy` as the single owner of hook power calculation; Quality continues to affect it only through `HookQualityModifier`.

### Changed

- Removed the hook's implicit use of `equipmentPowerLevel` as both size and power.
- Kept `maxLoadKg` responsible for mechanical strength and removed the duplicate hook formula from debug formatting.

### Tests

- Added comparative coverage proving that the refactor preserves the current hook power balance while separating size, strength and Quality semantics.

## v0.24.27 - Gameplay-backed Freshness

### Added

- Added canonical `freshnessState.percent`, linear water-exposure decay, a configurable freshness modifier and read-only projected Freshness descriptors.
- Added a shared cast-exposure resolver, an application service that commits bait exposure once per retrieval, a freshness-aware refill compatibility policy and freshest-candidate selection.

### Changed

- Renamed bounded metric configuration from `runtimeOverridePath` to `instanceStatePath` and made value resolution explicitly `instance → authored → default`.
- Made `BaitEffectivenessResolver` combine fish affinity with Freshness while keeping compatibility stars stable and hiding undiscovered values.
- Replaced parallel bait ID/type inputs with one canonical bait-candidate collection shared by `WaitingState`, `BiteSystem` and debug.
- Kept Freshness out of refill signatures but inside exact stacking identity, so differently aged bait never merges and auto-refill chooses the freshest compatible item.
- Persisted only validated, rounded, non-default Freshness state in schema 4; legacy invalid state is discarded once at the storage boundary with a warning.

### Tests

- Added decay, modifier, best-candidate, idempotent retrieval, save/load, legacy default, stacking, auto-refill, UI and debug consistency coverage.

## v0.24.26 - Contextual Bait Effectiveness

### Added

- Added a dedicated bait-effectiveness domain with immutable descriptors, a relative five-star grading policy and an injectable knowledge policy for future discovery/journal mechanics.
- Added an inventory catalog projection that evaluates bait and lure effectiveness separately for every fish species.

### Changed

- Made `BaitEffectivenessResolver` the single consumer of `fish.baitMultipliers`. `BiteSystem`, its debug breakdown and Inventory V2 now use the same authoritative affinity values.
- Replaced misleading global bait/lure strength in the UI with contextual effectiveness by fish species. Stars compare an item with the best configured bait for that same fish; the tooltip also exposes the actual bite multiplier.
- Removed unused `attractionPower` and `jigPower` from item gameplay stats and parameter metadata. Natural bait no longer carries decorative Quality values without a gameplay effect.
- Kept player knowledge independent from mechanics: hiding an undiscovered effectiveness descriptor cannot change the multiplier used by `BiteSystem`.
- Aligned the Crucian Stalker asset catalog with the canonical `unique/` directory used by its configured visual pattern.

### Tests

- Added contextual multiplier, relative grade, knowledge-policy, inventory read-model, UI descriptor and single-source checks.
- Updated fish-generation integration to inject the shared bait-effectiveness resolver.

## v0.24.25 - Optional Item Metric Capabilities

### Added

- Added capability-driven item metric profiles: the presence of `rating`, `ratingTier`, `quality`, `condition`, `capacity` or `freshness` configuration now determines whether its descriptor exists.
- Added a shared bounded-metric resolver with dedicated condition and freshness descriptors. Freshness is supported by the contract but remains disabled in production until a gameplay consumer is implemented.

### Changed

- Removed the global automatic `progressionLevel` scale. Optional rating segmentation is now named `ratingTier` and must be configured per group; no production group currently enables it.
- Kept boat `upgradeLevel` as an independent domain fact. It may affect boat rating through actual level-based speed, but it is never replaced by a derived rating tier.
- Limited production ratings to gameplay-backed metrics. Natural bait, lures, floats and feeder rigs no longer receive misleading global ratings from unused `attractionPower`, `jigPower`, `sensitivity` or `rigPower` values.
- Limited Quality to confirmed consumers: hook power, landing-net chance and environmental compensation for floats, feeder rigs and lures.
- Limited Condition to durability-backed rods, reels, fishing lines, leaders and hooks. Items without the capability no longer receive an artificial 100% descriptor.
- Updated Inventory V2 parameters, tooltips, sorting, debug snapshots and visual badges to render only descriptors that actually exist.

### Validation

- The progression validator now validates only capabilities present in each group, rejects unknown capability names, requires `ratingTier` to have a configured `rating` source and requires gameplay-backed metrics to declare their confirmed `gameplayConsumer`.
- Yellow matrix candidates remain absent from production configuration until a concrete gameplay consumer is confirmed.

### Tests

- Updated progression, condition, Inventory V2 integration and UI checks for optional descriptors, explicit `ratingTier`, independent `upgradeLevel` and opt-in freshness.

## v0.24.24 - Canonical Item State Hardening

### Added

- Added an explicit `ItemStatOverridePolicy` and mutable-stat schema. Unknown, misspelled, wrong-type and definition-immutable overrides are rejected before effective stats are produced or persisted.
- Added `InventoryItemSnapshotMapper` as a strict persistence DTO. Inventory saves now contain only identity, custody and explicitly supported instance facts.

### Changed

- Made `ItemDefinition` authoritative for `itemType`, `variant` and other definition metadata; runtime records can no longer replace classification during hydration.
- Upgraded Inventory V2 persistence to schema 4. Current snapshots are normalized at load time, while schema 2/3 data is migrated once at the storage boundary.
- Narrowed legacy stat migration to confirmed mutable state (`lengthMeters` and `durability`). Legacy `engineStats`, generic levels and authored balance values are discarded instead of being pinned as permanent `statOverrides`.
- Kept instance-specific rarity, recipe, rolled stats and line-segment lineage as explicit source facts while excluding derived progression and effective-stat projections.

### Tests

- Added a dedicated item-state hardening check for override validation, immutable classification, strict snapshot whitelisting, narrow legacy migration and snapshot-factory enforcement.
- Updated migration and inventory integration fixtures to distinguish authored equipment characteristics from mutable line state.

## v0.24.23 - Canonical Item Runtime

### Changed

- Replaced the legacy equipment projection with a canonical equipment read model that preserves `itemType`, `variant` and immutable `effectiveStats` without recreating `type`, `engineStats` or top-level stat copies.
- Migrated remaining gameplay, inventory, UI and debug consumers to the canonical item contract.
- Made runtime effective-stat resolution strict: authored values come only from `gameplayStats`, while instance changes come only from `statOverrides`.
- Removed runtime semantic normalization from item factories, hydrators and line controllers; invalid Inventory V2 initialization now fails instead of silently switching back after an initialization error.

### Compatibility

- Moved legacy item conversion into the persistence layer and upgraded Inventory V2 schema from 2 to 3.
- Existing schema 2 and older inventory data is converted once during loading, immediately saved in canonical form and then used without compatibility fallbacks.

### Tests

- Added schema 2-to-3 migration coverage and assertions that canonical equipment read models never expose legacy item fields.
- Updated inventory, progression, UI and gameplay scenarios to construct canonical instance overrides and derived runtime views.
