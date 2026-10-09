# Refactoring: remaining work (2026-10-09)

This is the single refactoring checklist. It replaces the open list of the
[finalization review](audits/2026-10-08-finalization-review.md) (its numbers are given as "review N").
Owner decisions for releases, legacy saves and DEV isolation:
[follow-up decisions](../specs/029-backend-foundation/follow-up-decisions.md).
Each step is a separate spec (new specs start at 033) with unchanged gameplay, saves and timing; evidence is
focused checks, Architecture + Quick + Full, the unchanged game-cycle digest and index/dev browser smoke.

## Open, in the agreed order

1. ~~**Platform singletons** (review 6).~~ Done in [033](../specs/033-platform-singletons/spec.md): page loop guard,
   per-factory id counter, injected logger in `GameControls`.
2. ~~**Inactive production DEV ports** (review 3, decision 3).~~ Done (034–036).
   - ~~Flags~~: done in [034](../specs/034-inactive-dev-flags/spec.md) — production composes `InactiveDevFlags`;
     `BiteSystem`/`FightService` read GodMode only through the port.
   - ~~Diagnostics~~: done in [035](../specs/035-inactive-diagnostics/spec.md) — production composes
     `InactiveDebugEvents`/`InactiveGameDiagnostics`; `config-updated` stays session lifecycle.
   - ~~Listener counters~~: done in [036](../specs/036-listener-counter/spec.md) — an injected DEV
     `ManagedListenerCounter` replaces the module-level/static counters.
3. ~~**Starting inventory without the legacy path** (decision 2).~~ Done in
   [037](../specs/037-starting-inventory/spec.md): `StartingInventorySnapshotFactory`, same save bytes; the legacy
   conversion runs only for classic saves (no removal date).
4. ~~**Immutable release directories** (review 7, decision 1).~~ Done in
   [038](../specs/038-pages-release/spec.md): `npm run release:pages`, `pages-release` check; the first publication
   to `gh-pages` (commit + push of the site checkout) is the owner's step.
5. **Optional contracts, second pass** (review 8, spec 032 rule). ≈450 `?.(` calls and ≈95
   `typeof … === "function"` checks remain in `src`.
6. **Test composition** (review 9). `utils/game-cycle-check.js` keeps its own `GAMEPLAY_FILES` list and
   composition; 17 files use `bindConstructorDefaults`. Build test graphs from production composition modules.
7. **Private `clamp` copies** (review 10). About 33 definitions outside `engine/math`; merge only where NaN handling
   and bound order match.
8. **Personal utility path** (review 12). `utils/create-version-copy.js` hard-codes `D:\dev\cyber fishing\versions`.
9. **Constructor defaults in inventory** (review 5). The rule is in `DEVELOPMENT_RULES.md`; verify the remaining
   ≈11 `x = new Policy()` defaults are stateless and configuration-free, inject the rest.

## Backend (spec 029): plan only

No backend code yet; [spec 029](../specs/029-backend-foundation/plan.md) records the plan. Waiting for it:
verify legacy → current → cloud import and recovery before any legacy-format support cutoff (decision 2).

## Optional

Split `FightPhysicsOrchestrator` (≈4,700 lines) by pipeline stage; static inline styling; Canvas decomposition.

## Done after the finalization review

Specs 020–028 (v0.31.0) and 030–032 plus the rarity resolver defaults; see the progress tables of the
[finalization review](audits/2026-10-08-finalization-review.md).

---

# History: cleanup closure (2026-10-08)

State: all 11 handoff steps implemented and accepted for **v0.30.1**. Classic-to-ESM migration and Stage 7
remain closed; historical machinery stays at `migration-final-archive`.

## Completed steps and decisions

1. **Write-only progression styling — done ([007](../specs/007-progression-styling/spec.md)).**
   No production/DEV reader of the six progression CSS properties or `has-item-progression`; removed their writes
   and the unused capacity visual/dependency. Rating/quality colors and the line resource meter remain.
2. **Rating-tier badge option — fixed ([010](../specs/010-rating-tier-option/spec.md)).**
   The renderer passes `renderRatingTierBadge: showMetadata`. Real adapter/card integration proves one badge with
   metadata and zero without it, including an explicitly enabled rating tier.
3. **`ratingTier` capability — retained ([010](../specs/010-rating-tier-option/spec.md)).**
   Keep the tested resolver, validator, sort/parameter/badge capability for balance overrides; it remains absent
   from production config. No gameplay or save change.
4. **Test-only Domain module — moved ([008](../specs/008-test-capacity-policy/spec.md)).**
   `DelegatingInventoryCapacityPolicy` lives in `utils/testing/doubles/`; all three test consumers use it there.
   It is reachable from neither browser entry. The source graph lost one module, runtime graphs were unchanged.
5. **Historical comments — cleaned ([009](../specs/009-production-comments/spec.md)).**
   Actual scan: 118 Cyrillic comments in 18 files. Useful explanations translated into English; edit markers and
   redundant narration removed. Every modified file retains identical code tokens; no Cyrillic comment remains
   in the inspected engine/domain/application/platform/bootstrap scope.
