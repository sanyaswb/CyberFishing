# Behavior-first utils audit

Owner request, 2026-10-20: remove unnecessary visual tests, keep meaningful functional simulations, organize utils
and establish UTILS_RULES.md. This is explicit authorization to prune visual assertions; gameplay and guards stay intact.

## Target and inspected consumers

The check runner and package scripts use the central manifest. Tests import shared `testing/` helpers and production
modules; some resolve the workspace from `__dirname`. Documentation and the game-cycle baseline command also reference
test paths. Keep root commands and check IDs, move check files into the responsibility folders documented in
utils/UTILS_RULES.md, and update every consumer/path. No compatibility wrappers or production changes.

## Removal decisions

- Remove inventory's CSS visual-contract block and duplicate source-spelling/class-export/factory assertions.
  Preserve its runtime actions, selection, scrolling, timing, invalid input, DOM identity and disposal scenarios,
  plus text-rendering safety and the small touch-axis contracts needed for real input.
- Remove House's CSS frame/padding/background/cover arithmetic and exact glyph centering expectations.
- Remove catalog's exact preview-width list/style-prefix equality and profiler bar-color expectations.
  Keep catalog isolation, controls, missing assets, frame scheduling and profiler measurements.
- Retain all functional check entries, deterministic gameplay/equipment/save scenarios, architecture/CSS safety
  guards, render/input coordinate contracts and the unchanged game-cycle baseline.
- Narrow Quick to essential smoke checks; Full remains the complete registry. One final Full run covers its subsets.

## Acceptance and cleanup

Every registered file exists once, is discoverable recursively and can run by its stable ID. Relative imports,
workspace roots, package commands and documentation resolve after moving. Full passes with the same game-cycle
baseline. No production behavior, save bytes or assets change. Owner handles visual acceptance; no browser inspection.

Delete unused inventory source-reader methods/constants and decorative CSS scanning from component checks.
The shared stylesheet reader remains consumed by CSS safety and input-axis checks. No vendor package, shared fixture,
package script or dependency is removed without proving its remaining consumers. Retain unrelated local helpers.

Audit result: removed 233 visual/duplicate implementation assertions and 1,492 lines across inventory UI, House,
shared UI, catalogue, profiler, palette snapshots, decorative item frames and scene placement checks. All 65 registered functional scenarios remain;
Quick is reduced from 39 to 12. Check files occupy seven responsibility folders; root commands and IDs are stable.

Validation: final Full 65/65 passed after the additional decorative-assertion sweep. Registry IDs and unique paths
were verified, all check files parse, and the game-cycle baseline is byte-identical. No browser visual check performed.
