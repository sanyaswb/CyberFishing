# Stage 6 — closure specification (next session)

Written: 2026-10-07 (Europe/Kiev). Goal of the session: close Stage 6 in full, run the post-closure cleanup (C5) and hand off to Stage 7. Everything below is
closure (C1–C4) and cleanup (C5) work only: no gameplay, formula, save, public API or timing change; hot-loop changes only as C5 evidence-backed, behavior-identical optimizations.

## 1. Resume state (verify first)

- `git status` must show a clean tree (CODEX.md and CLAUDE.md are excluded locally). HEAD = the latest commit that
  touches this file, on top of `65fa993` (release 0.27.0). On 2026-10-07 GitHub rejected the push of these
  documentation commits with a server error: if `origin/develop` is behind HEAD, run `git push origin develop` first.
- Tags on origin: `stage6-classic-runtime-archive` → peeled `95b872da68cf776fcee497cb2135fcc99f4489e8` (parent
  `4c0817a`), `v0.27.0` → `65fa993`. No `stage6-closed` tag exists yet.
- Accepted: preparations 001–005 (`architecture/migration/stage_6/preparations/`), graph review v5, release
  `architecture/migration/stage_6/releases/001_native-development.json` (0.26.1 → 0.27.0, decision in continuation spec §8.1).
- Evidence (immutable, do not rewrite):
  - `architecture/archive/stage6_005_native-cutover_acceptance.json` — uncached Full 64/64, M3b snapshot `e2f49ba7…`.
  - `architecture/archive/stage6_release_001_acceptance.json` — uncached Full 64/64, release snapshot `754bc31d…`.
  - `architecture/archive/stage6_005_native-cutover_browser.json` — actual index.html/dev.html PASS on 0.26.1.
  - `architecture/archive/stage6_005_cutover_resume_audit.json` — the earlier failed 53/64 audit (history only).
- Measured facts: production graph 350 modules / 522 edges, DEV graph 446 / 692 (95 `src/dev`, 3 Development Bootstrap),
  0 unresolved, 0 compatibility, production DEV 0; Manifest 456 JS (DEV 97, Development Bootstrap 3, DEV entry 1);
  active bridges / activations / inert / side-effect reviews / debts / providers all 0; 380 retired activations kept
  as provenance; src 459 files / 80,162 lines; utils 219 / 47,454 (ceiling 70,358); game-cycle child stdout SHA256
  `0db62de21427af5589fa5294b53dd833522298356d1d6b7a6ce0a009f2782c6f`; gameplay save SHA256
  `efe8e56bb73dd14df3d44eefccb90140c4ed581ab23603132a55e4423918f770` (key `fishing_game_player_inventory_v2`, schema 4).

## 2. Work packages

### C1 — Browser acceptance on the released version

The existing browser report predates the version bump. Repeat the actual-page smoke on 0.27.0 with the built-in
browser and `.claude/launch.json` "cyber-fishing-dev" (port 4173):

1. Back up all localStorage keys before probing (scratchpad copy + SHA256), compare after, restore if different.
2. index.html and dev.html separately: one module script each with `?v=0.27.0`, badge `v0.27.0 prototype`,
   startup-promise/game/application/config-context identities, one loop and 0 duplicate starts, no `/dist/`,
   `/compat/` or (production) `/src/dev/` resources, no DEV/transport globals.
3. Production: `GameplayOverrideReader` flags (GodMode/Fixed Catch active through injected production flags), nested
   set/reset/resetAll/import/export through `window.CYBER_FISHING_CONFIG_RUNTIME`, pagehide → 0 loops/listeners.
4. DEV: DevTools panel opens and an editor change reaches the override store and CONFIG; also open the fish/location
   diagnostics (overlay modules, location debug) and record that their text renders; pagehide, pagehide while
   startup is pending, and repeated restart → 0 then exactly 1 loop.
5. Inventory open/close, reload on both pages, saves byte-identical to the backup.
6. Zero console errors/warnings. Stop the server and close owned tabs.

Record `architecture/archive/stage6_closure_browser.json` with at least: `performer`, `performedBy: "automated"`,
`status`, `date`, `version`, the verbatim owner authorization from CLAUDE.md, `native`/`dev` sections with
`errors`/`warnings`, `originalSavesRestored`, `ownedTabsClosed`, `ownedServerStopped`, `ignoredFixturesRemoved`
(no fixture pages are needed; record `true` only if that is the fact). Probes stay transient in-page dynamic imports
of the same module URLs; no permanent API or global.

### C2 — Closure record `architecture/migration/stage_6_closure.json`

