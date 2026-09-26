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
- npm run check:quick (~40 s), npm run check:architecture, npm run check -- --suite history, npm run check (Full, ~55-70 min on Windows).

## Current state (2026-09-27)
- Released v0.24.63 (batch 025, local commit + tag): batches 001–025 complete, 77 migrated Domain modules; runtime 86 modules / 94 activations (2 retired) / 141 bridges; activeBatchId = null.
- Activation retirement is implemented end to end (retiredActivations ledger, inert classic placeholders, dist shim deletion with rollback, fixtures check stage-3-activation-retirement-fixtures).
- Informational documents (this file, refactor_Task.txt) are not release metadata from batch 025 on; history replays use architecture/migration/stage_3_informational_documents_freeze.json.
- Check catalog supports args; utils/architecture/run-check-at-checkpoint.js runs a check on the exact reconstructed state before a batch (used by eleven 006-008 history checks at --before-batch 025).
- Long suites run on snapshot copies in %TEMP% (robocopy excluding node_modules + node_modules junction) so the working tree never blocks.
- Browser acceptance is performed by the owner (VS Code Go Live, hard reload) with explicit console counts.

## Next tasks
1. Shared Stage 3 batch tooling for 026+ (owner spec 2026-09-26): shared lifecycle components, profile.js + behavior_cases.js (+ optional fixtures.js) per batch, one dispatcher "node utils/architecture/stage-3-batch.js --batch NNN --step <step>", shared check entrypoint via catalog args, equivalence with batch-025 outputs, batch-026 isolated pilot; separate commit without version change.
2. Check pipeline acceleration (awaiting owner approval): input-traced seals, release-checkpoint history + link check, parallel runner with resource locks, snapshot runs, sealed-vs-executed reporting.
3. Batches 026–032 -> v0.24.64–v0.24.70 (retirements recomputed at each preflight; expected 027/029/030/031; earlier-batch imports from 028).
4. Review queue 033/034 evidence prerequisites; prerequisite backlog; graph re-review and new freeze; repeat until Stage 3 is complete, then Stage 4.
