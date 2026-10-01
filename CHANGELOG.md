# CyberFishing changelog

## v0.24.85 - Equipment Rules Loadout Planner And Line System Domain

### Changed

- Migrated the equipment slot, readiness and transition rules, the loadout transition planner and the per-frame LineSystem to the Domain (representation-only, game-cycle output unchanged).
- Changelog trimmed to v0.24.70 and newer; older entries live in git history and the stage3-evidence-archive tag.

## v0.24.84 - Idle Retrieve Policy Domain

### Changed

- Migrated RetrievePolicy, PassiveLureRetrievePolicy, PoleIdleRetrievePolicy and IdleRetrievePolicyResolver as named ESM exports; the per-frame retrieve parameters are unchanged.
- Retired the resolveFightPhysicsConfig activation as a shared-source line removal: the landing policy shim keeps LandingPolicyResolver.
- Extended the cumulative runtime from 134 to 135 project modules; 126 active activations and 201 exact bridge relationships.
- The next task is batch 047 preflight.

## v0.24.83 - Equipment State And Loadout Domain

### Changed

- Migrated EquipmentState and EquipmentLoadout with LOADOUT_DISPLAY_NAME as named ESM exports; persisted snapshots are unchanged.
- Retired the EQUIPMENT_AUXILIARY_SLOT_IDS activation as a shared-source line removal (new in the shared tooling): the catalog shim keeps its other four activations.
- Extended the cumulative runtime from 132 to 134 project modules; 126 active activations and 201 exact bridge relationships.
- The next task is batch 046 preflight.

## v0.24.82 - Item Catalog Baseline Registry Domain

### Changed

- Migrated the item catalog baseline registry with one named ESM export; its baseline cache keeps the reviewed get, set and clear identity.
- Extended the cumulative runtime from 131 to 132 project modules and the active activation set from 124 to 125 contracts, with 198 exact bridge relationships.
- The next task is batch 045 preflight.

## v0.24.81 - Casting Fishing And Inventory Domain

### Changed

- Migrated six casting, fishing and inventory sources with six named ESM exports and eight completed-prefix imports.
- Retired the FloatTackleLineBudgetPolicy, RodStrokeCapacityResolver, TackleFailureSelector, TackleStressAccumulator and WeakestTackleLimitResolver activations; their readers now import them.
- Extended the cumulative runtime from 125 to 131 project modules; 124 active activations and 197 exact bridge relationships.
- The next task is batch 044 preflight.

## v0.24.80 - Equipment Slot Catalog Domain

### Changed

- Migrated the equipment slot catalog source with five named ESM exports; the persisted slot ids and frozen tables are unchanged.
- Added the reviewed frozenDataConstants shape to the shared Stage 3 batch tooling for data sources made only of deeply frozen tables.
- Added fifteen exact classic consumer bridges and five activations at legacy slot 30.
- Extended the cumulative runtime from 124 to 125 project modules and the active activation set from 118 to 123 contracts, with 196 exact bridge relationships.
- Correction: batch 039 browser acceptance was the automated substitute, not the owner; the browser-acceptance step now requires an explicit --performed-by basis.
- The next task is batch 043 preflight.

## v0.24.79 - Landing Policy Domain

### Changed

- Adopted the Stage 3.42.0 replacement suffix after the duplicate-helper removal and migrated the landing policy source with five named ESM exports.
- Added five exact classic consumer bridges for LandingPolicyResolver and the resolveFightPhysicsConfig helper.
- Extended the cumulative runtime from 123 to 124 project modules and the active activation set from 116 to 118 contracts, with 181 exact bridge relationships.
- The next task is batch 042 preflight.

## v0.24.78 - Casting Items Line And Rules Domain

### Changed

- Adopted the Stage 3.41.0 replacement suffix after the normalizeDistance Engine prerequisite and migrated six Domain sources with twelve named ESM exports.
- Replaced three legacy dependency bridges with reviewed ESM imports while preserving ten exact classic consumer bridges.
- Extended the cumulative runtime from 117 to 123 project modules and the active activation set from 106 to 116 contracts, with 176 exact bridge relationships (10 added, 3 retired); the review ledger contains 139 activations including retired history.
- The next task is batch 041 preflight.

## v0.24.77 - Inventory Capacity And Stamina Domain

### Changed

- Opened the Stage 3.40.0 approved prefix (grouped batches after the six decompositions and Vector2 Engine ownership) with batch 039: InventoryCapacityPolicy, UnlimitedInventoryCapacityPolicy, DelegatingInventoryCapacityPolicy and StaminaController as named ESM exports.
- Extended the cumulative graph from 114 to 116 project modules and from 103 to 105 activation contracts, with 168 exact bridge relationships (5 added).
- The next batch is 040 of the Stage 3.40.0 approved prefix.

