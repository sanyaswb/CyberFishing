& 'C:\Program Files\Git\cmd\git.exe' status --short
Використовувати повний шлях до git.exe. Постійне рішення: додати C:\Program Files\Git\cmd у системний або user PATH і перезапустити Codex/термінал.

# CyberFishing — handoff notes for Codex (state 2026-09-26)

Informational document: no check reads this file or refactor_Task.txt (owner decision 2026-09-26).
Full plan: refactor_Task.txt. Changelog: CHANGELOG.md.

## Rules
- Architecture migration only: never change gameplay, formulas, APIs, save format, timing or performance.
- Never weaken guards, baselines or whitelists to make checks green.
- package.json stays byte-identical except the version field in release transitions.
- Preserve exact CRLF/LF bytes of existing files (migration evidence hashes working-tree bytes).
- Close the game tab/DevTools and stop npm run dev before rebuilds (dist/stage-3-compat-runtime EPERM lock).
- Do not create project files while Full or history runs (corpus checks); stage in a temp directory.
- Browser smoke: owner-authorized automated substitute (game-cycle-check + browser load); never record performedBy "user".
- Push only on the owner's explicit go; tags v0.24.46+ are local-only by convention.

## Checks
- npm run check:quick (~3 min), npm run check:architecture (~4 min), npm run check -- --suite history.
- Cache v2 (utils/testing/CHECKS.md): policy "never" by default, reviewed "snapshot" for history replays; read-only checks run in parallel.
- Acceptance: node utils/run-checks.js --acceptance --report <abs> (every check executed, ~63 min); batch release gate: --release-gate --report <abs> (history replays may be cached, ~49 min); stage-3-batch.js automated-acceptance takes --check-report.

## Current state (2026-09-29)
- Released v0.24.76 (batch 038): batches 001–038 complete (Stage 3.36.0 prefix done), 104 migrated Domain modules; runtime 113 modules / 102 activations (21 retired) / 143 bridges; activeBatchId = null. Remaining Domain scope: 2 blocked by Vector2, 29 deferred behind six decompositions.
- Shared Stage 3 batch tooling (utils/architecture/stage_three_batches, README there): one dispatcher "node utils/architecture/stage-3-batch.js --batch NNN --step <step>"; a batch = definitions/NNN/profile.js + behavior_cases.js.
- Check cache v2 committed (dd71d5e, tooling checkpoint, no version change): fresh acceptance Full 214/214 executed; v1 sealed counts of earlier checkpoints are superseded by it.
- Prerequisite 006 (Vector2 checkpoint A): Vector2 extracted into the classic src/core/math/vector2.js sharing split legacy slot 41 with core.js (data-legacy-slot, legacy_slot_splits.json); prerequisite transitions support created files, Manifest entries and metadata writes.
- Prerequisite 007 (equipment decomposition 1/2): EQUIPMENT_SLOT_CONFIG keeps the Domain slot catalog; labels/locked warning in the presentation EQUIPMENT_SLOT_PRESENTATION; equipment rules get the presentation INVENTORY_RULE_MESSAGES injected by InventoryV2CompositionRoot (split slot 30); transitions support reviewed manifestUpdates and globalProviderAdditions.
- Prerequisite 008 (equipment decomposition 2/2, group complete, owner played it): TerminalLineSlotResolver keeps accepted types, labels in the presentation TerminalLineSlotLabelResolver (split slot 159); TerminalLineSlotResolver and EquipmentSlotVisibilityPolicy reclassified to game-domain (Domain scope 137); waves derive from boundaries; reclassifiedWithoutEdit pins unchanged sources.
- Prerequisite 009 (inventory decomposition 1): capacity and line-allocation texts (and metre formatting) in INVENTORY_RULE_MESSAGES, injected by bootstrap (LineCompatibilityRules -> LineInventoryController) and InventoryV2CompositionRoot (composed linePolicy). Open: FlatInventoryItemRepository, InventoryItemStackingPolicy (owner decision).
- Prerequisite 010 (loadouts decomposition 1): LoadoutEquipmentTransitionPlanner capacity text injected by InventoryV2CompositionRoot. Open: EquipmentLoadout ("Комплект" default name/displayType persisted in saves; owner decision).
- Prerequisite 011 (item-progression decomposition 1): ItemCapacityResolver default labels in INVENTORY_RULE_MESSAGES, injected by bootstrap. Open: ItemCatalogBaselineRegistry (console default -> platform logger), CompositeMetricStrategy/ItemRatingResolver (reclassification without edit).
- Prerequisites 012-014 (owner decisions 2026-09-28): reviewedWithoutEdit (evidence-backed blocker removal, pinned hashes) closes inventory, loadouts and item-progression; ConsoleWarningLogger (platform, split slot 79) injected into ItemCatalogBaselineRegistry. Remaining: fishing-systems, entities-world-rules (plan for owner first).
- Prerequisites 015-017 (fishing-systems, group complete): FightPhysicsConfigAdapter fallback removed from four Domain modules (adapter read per call from the composed config); BuffManager moved to src/systems/buff_manager.js (split slot 207), StaminaController/RodPullCalculator cohesive; DistanceUnitConverter moved to src/core/distance_unit_converter.js (split slot 89); FishForceSystem/TackleStressSystem reviewed without edit. Fresh acceptance Full 228/228 at 9a15286.
- Prerequisites 018-021 (entities-world-rules, in progress): 018 tackle.js reads the GodMode bite override through the injected DevFlagsProvider (no tackle -> god_mode edge); 019 EquipmentRules gets the runtime config from GameCompositionRoot; 020 tackle.js six global CONFIG getters removed (globalProviderRemovals), Reel/Net/water entities read the live CONFIG injected by composition (hot-loop evidence as in 034); 021 ConsoleWarningLogger generalized to the platform ConsoleLogger (log/warn/error, same slot-79 member; old file deleted via deletedFiles, baseline changed by one globalProviderReplacements pair). Last commit b4059ba; Quick 70, Architecture 94.
- Transition task fields (reviewed, owner decisions 007-021): manifestUpdates, reclassifiedWithoutEdit, reviewedWithoutEdit, globalProviderAdditions / Removals / Replacements (mutually exclusive kinds; replacements only as exact pairs), createdFiles, deletedFiles (full before-image, byte-exact rollback), metadataWrites. The Stage 1 closure counts the recorded global net change.
- Deferred tasks agreed in 007-021 are listed per stage in refactor_Task.txt (Stage 4-7 sections).
- Browser acceptance: owner-authorized automated substitute since 2026-09-27 (game-cycle check without seals + built-in browser screenshots + instrumented console counts; authorization quoted verbatim in evidence).

## Next tasks
2. Next: finish entities-world-rules (022 fish.js console output through the injected ConsoleLogger; 023 rod-kind labels in a rodKinds section of INVENTORY_RULE_MESSAGES injected into EquipmentRules; per-class splits of world.js, rules.js, fish.js, tackle.js, one file per transaction, targets sent to the owner first), one acceptance Full and the owner's play check; then Vector2 checkpoint B (Engine ESM activation after the runtime tag), a repeated graph review with the enlarged Domain scope and new batches; finally the Stage 3 closure gates.
2a. Follow-up: reconcile the compatibility transport removalStage (stage-5) with Stage 6 compatibility removal (HookPowerPolicy activation is stage-6).
3. Review queue 033/034 evidence prerequisites; prerequisite backlog; graph re-review and new freeze; repeat until Stage 3 is complete, then Stage 4.
