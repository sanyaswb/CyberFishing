# Refactoring: remaining steps (handoff 2026-10-08)

State: v0.30.0 released (specs 001–005); spec 006 (unreachable item progression UI) committed after it.
Reference values: `node utils/run-checks.js` 37/37; game-cycle stdout SHA256
`7b9baea38feaa4b550e20bc2d22d5eed7875a8c7fb6f3fdf9e176ddf573ed5b6`; `node utils/architecture-check.js` 19 negative
fixtures, production 462 modules / 653 imports.

Process for every step (DEVELOPMENT_RULES.md): spec in `specs/00N-*/spec.md` → change → reachability/parity proof →
all checks + guard + unchanged game-cycle digest → browser smoke of `index.html` and `dev.html` (0 console errors) →
commit with facts → push. Behavior, saves, formulas and timing stay unchanged unless the owner decides otherwise.

## Steps

1. **Write-only progression styling (007).** After spec 006 nothing reads what `ItemProgressionDomAdapter` writes on a
   card: the `--item-*` CSS variables (`#applyVariables`, `#properties`) and the `has-item-progression` class have no
   CSS or code consumer. The capacity color resolved by `ItemProgressionVisualResolver` is no longer displayed either
   (rating and quality colors are still used by `InventoryItemParametersResolver`). Prove there is no reader, remove,
   and adjust the `degradation-color-check` assertion that only pins the capacity color source.
2. **Rating-tier badge option (owner decision).** `InventoryItemCardRenderer` passes `renderLevelBadge`, the adapter
   reads `renderRatingTierBadge`, so the badge ignores `showMetadata`. Dormant: `ratingTier` is disabled in the
   production config. Options: rename the option (behavior change only when `ratingTier` is enabled) or decide step 3.
3. **`ratingTier` capability (owner decision).** Config-gated balance feature, off in production: resolver, sort
   criterion, parameter row, config validator, badge, `ITEM_PROGRESSION_LABELS`. Keep for balance work, or remove the
   whole capability (then step 2 disappears).
4. **Test-only Domain module (008).** `src/game/domain/inventory/delegating_inventory_capacity_policy.js` is reachable
   from neither entry; only `inventory-equipment-check`, `inventory-integration-check` and
   `inventory-save-round-trip-check` use it. Move it to `utils/testing/` (or inline a test double) and delete it from `src`.
5. **Developer notes in production comments (optional, 009).** About 30 files in engine/domain/application/platform/
   bootstrap keep Ukrainian edit notes such as `// <--- ЗМІНЕНО` or `/* Можеш змінити висоту… */`. The guard ignores
   comments; rewrite the useful ones in English and drop edit markers. No code change; digest must stay identical.
Open items carried over from the archived plan (`refactor_Task.txt` §6 at tag `migration-final-archive`; the rest
of §6 is done: tooling archive and LF portability in 0.28.0, repository id fallback and `getDebugRevision` retired):

6. **Unused gameplay-bridge readiness methods (§6 "coverage/API review").** `InventoryGameplayBridge.evaluateBiteReadiness`
   / `evaluateChumBonus` (and `FishingReadinessPolicy.evaluateChumBonus` behind them) have no caller in `src/`; only
   `inventory-integration-check` and `inventory-equipment-check` call them. Remove with those assertions, or keep with
   a written reason. (`BuffManager` from the same item was removed in 0.29.0.)
7. **"debug" → diagnostics naming (§6, 017).** Public accessors are already `getDiagnostics`; `FishForceSystem` and
   `TackleStressSystem` still name the snapshot `#debug` and expose a `debug:` key. Rename, preserving every reader.
8. **ViewportProjector (§6).** It still holds camera state (`#cameraX/Y`, `pan`, `focusOnVirtualPos`) next to world
   perspective (`getPerspective`). Split only with hot-loop evidence (allocations, call counts, game-cycle digest).
9. **`struct` script (§6, owner decision).** `npm run struct` also lists untracked local files (CLAUDE.md, CODEX.md),
   so `project-structure.txt` is generated from `git ls-files`. Decide: keep manual generation or make the script
   use tracked files only.
10. **Patch release 0.30.1.** CHANGELOG (1–3 lines), version in `package.json`, `package-lock.json` (2 places),
   `project_version.js` (version, codename, notes), `index.html`/`dev.html` `?v=`; regenerate `project-structure.txt`
   from `git ls-files` (not `npm run struct`); fresh clone `npm ci` + `npm run check`; tag `v0.30.1`; push.
11. **Local housekeeping (never committed).** Shrink the local `CLAUDE.md` to the current light process (most of its
   Stage 3–6 tooling rules are historical) and update the resume point and memory.

Owner-side: spec-kit CLI does not install in the agent sandbox; run
`uv tool install specify-cli --from git+https://github.com/github/spec-kit.git` locally if the `specify` CLI is wanted.