## v0.24.76 - Assemblies Profile Registry Domain

### Changed

- Completed batch 038, the last batch of the Stage 3.36.0 approved prefix: AssemblyProfileRegistry as a named ESM export; its profile table stays injected by the composition roots.
- Extended the cumulative graph from 112 to 113 project modules and from 101 to 102 activation contracts, with 143 exact bridge relationships (2 added).
- The next task is the Vector2 extraction and the responsibility decompositions, followed by another repeated graph review.

## v0.24.75 - Items Bait, Freshness and Progression Resolvers Domain

### Changed

- Completed batch 037: BaitEffectivenessResolver, ItemFreshnessResolver and ItemProgressionResolver as named ESM exports with seven reviewed completed-prefix imports; descriptor factories stay injected; the progression memo cache keeps one owner.
- Retired the BaitEffectivenessMatch, ItemBoundedMetricResolver and ItemProgressionDescriptor activations as inert classic placeholders.
- Extended the cumulative graph from 109 to 112 project modules (101 activation contracts), with 141 exact bridge relationships (3 added, 7 retired).
- The next task is batch 038 preflight.

## v0.24.74 - Items Effective Stats Domain

### Changed

- Completed batch 036: ItemStatOverridePolicy and EffectiveItemStatsResolver as named ESM exports, composed by GameCompositionRoot from the injected override table; their reviewed globalThis exposures moved to the activation shims.
- Extended the cumulative graph from 107 to 109 project modules and from 99 to 101 activation contracts, with 145 exact bridge relationships (2 added).
- The next task is batch 037 preflight.

## v0.24.73 - Items Condition Resolver Domain

### Changed

- Prerequisite transitions 001-005 (config injection of AssemblyProfileRegistry and ItemStatOverridePolicy, descriptor boundaries of the condition, freshness and bait-effectiveness resolvers) and the Stage 3.36.0 repeated graph review froze batches 035-038.
- Completed batch 035: ItemConditionResolver as a named ESM export extending the imported ItemBoundedMetricResolver; its descriptor factory stays injected by GameCompositionRoot.
- Extended the cumulative graph from 106 to 107 project modules and from 98 to 99 activation contracts, with 143 exact bridge relationships (1 added, 1 retired).
- The next task is batch 036 preflight.

## v0.24.72 - Fishing Hot-Loop Cluster Domain

### Changed

- Completed batch 034, the last batch of the Stage 3.34.0 freeze extension: PlayerReelFatigueSession, ReelHoldRecoverySystem, ReelRecoveryFishSlowdownPolicy, TackleStressAccumulator, PlayerPullMotionSmoother and RodLateralControlSystem as named ESM exports.
- Hot-loop gates: the preflight resolves the recorded review-queue evidence of the unchanged sources, and the live validation reproduces every class member fingerprint, allocation site and game-cycle trace (call counts, deltaTime ranges, ordered arguments and results).
- Retired the ReelHoldLoadPolicy, RodControlAngleResolver and RodControlTensionModeResolver activations as inert classic placeholders.
- Extended the cumulative graph from 100 to 106 project modules and from 95 to 98 activation contracts, with 143 exact bridge relationships (6 added, 3 retired).
- The next task is the prerequisite backlog (Vector2 extraction, descriptor boundaries, config injections, decompositions) and a new graph review.

## v0.24.71 - Assemblies Assembly State Repository Domain

### Changed

- Stage 3.34.0 review-queue freeze: collection-identity evidence (AssemblyStateRepository#states, atomic local replacement and a persistence round trip) and hot-loop evidence (six fishing modules: static member review and traced game-cycle fight scenarios) froze batches 033 and 034 as an extension of the Stage 3.22 approved prefix.
- Completed batch 033: AssemblyStateRepository as a named ESM export with two reviewed completed-prefix imports (AssemblyState, AssemblyPreparationStatus) and four owner-created composition identities.
- Retired the AssemblyState and AssemblyPreparationStatus activations as inert classic placeholders (no classic reader remains).
- Extended the cumulative graph from 99 to 100 project modules and from 96 to 95 activation contracts, with 140 exact bridge relationships (2 added, 1 retired).
- The next task is batch 034 preflight (hot-loop fishing modules against the recorded game-cycle traces).

## v0.24.70 - Items Effective Rarity Resolver Domain

### Changed

- Completed batch 032, the last batch of the Stage 3.22 approved prefix: EffectiveItemRarityResolver as a named ESM export.
- Its owner-created ItemRarityResolver (batch 030) is a reviewed import proven by composition identity, and the reviewed global exposure moved to the activation shim.
- Extended the cumulative graph from 98 to 99 project modules and from 95 to 96 activation contracts, with 139 exact bridge relationships (2 added, 1 retired).
- The next task is the post-prefix review: the review queue (033, 034) evidence prerequisites and the prerequisite backlog.
