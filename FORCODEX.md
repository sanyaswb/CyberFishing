& 'C:\Program Files\Git\cmd\git.exe' status --short
Використовувати повний шлях до git.exe. Постійне рішення: додати C:\Program Files\Git\cmd у системний або user PATH і перезапустити Codex/термінал.

# CyberFishing — handoff notes for Codex (state 2026-10-02)

Informational document: no check reads this file or refactor_Task.txt (owner decision 2026-09-26).
Full plan: refactor_Task.txt. Changelog: CHANGELOG.md.

## Rules
- Architecture migration only: never change gameplay, formulas, APIs, save format, timing or performance.
- Never weaken guards, baselines or whitelists to make checks green.
- package.json stays byte-identical except the version field in release transitions.
- Preserve exact CRLF/LF bytes of existing files (migration evidence hashes working-tree bytes).
- Close the game tab/DevTools and stop npm run dev before rebuilds (dist/stage-3-compat-runtime EPERM lock).
- Do not create project files while Full or history runs (corpus checks); stage in a temp directory.
- Browser smoke evidence must name the actual performer; batch 039 was performed by the owner with explicit console counts.
- The Stage 4 autonomous brief authorizes develop pushes per cluster and release-tag pushes per milestone/closure; releases use 0.25.x.

## Checks
- Current slim catalog: Quick 29 (~26 s), Architecture 49 (~7 s), Full 78 (~26 s). Historical replays stay on migration-archive / stage3-evidence-archive.
- Cache v2 (utils/testing/CHECKS.md): policy "never" by default, reviewed "snapshot" for history replays; read-only checks run in parallel.
- Acceptance: node utils/run-checks.js --acceptance --report <abs> (every check executed, ~63 min); batch release gate: --release-gate --report <abs> (history replays may be cached, ~49 min); stage-3-batch.js automated-acceptance takes --check-report.

## Stage 3 closed (2026-10-02)
- Release v0.24.89: batches 001–051 complete, all 139 Domain modules migrated; runtime 150 modules / 131 activations / 192 bridges (removal stages 4/5/6); one inert module (BuffManager, no classic consumer).
- Closure gates verified by the check stage-3-closure against architecture/migration/stage_3_closure.json; final acceptance Full 91/91 at f9a41ee (slim catalog after the 2026-10-01 history archive, tag stage3-evidence-archive).
- Last steps: prerequisite 033 (clock injection, Net converter fallback), Stage 3.50.0 repeated graph review, Stage 3.50.1 freeze extension (class-scoped hot-loop evidence), batches 049–051.
- Next: Stage 4 (Application + Platform) per refactor_Task.txt; the owner's play check of batches 046–051 is pending.

## Stage 4 checkpoint (2026-10-02)
- Seven applied clusters (001–006, 008), 24 Stage 4 ESM targets; 007 is parked/unapplied because game-config cannot name structuredClone under the unchanged policy. Inject cloning from platform/bootstrap first and prove every construction site plus structured-clone/JSON fallback parity.
- 005 b1530a3: five derived-config modules; retire 13 activations with their last 9 bridges. 006 82fa087: fight-physics adapter. 008 8ce3d8e: progression validator. All pushed; game-cycle byte-identical; browser 0 errors/0 warnings, 143 export identities match runtime after 008.
- Tooling completes exact Stage 4 retirement-ledger ownership proof and sequential partial/full retirement. Fresh Full 78/78 (all executed, source unchanged); one common record check (10 projector / 15 retirement fixtures). Runtime 174 modules / 143 activations / 220 bridges. Version remains 0.24.89; Stage 4 and M1 are open.
- Continue 007 prerequisite, then 009 project-version release projection, 010 config root + RuntimeConfig port and 011 schema validator, followed by platform 012–019. Brief allows parking one cluster while independent work continues. Read CLAUDE.md and .claude/specs/stage4-cluster-path-design.md first.

## Historical state (2026-09-30)
- Released v0.24.77 (batch 039): batches 001–039 complete, 106 migrated Domain modules; runtime 116 modules / 105 activations / 168 bridges; activeBatchId = null. Batch 039 release gate 240/240 PASS (175 executed / 65 reviewed history seals), owner smoke PASS with 0 errors / 0 warnings, release closure verified. Stage 3.40.0 frozen batches 040–046 remain, followed by evidence and a new freeze for review-queue batches 047–050.
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
- Prerequisites 018-026 (entities-world-rules, group complete; the six decompositions are done): 018 GodMode bite override through the injected DevFlagsProvider; 019 EquipmentRules config injection; 020 tackle.js six CONFIG getters removed, live CONFIG injected; 021 ConsoleLogger (deletedFiles, globalProviderReplacements); 022 fish.js diagnostics through the injected logger; 023 rod kind names in a rodKinds section of INVENTORY_RULE_MESSAGES (first transition without a Manifest write); 024 rules.js without self-composition, reclassified cohesive; 025 fish.js and tackle.js reviewed without edit (hot loops not split); 026 ViewportProjector moved to its own game-application file (split slot 204), LocationMap keeps its map revision. Owner decision framework 2026-09-29 governs decomposition choices (see refactor_Task.txt).
- Tooling after 021: cacheable 007 observation replays (historical build in a temp workspace, c48e724, ~30 min less per release gate); seal compares every observed value and the tracer is bounded (df8e217). Group-end acceptance Full 237/237 at df8e217 (all executed). Quick 75, Architecture 99, catalog 237, history 137.
- Transition task fields (reviewed, owner decisions 007-021): manifestUpdates, reclassifiedWithoutEdit, reviewedWithoutEdit, globalProviderAdditions / Removals / Replacements (mutually exclusive kinds; replacements only as exact pairs), createdFiles, deletedFiles (full before-image, byte-exact rollback), metadataWrites. The Stage 1 closure counts the recorded global net change.
- Deferred tasks agreed in 007-021 are listed per stage in refactor_Task.txt (Stage 4-7 sections).
- Browser acceptance: owner-authorized automated substitute since 2026-09-27 (game-cycle check without seals + built-in browser screenshots + instrumented console counts; authorization quoted verbatim in evidence).

## Next tasks
1. Resolve the recorded 007 clone-injection prerequisite without adding globals, forbidden edges or policy exceptions; resume plan/apply/verify.
2. Continue config 009–011, then independent platform clusters 012–019; milestone M1 release 0.25.0 only after all required work and acceptance pass.
3. Archive Stage-3-only tooling after inspecting its live consumers; preserve the runtime/guard building blocks and the ~2,000-line Stage 4 tooling budget.
4. Complete M2, deferred Stage 4 tasks and closure evidence before the closure release and stage4-closed tag.
