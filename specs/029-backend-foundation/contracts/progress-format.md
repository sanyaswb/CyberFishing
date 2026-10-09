# Cloud Progress Format: Version 1

Design contract based on the current client persistence owners. This envelope is distinct from
inventory schemaVersion 4, HTTP API v1 and database migration numbering.

## Envelope

PUT contains exactly formatVersion: 1, a bounded clientGameVersion string and snapshot.
The server adds revision and updatedAt to the acknowledged response.

```json
{
  "formatVersion": 1,
  "clientGameVersion": "0.31.0",
  "snapshot": {
    "inventory": {
      "schemaVersion": 4,
      "items": [],
      "assemblies": [],
      "equipment": {},
      "loadouts": [],
      "settings": {"autoBait": false, "autoChum": false, "refillMemory": {}}
    },
    "locationChum": {}
  }
}
```

This illustrates section names, not a valid default player inventory. Fixtures must be captured
from the game's existing factories, including actual equipment slots and settings.

## Inventory

Capture the existing InventorySnapshotFactory output; do not design a second writable inventory.
Preserve the current canonical fields and values:

- Items: instanceId, itemId, positive integer quantity and location. Preserve existing optional
  statOverrides, rolledStats, rarity, recipe, recipeVariant, qualityGrade, freshnessState,
  conditionState, upgradeState, resourceState, detachedLineSegment, sourceLineItemId and
  sourceLineInstanceId. Do not add derived runtime/display statistics.
- Location: INVENTORY; ATTACHED with parentInstanceId, slotId and nonnegative slotIndex; or
  LOADOUT with loadoutId and slotId. Use the existing discriminated object representation.
- Assemblies: rootInstanceId, profileId, status DRAFT/PREPARED and refillSignatures.
- Equipment: existing root-slot mapping to instance ID or null.
- Loadouts: loadoutId, name, type, displayType, inventoryCellCost, rootInstanceIds, createdAt
  and updatedAt, as produced by EquipmentLoadout.snapshot(). Existing saved fields are retained.
- Settings: autoBait, autoChum and refillMemory, with their current meanings.

Validate duplicate IDs, structural item/assembly/equipment/loadout references and attachment cycles.
Historical sourceLineInstanceId does not have to reference a currently present item. Structural
checks must follow real client ownership rules, proven with fixtures; do not guess game formulas.
Optional nested saved values remain bounded JSON with their native field semantics. The server
does not certify that an item was earned, recalculate its stats or verify the game's economy.

## Location Chum

locationChum maps a location ID to activeZones and memory. activeZones preserves saved zone fields
id, x, y, baitId, deployRealTimeMs and isDelivered. memory preserves the existing grid-key/numeric
value mapping. Values must be finite and within structural limits.

deployRealTimeMs remains an epoch-based timestamp. Do not replace it with server receipt time,
shift it on upload, or pause/rebase elapsed time during restore. Preserve native freshness and
other persisted timestamps similarly. In-flight boats, combat/casting state and computed bonuses
are excluded. UI positions, account secrets and DEV controls are excluded.

## Initial Resource Limits

These are engineering defaults to verify with representative game-generated fixtures before
acceptance. A failure never truncates data or silently turns it into a fresh save.

| Bound | Initial maximum |
| --- | --- |
| Complete progress request body | 1 MiB |
| JSON nesting depth | 32 |
| Items / assemblies / loadouts | 4096 / 1024 / 256 |
| Locations | 128 |
| Active zones / memory entries per location | 1024 / 4096 |
| Identifiers / descriptive strings | 256 / 4096 characters |
| clientGameVersion | 64 characters |

Reject non-JSON values, non-finite numbers and unsafe integers in integer identity/count/revision
fields. Reject unexpected fields at envelope/canonical structural boundaries. Validate optional
native nested records without silently discarding their fields. Use safe dictionary handling;
prototype-related keys must never be merged into object prototypes. Regression fixtures determine
whether rejection or a safe dictionary representation is compatible with actual identifiers.

## Compatibility

Legacy local formats are migrated by the existing client path before upload; the API initially
accepts inventory schema 4 only. Unknown cloud or inventory versions return a controlled rejection
and preserve the local data. No guessed server migration or automatic local-key deletion is allowed.

Guest local progress remains recoverable during account import/restore. Account-bound copies are
separate from anonymous keys. Cloud fact equality survives JSONB key-order changes. Uploads remain
untrusted development progress because gameplay rules are still evaluated on the client.
