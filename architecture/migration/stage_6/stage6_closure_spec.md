# Stage 6 — closure specification (next session)

Written: 2026-10-07 (Europe/Kiev). Goal of the session: close Stage 6 in full and hand off to Stage 7. Everything below is
closure work only; no gameplay, formula, save, API, timing or hot-loop change is in scope.

## 1. Resume state (verify first)

- `git status` must show a clean tree (CODEX.md and CLAUDE.md are excluded locally). HEAD and `origin/develop` =
  the commit that adds this file, on top of `65fa993` (release 0.27.0).
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
- `verification`: `acceptance` / `quick` / `architecture` blocks exactly like Stage 5 (report path, `reportSha256`,
  `runId`, `source`, `catalog`, `totals`, timestamps) from the closure-snapshot runs of C4; `browser.report` → C1 file.
- `nextStage`: `"stage-7"` and the handoff path from C3.

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
   the Stage 7 handoff; `refactor_Task.txt` Stage 6 checkboxes (lines starting "Complete exact successor…" through
   "Final release/native graph counts…") and one closure log line — the file is CRLF, keep CRLF; CLAUDE.md/CODEX.md
   resume points (local, never committed).
4. Commit the closure, push `develop`, create annotated `stage6-closed` on the closure commit
   (`git tag -a stage6-closed -m "CyberFishing Stage 6 closed - native development"`), push the tag.

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
- [ ] `architecture/migration/stage_7_handoff.md` written.
- [ ] game-cycle hash unchanged; Quick 24/24, Architecture 32/32, uncached Full 64/64 on the closure snapshot.
- [ ] Docs updated; closure commit and `stage6-closed` tag pushed.
