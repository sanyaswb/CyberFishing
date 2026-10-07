# Stage 6 post-closure cleanup audit (closure spec C5)

Written: 2026-10-07 (Europe/Kiev). Base: release 0.27.0, tag `stage6-closed`, commit `f96c17b5e41f2d175159c71f779752dc57782d71`.
This is a later cleanup, not a rewrite of the Stage 6 closure. It is applied as Stage 6 preparation 006 with the raw recovery tag
`stage6-dead-code-archive` and patch release 0.27.1. Owner rule 2026-10-07 (DEVELOPMENT_RULES.md): remove only what has reachability and
consumer proof, keep exact-byte recovery, optimize only with before/after evidence.

## Owner decisions (2026-10-07, in chat)

- Remove the inert package scripts `build:legacy-bridges` and `build:stage-3-compat-runtime`: approved.
- Remove `architecture:closure` (its target `utils/architecture/stage-1-closure-check.js` was archived in Stage 4 M1): approved, it does not
  affect the game.
- Archive the history-only compatibility tooling and checks (changes the 64-check catalog) as a separate first Stage 7 step, not in this
  cleanup: approved as recommended.

## Candidates and decisions

| # | Candidate | Measured facts | Decision |
| --- | --- | --- | --- |
| 1 | Package scripts `build:legacy-bridges`, `build:stage-3-compat-runtime`, `architecture:closure` | Both builders report `retired-native-esm` with 0 outputs; `architecture:closure` names a missing file. The builders stay reachable through `utils/dev-server.js` and `stage_four/cluster_path.js`, so their files stay until the Stage 7 archive. `RootPackageValidator` requires the exact `build:legacy-bridges` script; `verify-fresh-package-install.js` already runs the cumulative build only when its script exists. | Remove (owner). Qualify the package gate: when `stage.bridgeBuild.status` is `retired-native-esm`, the three scripts must be absent and every `node <file>` script target must exist; negative fixtures for a restored script and a dangling target. `struct` stays (separate deferred owner decision). |
| 2 | 73 `typeof X` guards where `X` is an ESM import, in 28 native `src` files | eslint-scope resolution of all 367 `typeof` uses: 188 parameters, 82 locals, 24 real globals (`window`, `document`, `performance`, `AbortController`, `fetch`, `CustomEvent`, `Image`, `OffscreenCanvas`, `structuredClone`), 73 import bindings. Every imported binding is an exported class (44) or a `const` initialized with `Object.freeze(...)`, an array/object literal or an IIFE returning a frozen object (29): never `undefined` at use time; a TDZ binding would throw on `typeof` too, so no guard ever protected anything. | Remove all 73 (precedent: 22 dead Domain guards removed before Stage 4). Rewrite only the guard: `typeof X !== "undefined" ? X : fallback` → `X`; `typeof X !== "undefined" && e` → `e`; dead `if (typeof X === "undefined")` blocks and `typeof X === "undefined" ||` disjuncts are removed. Keep the 24 global capability checks. Evidence: focused checks of every touched area, game-cycle stdout SHA256, Quick/Architecture/Full, both-page browser smoke; the removed expressions are allocation-free comparisons. |
| 3 | `src/dev/core/null_debug_runtime.js`, `src/dev/physics/physics_formula_map.js` | No import or reference in `src`/`utils`; absent from both authored graphs (production 350, DEV 446 of 97 DEV files = 95 reachable). They are targets of two of the 96 Stage 6 mappings, so `NativeDevelopmentRetirement` requires every preparation 005 target to exist. | Remove both with their Manifest entries. Qualify the successor: a preparation 005 target may be absent only when an accepted Stage 6 post-closure cleanup removes it with exact recovery bytes; negative fixture for an unrecorded missing target. The closure record stays immutable. |
| 4 | Test-only classic path aliases in `utils/testing/runtime/native_esm_test_loader.js` | Measured with a catalog-wide probe (all 64 checks pass): 30 checks resolve 333 unique classic paths (697 check/path pairs), including 114 hard-coded in `game-cycle-check.js`. The alias table is built from the compatibility runtime contract, the compatibility-bridge Manifest roles, the Stage 6 inventory and the preparation 005 replacements. | Defer to the first Stage 7 step together with the compatibility tooling archive: the alias source is the same history that step decouples, and editing the game-cycle load list twice would risk its stdout pin twice. No change here. |
| 5 | Per-frame `currentDebugState` string in `LocationMap.update()` (`src/game/domain/locations/location_world.js:402`) | One template string of seven location flags is built every frame to detect a debug-flag change; the change bumps `getDebugRevision()` and recalculates zones. | Owner decision needed: the 2026-09-29 design (a config-changed flag from the override store) injects a new port into a Domain hot path through Bootstrap; an equivalent allocation-free alternative keeps the seven last values in private fields and compares them per field. Not applied until decided. |
| 6 | Unreachable utils | C2b: all 219 utils files reachable from 84 live roots; no `stage6-tools-archive`. | Nothing to remove. |
| 7 | Empty local directories | 71 empty leaf directories under `src` left by the classic retirement (untracked). `src/.tmp.driveupload` (external sync tool, May 2026) and the five empty `utils`/`architecture` directories predate or are unrelated to the cutover. | Remove them (filesystem only, nothing to recover): 85 in total with the parents they emptied and `src/dev/physics`. Keep the others. |