Model it on `architecture/migration/stage_5_closure.json` (same top-level shape where the fact exists). Required facts:

- `schemaVersion: 1`, `kind: "cyber-fishing-stage-6-closure"`, `status: "closed"`, `date`, `release: "0.27.0"`,
  `tag: "stage6-closed"`, `decision: "architecture/migration/stage_6/stage6_spec.md"`.
- `graphReview`: v5 path, version and SHA256 of its exact bytes.
- `modules`: all 96 `stage6_module_inventory.json` migration mappings `{source, target, status: "migrated"}` plus the
  four reuse replacements of preparation 005 (100 `nativeReplacements`), each matching prep005 exactly.
- `preparations`: ids 001–005 with their file paths and `verification.status === "accepted"`.
- `nativeDevelopment`: entry `src/entrypoints/dev.entry.js`, bootstrap `src/bootstrap/development/legacy_game_startup.js`,
  `developmentSource: "dev.html"`, `productionSource: "index.html"`, preparation 005 path, implementation commit
  `b2e8818…` (full hash), raw archive `{tag, tagObject, peeledCommit, parent}`.
- `addedFiles`: `src/entrypoints/dev.entry.js`, `utils/architecture/stage_six/native_development_archive.js`,
  `utils/architecture/stage_six/native_development_retirement.js` with one-line reasons; the prepared DEV targets are
  covered by the mappings.
- `retained`: historical retired provenance (activations 380) and the historical Stage 5 retained counts
  (bridges 53, activations 28, globals 852, debts 24) with the exact Stage 6 deltas to 0; `active` all zero.
- `nativeGraph` (production) and `nativeDevelopmentGraph` measured with `StageFourRelease#nativeGraph` (both entries).
- `metrics`: copy of release 001 `output.metrics`.
- `evidence`: game-cycle stdout SHA256 and the save SHA256 above (saved-byte and deterministic timing evidence).
- `stage5SourceCluster028`: preserved with null output/verification; native DEV successor is this stage.
- `clusters`: Stage 6 applied clusters (0 — Stage 6 worked through preparations) and `preparations: 5`;
  `boundaryToolDecision` (expected `"retain-current-guards"` unless C2b finds otherwise); `toolingArchive` from C2b.
- `verification`: `acceptance` / `quick` / `architecture` blocks exactly like Stage 5 (report path, `reportSha256`,
  `runId`, `source`, `catalog`, `totals`, timestamps) from the closure-snapshot runs of C4; `browser.report` → C1 file.
- `nextStage`: `"stage-7"` and the handoff path from C3.

### C2b — Utils closure analysis (refactor_Task §3, Stage 4 working rule 6)

Rule 6 requires every milestone closure to delete utils files unreachable from live entry points and forbids utils
growth across a milestone. Stage 6 grew utils from 216 files / 46,782 lines (v0.26.1) to 219 / 47,489 (HEAD
65fa993): `native_development_archive.js`, `native_development_retirement.js` and one M0–M3a file, plus check edits.

1. Compute reachability from the live entry points only: the 64-check catalog (`utils/testing/suites/check_manifest.js`),
   `package.json` scripts and `utils/dev-server.js`, following `require` edges. Reuse the Stage 5 closure method
   (`architecture/migration/stage_5/tooling_retirement_review.md`, `tooling_archive_candidates.json` /
   `tooling_archive_applied.json`); do not write a second scanner if the Stage 5 one is recoverable from
   `stage5-tools-archive`.
2. Files that are unreachable after the native cutover (for example classic-only loaders/resolvers no live check
   requires any more) are removed with exact-byte recovery under a new tag `stage6-tools-archive`, recorded in
   `architecture/migration/stage_6/tooling_archive_applied.json` and the closure `toolingArchive` block.
3. Reachable compatibility tooling that only validates history (builders, Stage 2/3 runtime fixtures) is NOT removed
   here: deleting a live check changes the 64-check catalog and is an owner decision recorded for Stage 7 (C3).
4. Report the net utils delta against v0.26.1. If it is still positive, record each added file with its reason and
   uses (every one must have at least two uses) in the closure record and flag it to the owner in the session
   summary; never delete reachable tooling or weaken a check to meet the budget.

### C3 — Stage 7 handoff `architecture/migration/stage_7_handoff.md`

Short English brief (like `stage_6_handoff.md`): resume facts, rules that carry over, and the Stage 7 queue taken from
continuation spec §9 and `refactor_Task.txt` §6, grouped as:

