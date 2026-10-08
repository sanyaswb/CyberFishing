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
6. **Patch release 0.30.1.** CHANGELOG (1–3 lines), version in `package.json`, `package-lock.json` (2 places),
   `project_version.js` (version, codename, notes), `index.html`/`dev.html` `?v=`; regenerate `project-structure.txt`
   from `git ls-files` (not `npm run struct`); fresh clone `npm ci` + `npm run check`; tag `v0.30.1`; push.
7. **Local housekeeping (never committed).** Shrink the local `CLAUDE.md` to the current light process (most of its
   Stage 3–6 tooling rules are historical) and update the resume point and memory.

Owner-side: spec-kit CLI does not install in the agent sandbox; run
`uv tool install specify-cli --from git+https://github.com/github/spec-kit.git` locally if the `specify` CLI is wanted.