## Execution (preparation 006)

- Raw recovery: annotated `stage6-dead-code-archive` → `9c34026c3eabd0feee2febfdd75589d4bd52142c` (parent `stage6-closed`), 34 exact
  working-byte blobs (mixed EOL) of every changed or removed file whose bytes differ from the normalized base tree; LF-only files are their
  base blobs. Preparation 006 records 36 changed files (before/after SHA256 with reasons) and the 2 removed modules.
- Guard successors: the cleanup ledger validates the Stage 6 post-closure record (exact recovery tag and decision, no retired surfaces, exact
  changed files); the records gate checks the `stage6-closed` base, the archive identity and every changed-file recovery hash, and accepts
  the bytes the Stage 5 cleanup pinned in `legacy_inventory_system.js` only through this exact recorded before/after chain; the immutable
  Stage 6 closure keeps validating only its own preparations 001–005. `NativeDevelopmentRetirement` accepts an absent preparation 005
  target only with an exact later post-closure removal (three fixtures), and the DEV display parity check loads every other DEV target and
  asserts the removed ones are gone. The package gate requires the three retired scripts to be absent and every `node` script target to
  exist (two fixtures).
- 73 guards removed in 28 files; `typeof` uses 367 → 294 (parameters 188, locals 82, real globals 24 unchanged). Game-cycle stdout SHA256
  unchanged; all 64 checks pass before the release projection.

## Not in this cleanup (Stage 7)

API renames (`getDebugRevision`, production "debug" diagnostics naming, debuff getters), ViewportProjector split, relocation of
`src/config/metadata` / `src/ui/styles`, EOL renormalization, `legacy_*` names, the compatibility tooling archive and item 4.
The two pre-existing defects recorded at closure (fixed-catch active-lure bite sequence, depth-selector dispose/frame race) are gameplay /
lifecycle changes and need their own owner decision.

## Acceptance

Focused checks for every touched area, unchanged game-cycle stdout SHA256
`0db62de21427af5589fa5294b53dd833522298356d1d6b7a6ce0a009f2782c6f`, Quick 24/24, Architecture 32/32, uncached Full 64/64 on one snapshot,
built-in browser smoke of `index.html` and `dev.html` with saves byte-identical. Then release 002 (0.27.0 → 0.27.1) through the Stage 6
release contract.

Executed result: all gates PASS on one snapshot `146f587b24891ddd2e6fc1867fcd7e809bd12d61d5445b7324d02a19da602442` (Quick 24/24, Architecture 32/32, uncached Full 64/64 `architecture/archive/stage6_006_post-closure-cleanup_acceptance.json`); game-cycle unchanged; browser PASS on 0.27.1 (`architecture/archive/stage6_006_post-closure-cleanup_browser.json`). Release 002 0.27.0 → 0.27.1 applied. Item 5 (LocationMap) awaits the owner decision.
