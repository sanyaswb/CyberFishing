# Utils rules

Read this file before adding, changing, moving or deleting a tool or test. The owner's instructions take precedence.

## Purpose

Automate failures that are hard to reproduce by hand: equipment combinations, inventory transactions, casting,
fishing states, catches/losses, saves/migrations, input/cancellation, async failures and resource disposal.
Use fixed seeds, clocks and explicit scenarios. Never depend on luck, real waiting or a live service.

Before adding a test, name the failure it catches and why an existing scenario does not already cover it.
Extend the relevant scenario first. A unit test and an integration test may coexist when they protect different contracts.

Keep assertions about observable behavior: commands, authoritative state, values, persistence, accessibility/input,
bounded work and cleanup. Use boundary cases and meaningful combinations instead of repeating similar builds.
Do not reproduce a production formula in the test merely to compare two copies of it.

Visual acceptance belongs to the owner. Do not pin pixels, spacing, colors, radii, CSS declaration order, exact
class strings, illustration placement, font metrics or markup structure merely to preserve appearance.
DOM classes/structure may be used to find controls; assert what those controls do. A small CSS contract is justified
only when it prevents an input/scrolling failure that the DOM double cannot exercise, not a visual preference.
Keep architecture/import, asset-integrity and source-safety guards separate from visual assertions.

## Layout

| Location | Responsibility |
| --- | --- |
| `utils/*.js` | User-facing commands: runner, dev server, release, assets, cleanup, version and structure tools |
| `checks/architecture/` | Syntax, dependency boundaries and shared CSS ownership/safety |
| `checks/gameplay/` | Deterministic game scenarios and mechanics |
| `checks/inventory/` | Equipment, transactions, hydration, saves and migrations |
| `checks/items/` | Item stats, rarity, progression, condition and consumables |
| `checks/ui/` | Actions, gestures, accessibility, input state and lifecycle |
| `checks/platform/` | Browser adapters, rendering runtime, loading, config and performance contracts |
| `checks/tooling/` | Release, cleanup and DEV tooling behavior |
| `testing/` | Shared doubles, runtime compositions, baselines and the check manifest |
| `tmp/`, `generated/` | Disposable task artifacts; follow the workspace cleanup rules |

Keep check IDs stable. Register every check exactly once in `testing/suites/check_manifest.js`.
`npm run struct` describes only the production release rooted at `index.html`: reachable modules, linked styles,
shipped assets and vendor licences. Reuse release selection; development pages, tools, tests and documentation do
not belong in `project-structure.txt`. It reads current Git-tracked working files; stage new production files first.
Prefer `node utils/run-checks.js --check ID` over a hard-coded test path. Reuse existing helpers; no compatibility
wrappers, duplicate runners or general testing framework for one scenario. Production must never import utils.

## Efficient workflow

1. Inspect the relevant existing scenario and consumers. For a bug, reproduce the important failure deterministically.
2. Run the affected check while iterating. Use `npm run check:quick` for a small cross-system smoke set when useful.
3. Before delivery run `npm run check` once. It includes the Quick and Architecture checks; do not run the same
   suites again against unchanged code. Rerun only for a failure, subsequent change or unresolved concern.
4. Do not change baselines or weaken guards to hide a regression. The game-cycle baseline changes only for an
   explicitly intended gameplay change with its documented reason.
5. Remove replaced assertions and helpers with no remaining consumer. Preserve useful simulations when pruning
   visual checks. The owner has authorized this audit's removal of visual/duplicate implementation assertions.
6. Keep success output short. On failure identify the scenario and expected behavior. Never retain verbose logs
   without a current diagnostic purpose; run `npm run clean:artifacts` when creating task artifacts.

Do not add a regression test for every reversible visual edit. Ask whether the test would catch broken behavior
or simply require another edit when the owner changes the design. Only the first justifies automated coverage.