1. Deferred API/behavior-neutral transitions: compatible debuff getters, FlatInventoryItemRepository id fallback,
   ViewportProjector camera/world split (hot-loop evidence), `LocationMap.getDebugRevision` → `getRevision`,
   per-frame `currentDebugState` string → config-changed flag, "debug" diagnostics naming in FishForceSystem /
   TackleStressSystem, coverage/API review of BuffManager and the readiness/chum-bonus evaluators.
2. Infrastructure: repository portability (`.gitattributes`, one reviewed renormalization, fresh-clone hash proof,
   Windows-only fixtures; includes the 8 utils files whose mixed EOL was lost in M3b), package scripts
   (`struct`, archived `architecture:closure`, now-inert `build:legacy-bridges` / `build:stage-3-compat-runtime`)
   through the package-contract transition.
3. Native leftovers: archive the history-only compatibility tooling (`utils/build/compat_runtime/*`,
   `build_legacy_bridges.js`, Stage 2/3 runtime fixture checks) under a tag like Stage 3 — changes the 64-check
   catalog, owner decision; migrate tests off the deleted classic paths and then remove the test-only aliases in
   `NativeEsmTestLoader`; `legacy_*` names in canonical modules (rename transitions); consumer review of the
   unreachable DEV modules `src/dev/core/null_debug_runtime.js` and `src/dev/physics/physics_formula_map.js`;
   relocate `src/config/metadata/*.json` and `src/ui/styles/*.css`.
4. General hardening: decompose mixed-responsibility classes, finish engine/game/platform/dev separation,
   production hardening.

### C4 — Validator, suites, tag

1. Add `validateStageSixClosure` to `utils/architecture/stage-4-cluster-records-check.js` next to the Stage 5 block
   (no new check id; catalog stays 64, Quick 24, Architecture 32). It must prove: 100 mappings equal prep005
   `nativeReplacements` and the inventory; preparations 001–005 accepted; release record applied with
   `toRelease === closure.release`; report hashes and `source` blocks equal the archived reports; Full 64/64 with
   0 cached/failed/isolation violations and unchanged source; browser PASS with 0 errors/warnings on both pages;
   live registries/contract still zero; raw archive identity via `NativeDevelopmentRetirement.archive(...).verifyIdentity()`;
   graphs equal `StageFourRelease#nativeGraph` for both entries. Negative fixtures: drop one mapping, wrong release,
   altered report hash, an active bridge/activation, wrong archive commit, browser error count 1.
2. Sequence (never edit files while a suite runs): focused records check → `node utils/game-cycle-check.js` (stdout
   hash must equal §1) → Quick → Architecture → `git -c core.whitespace=cr-at-eol diff --check` → uncached
   `node utils/run-checks.js --acceptance --report <temp>/stage6-closure-full.json`. Archive the report as
   `architecture/archive/stage6_closure_acceptance.json`, then write `verification` into the closure record (same
   provenance note as Stage 5: the run precedes report archival and the verification edit).
3. Update docs: continuation spec §10 (all boxes), header status "Stage 6 closed"; `stage_6_handoff.md` pointer to
   the Stage 7 handoff; `refactor_Task.txt` (CRLF, keep CRLF): header bullets "Current Stage 6" → a
   "Stage 6 status: CLOSED — v0.27.0, tag stage6-closed, …" bullet in the style of Stages 3–5, "Next-chat execution
   brief" → the Stage 7 handoff, §5 status paragraph → CLOSED, the last Stage 6 checkbox "Final release/native graph
   counts…" ticked, and one closure log line; CLAUDE.md/CODEX.md resume points (local, never committed).
4. Commit the closure, push `develop`, create annotated `stage6-closed` on the closure commit
   (`git tag -a stage6-closed -m "CyberFishing Stage 6 closed - native development"`), push the tag.

### C5 — Post-closure cleanup (owner rule 2026-10-07: after every Stage closure)

Start only after the `stage6-closed` tag is pushed; the closure record stays immutable. Follow the Stage 5 precedent
(post-closure preparation 031, patch release v0.26.1, `stage5-dead-code-archive`,
`architecture/migration/stage_5/post_closure_cleanup_audit.md`).