6. **Unused readiness APIs — removed ([011](../specs/011-unused-readiness/spec.md)).**
   Retired `InventoryGameplayBridge.evaluateBiteReadiness`/`evaluateChumBonus` and the resulting test-only policy
   branches/helpers/messages. Live `BiteSystem`, cast/equipment readiness and both inventory check files remain.
7. **Force/tackle diagnostics names — consistent ([017](../specs/017-force-diagnostics/spec.md)).**
   Private snapshots/helpers use diagnostics; the force result has `diagnostics` and all three readers migrated.
   Snapshot contents/ownership and public accessors stay unchanged; no compatibility alias added.
8. **Camera and world perspective — separated ([013](../specs/013-viewport-perspective/spec.md)).**
   Domain `WorldPerspective` owns the exact formula; application `ViewportProjector` owns camera state and coordinate
   conversion. Bootstrap binds/injects one perspective query with the same function identity and no per-frame
   wrapper. 1,200 differential frames have identical outputs and Math call traces; allocation sites unchanged.
9. **`struct` — Git-tracked files only ([014](../specs/014-tracked-structure/spec.md)).**
   `npm run struct` uses `git ls-files -z`; every tree leaf equals a tracked path. Local notes excluded, generation
   deterministic. Unused structure CLI dependency removed without unrelated package upgrades.
10. **Patch release 0.30.1 — accepted ([015](../specs/015-release-0301/spec.md)).**
    Package/lock/UI versions, codename/notes, page cache versions, short CHANGELOG and project structure updated.
    Fresh clone `npm ci` + `npm run check` passes; `npm run struct` reproduces the committed bytes. Publication
    uses the annotated `v0.30.1` tag and `develop` after acceptance.
11. **Local context — updated (never committed).**
    CLAUDE.md reduced to 36 lines with the current light process and resume point; memory index/current-release
    note updated. Historical memory files preserved as recovery references. Original local context backed up
    in `.git/codex-refactor-0301/`.

## Acceptance facts

- Architecture **2/2**, Quick **13/13**, Full **38/38** (added the viewport ownership/identity contract).
- Guard: **19 negative fixtures**; 572 source modules; production **463 modules / 654 imports**, DEV **569 / 839**.
- Game-cycle stdout SHA256 unchanged:
  `7b9baea38feaa4b550e20bc2d22d5eed7875a8c7fb6f3fdf9e176ddf573ed5b6`.
- Save round trips: schema 2/3 upgrades byte-identical; current schema/save key unchanged.
- Chrome smoke performed by Codex through `computer-use`: world renders, both entries show `v0.30.1`, both
  inventories open with 20 cards; **0/0 console errors**.
- Fresh clone: 21 packages installed; **38/38** checks; clean tree after structure regeneration, 688 tracked leaves.
  Structure SHA256 `ea55db4f0386e950ec23ef3cd2a504e004ee3e893a62592d6e81c4cc3e65d05e`.

For the next task, inspect current Git status and follow the owner's current instructions and
`DEVELOPMENT_RULES.md`; do not resume archived Stage 3–7 tooling.

Post-release follow-up: the owner authorized committing `convert-images.js` → `utils/convert-images.js`
([016](../specs/016-converter-location/spec.md)). Its base directory still points at the project root;
source/startup/search parity and Architecture/Quick/Full pass. The published v0.30.1 tag is unchanged.

## Separate follow-up tasks (2026-10-08)

The completed cleanup checklist above stays closed. New work does not reopen Stage 7.

- [Post-closure audit](audits/2026-10-08-stage7-post-closure.md): current checks/graphs/browser pass;
  no classic runtime transport or unreachable source files; remaining private-field/local-value,
  DEV fallback and test-harness candidates are recorded with evidence. No runtime cleanup was performed by the audit.
- [018 — Presentation CSS restructure](../specs/018-presentation-css-restructure/spec.md),
  [plan](../specs/018-presentation-css-restructure/plan.md),
  [tasks](../specs/018-presentation-css-restructure/tasks.md): component ownership, DEV style isolation,
  native load order and visual/cascade parity. **Completed**: [results](../specs/018-presentation-css-restructure/results.md),
  [ownership](../specs/018-presentation-css-restructure/ownership.md). 250 unchanged authored blocks,
  15 production stylesheets + one DEV stylesheet; 39 visual scenarios / seven pixel pairs pass.
  Request-overhead tradeoff measured and recorded; version/tag unchanged.

- [019 — Post-closure dead code](../specs/019-post-closure-dead-code/results.md): implemented;
  24 unused private fields, unused locals/12 methods, null-only buffs and missing bite-config
  fallback retired. Native test assertions strengthened; live/test/manual contracts retained.
  Full 38/38, Quick 13/13, Architecture 2/2; 4,837 differential records and game-cycle/save parity.

Both follow-up tasks are complete. The audit's initial findings remain a historical snapshot;
019 records their consumer decisions/removals, and 018 records the completed CSS cutover.
No classic compatibility transport or unreachable source modules remain. Live bridges/save migration
contracts are retained intentionally. Static inline styling and Canvas decomposition are optional future
tasks, not unfinished migration acceptance work.
