# CyberFishing changelog

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
