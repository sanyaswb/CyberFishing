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
- Released v0.24.67 (batch 029): batches 001–029 complete, 86 migrated Domain modules; runtime 95 modules / 96 activations (9 retired) / 138 bridges; activeBatchId = null.
- Shared Stage 3 batch tooling (utils/architecture/stage_three_batches, README there): one dispatcher "node utils/architecture/stage-3-batch.js --batch NNN --step <step>"; a batch = definitions/NNN/profile.js + behavior_cases.js.
- Check pipeline (utils/testing/CHECKS.md): input-traced seals, history base (release 0.24.63 reconstruction for history-only checks up to 025), parallel runner (--jobs, default 4), --no-seal, --reseal.
- Browser acceptance: owner-authorized automated substitute since 2026-09-27 (game-cycle check without seals + built-in browser screenshots + instrumented console counts; authorization quoted verbatim in evidence).

## Next tasks
1. Batch 030 (v0.24.68): HookPowerPolicy + ItemRarityResolver; retire HookQualityModifier.
2. Batches 031–032 -> v0.24.69–v0.24.70 (drafts of their definitions exist in the working session).
3. Review queue 033/034 evidence prerequisites; prerequisite backlog; graph re-review and new freeze; repeat until Stage 3 is complete, then Stage 4.