1. Write `architecture/migration/stage_6/post_closure_cleanup_audit.md`: every candidate with its read/write/import
   sites (production, DEV, tests, checks, package scripts), the decision (remove / keep with reason / owner decision /
   Stage 7) and the evidence required. Known candidates:
   - 73 `typeof X !== "undefined"` guards in native `src` modules (e.g. `game_version_badge.js`,
     `game_composition_root.js`, `inventory_composition_root.js`, several `src/dev/*`). Remove only those whose `X`
     is an imported or local binding (always defined after ESM migration, precedent: Stage 4 removal of dead Domain
     guards); keep real browser-capability checks (`window`, `document`, `performance`) in Platform/DEV.
   - `src/dev/core/null_debug_runtime.js` and `src/dev/physics/physics_formula_map.js`: no import or reference in
     `src`/`utils` (2026-10-07 grep); confirm with both graphs and the Manifest, then remove with their Manifest entries.
   - Test-only classic path aliases in `utils/testing/runtime/native_esm_test_loader.js` (fed by preparation 005
     `nativeReplacements`): move each test consumer to the canonical path, then remove the alias mechanism; keep
     every assertion.
   - Utils files left unreachable after C2b, unused imports/exports and dead branches found while auditing.
   - Owner decision before removal (ask in chat with the exact list): history-only compatibility tooling and checks
     (`utils/build/compat_runtime/*`, `build_legacy_bridges.js`, Stage 2/3 runtime fixture checks — changes the
     64-check catalog) and the now-inert `build:*` package scripts (package contract transition).
   - Evidence-based optimization: the per-frame `currentDebugState` string built in `LocationMap.update()` (known
     hot-loop allocation; owner decision 2026-09-29: replace with a config-changed flag from the override store,
     behavior unchanged); re-measure hot-loop allocations/call counts with the existing hot-loop tooling and list any
     other proven churn. No optimization without before/after evidence.
   - Not in this cleanup (Stage 7): API renames (`getDebugRevision`, debug diagnostics naming, debuff getters),
     ViewportProjector split, folder relocation of `src/config/metadata` / `src/ui/styles`, EOL renormalization.
2. Apply as Stage 6 preparation 006 (existing preparation mechanism: `removedModules` with exact bytes/blobs,
   `files` before/after, `reason`), raw recovery tag `stage6-dead-code-archive` on a commit that holds the removed
   bytes. Remove the 72 empty local directories left by the cutover (untracked, filesystem only).
3. Verify: focused checks for every touched area, game-cycle hash unchanged, hot-loop evidence for any optimization,
   Quick 24/24, Architecture 32/32, uncached Full 64/64, actual-page browser smoke with save bytes unchanged.
4. Patch release 0.27.1 through the Stage 6 release contract (record `releases/002_*.json`, decision in the audit),
   commit, `v0.27.1` tag, push develop and both tags; update the Stage 7 handoff, `refactor_Task.txt` (CRLF) and
   resume points with the cleanup facts (files/lines removed, utils net delta).

## 3. Rules and pitfalls for this session

- Read CLAUDE.md "Development rules" and `DEVELOPMENT_RULES.md`; behavior preservation is absolute.
- Never weaken a guard, baseline, whitelist or fixture to make a check pass; no early returns, no self-comparisons.
- EOL: many files are mixed CRLF/LF and evidence hashes exact bytes. Edit with the Edit tool or byte-preserving
  node scripts; count CRLF with a node byte loop (Git Bash `grep $'\r'` reports 0 even for CRLF files). Never
  `git stash`, `git checkout -- f` or `sed -i` on CRLF files; restore with `git show HEAD:f > f` only for LF files.
- New JSON records: canonical `JSON.stringify(value, null, 2) + "\n"` (LF).
- `dist/` is intentionally absent; the builders report `retired-native-esm`. Do not recreate it.
- Utils growth needs a reason (ceiling 70,358); prefer adding the validator to the existing records check.
- Use the scratchpad for temporary scripts, backups and probes; keep the project tree clean before `--step tag`-style
  operations that require a clean status.

## 4. Done when

- [ ] `architecture/archive/stage6_closure_browser.json` PASS on 0.27.0, saves unchanged.
- [ ] `architecture/migration/stage_6_closure.json` complete and validated with negative fixtures.
- [ ] Utils closure analysis done: unreachable files archived under `stage6-tools-archive` (if any), net delta vs
      v0.26.1 recorded and any growth justified/flagged.
- [ ] `architecture/migration/stage_7_handoff.md` written.
- [ ] game-cycle hash unchanged; Quick 24/24, Architecture 32/32, uncached Full 64/64 on the closure snapshot.
- [ ] Docs updated; closure commit and `stage6-closed` tag pushed.
- [ ] Post-closure cleanup (C5): audit written, owner decisions asked, preparation 006 applied with
      `stage6-dead-code-archive`, all suites/browser green, release v0.27.1 tagged and pushed.

If the session runs short, stop after a pushed `stage6-closed` and leave C5 as the next session's first task —
never start C5 before the closure tag exists.
