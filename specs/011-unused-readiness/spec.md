# Feature Specification: Retire unused bite/chum readiness APIs

**Branch**: `develop` · **Created**: 2026-10-08 · **Kind**: owner-requested unused API removal

## Verified consumers
Only inventory integration/equipment checks call `InventoryGameplayBridge.evaluateBiteReadiness`,
`evaluateChumBonus` and `FishingReadinessPolicy.evaluateChumBonus`. No production or DEV consumer calls them.
After their removal, the policy's `evaluateBite` also has only equipment-check callers. Retire that dead
branch, its two private helpers and the two now-unread presentation messages. Live `BiteSystem.evaluateBite`
is a separate implementation and remains unchanged. Cast/equipment readiness stays covered.

## Requirements and acceptance
Remove only retired-API assertions and retain the empty-feeder equipment/UI assertion in integration.
Keep both check files registered. Architecture, Quick, Full, save round trips and unchanged game-cycle digest.

Implemented: Architecture 2/2, Quick 12/12, Full 37/37, including schema 2/3 byte-identical save upgrades;
game-cycle SHA256 unchanged. No retired method/message reader remains in `src/` or `utils/`.
