# CyberFishing changelog

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
