# Saved inventory visual-field audit

Date: 2026-10-04. Runtime base: `6429876b7bb1c208eb6e3fa80daa8ab0502330e5`.
Scope: top-level item fields `ratingColor`, `ratingGradient`, `powerColor`,
`powerGradient`. Result: no additional save-schema transition is required.
Production source, schema 4, config, save timing and existing storage bytes are unchanged.

## Writers, readers and ownership

| Path | Verified behavior |
| --- | --- |
| Legacy InventoryManager restore/add and `player_inventory` writer | InventoryManager always constructs InventoryItemFactory and passes it to Inventory. Every initial/add item passes through create, which excludes all four derived fields. `#saveAndNotify` writes raw Inventory items, not hydrated UI views. |
| InventoryItemFactory | Excludes all four fields from canonical raw source; preserves source identity facts, quantity, quality state and runtime rarity rules. |
| InventoryItemSnapshotMapper | Builds an explicit item DTO from identity/quantity/location plus allowed source facts; none of the four fields is an allowed source fact. Definition/effective/progression/display data is excluded. |
| InventoryV2SnapshotFactory and InventoryV2StateStore.save | Both route item records through that mapper. Current production commits write only this canonical DTO to `player_inventory_v2`. |
| LegacyItemStateMigration | Constructs identity/quantity/location and explicit allowed source facts, then normalizes the two compatible mutable legacy stats. It does not promote derived colors/gradients to source facts. |
| InventoryV2LegacyMigration | Legacy records pass through LegacyItemStateMigration before repository/assembly/loadout construction. Final items pass through the snapshot mapper before schema-4 output and store save. |
| InventoryV2SnapshotMigration | Schemas 2/3 pass through legacy item normalization and the mapper. Schema 4 passes directly through the mapper. The input snapshot is not modified. |
| InventoryV2CompositionRoot snapshot resolution | Initial, current schema 4, previous schemas 3/2 and legacy-cache paths all use the above normalization. Previous/legacy/explicit initial snapshots are saved canonically; loaded schema-4 normalization is in memory until the next existing save. |
| InventoryItemStackingPolicy | Explicitly ignores all four fields; removing these derived values does not change stack compatibility. |
| ExactAssemblyRefillSignaturePolicy / ExactItemSignaturePolicy | Explicitly ignore all four fields when constructing signatures. Contaminated and clean items produce identical keys and match. |
| AssemblyState / refill persistence | Restores and serializes existing signature records by cloning. This audit does not rewrite historical signature keys or arbitrary nested facts. Actual current signature writers exclude the four top-level item fields. |
| Legacy InventoryUI saveBuild | Delegates to InventoryManager; V2 dispatches LOADOUT_SAVE, the fallback manipulates raw factory-normalized items and writes through the existing raw writer. It is not another visual-state owner. No dead-code deletion is bundled here. |
| Presentation | Inventory progression visuals are read models/DOM styling, separate from raw repository item facts. Casting's render-frame `powerColor` is a different transient field and must not be removed by a name-based cleanup. |

Relevant implementations are in `src/game/application/inventory/`, its
`persistence/` folder, `src/bootstrap/production/inventory_composition_root.js`,
`src/game/domain/inventory/inventory_item_stacking_policy.js`,
`src/game/domain/assemblies/exact_assembly_refill_signature_policy.js`,
`src/game/domain/equipment/exact_item_signature_policy.js`, and
`src/ui/ui.js`'s existing saveBuild delegation.

## Historical and executable evidence

- At `dc5ffe3` (v0.24.0), both original exact signature policies already ignored
  powerColor/powerGradient. At `148fa52` (v0.24.25), both also ignored ratingColor/
  ratingGradient, and `src/systems/inventory_item_factory.js` excluded all four.
  History was read only; no historical evidence or schema record was changed.
- A read-only SourceRuntime diagnostic injected all four fields and exercised raw
  factory, current mapper, legacy normalization, schemas 2/3/4, state-store save,
  stacking and both exact-signature policies. All ten paths passed; schema remains 4,
  quantity/quality facts survive, input snapshots stay unchanged, and signature keys
  are identical to uncontaminated items.
- Existing `utils/item-progression-check.js` now checks all four fields in its raw
  item fixture. Existing `utils/inventory-v2-migration-check.js` now exercises the
  same contaminated snapshot under schemas 2, 3 and 4, asserting that item identity,
  quantity and quality survive while the four derived fields are absent. Both pass.
- `utils/inventory-v2-equipment-hydration-check.js` passes. No new check or standalone
  framework was added; the catalog remains 64. The added regression scenarios cost
  24 utils lines, to be offset within the unchanged Stage 5 closure budget.
- Full checkpoint acceptance is recorded in
  `../../archive/stage5_visual_field_audit_acceptance.json`; its source snapshot
  includes these test additions and the pending cutover proposal before final
  informational evidence edits. It ran 2026-10-04 19:27:38–19:28:17 UTC: Quick
  24/24, Architecture 32/32, Full 64/64 executed, zero cached/failures/isolation
  violations, unchanged source. Full report SHA-256:
  `dfa1c6fffe2e0271248ea02e39094d490f116d99d0eeae41b9d8b601b06cec03`.
  Browser/runtime evidence remains Game 027's exact
  unchanged production source, with three save strings identical after reload.

## Decision and limits

Keep the existing factory/DTO normalization and signature exclusions. Do not bump the
schema, eagerly rewrite caches, alter the save format, or remove similarly named
render-frame fields. Existing contaminated schema-4 storage can retain old fields
until a normal save; its restored runtime and future canonical save already exclude
them. Legacy cache keys intentionally remain available for recovery.

This conclusion covers the four historical top-level derived fields and verified
writers. It does not authorize deleting arbitrary nested keys from rolled stats,
recipes, source facts or externally constructed signature payloads. Any future
change to those facts requires its own save-compatibility review.
