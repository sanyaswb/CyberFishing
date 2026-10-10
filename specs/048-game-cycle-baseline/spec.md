# Feature Specification: Tracked game-cycle baseline

**Created**: 2026-10-10 · **Status**: Implemented · **Kind**: test tooling (start of gameplay work)

## Problem (verified)
The game-cycle check is the behavior reference, but its expected output existed only as a SHA256 written in specs and
compared by hand (`7b9baea3…ed5b6`). Structural work needs the output unchanged, which a digest proves. Gameplay fixes
change behavior on purpose: a new digest alone does not show *what* changed, and nothing failed when the output drifted.

## Solution
- `utils/testing/baselines/game-cycle.txt` holds the expected stdout (216 lines, byte-identical to the stdout of
  `9107e9a5`…`2d2af77e`).
- `utils/testing/core/output_baseline.js` (`OutputBaseline`) compares the report with the file and fails with the first
  differing line.
- `game-cycle-check.js` builds the same report lines, writes them to stdout unchanged and verifies them against the
  baseline.
- `npm run baseline:game-cycle` (`--update-baseline`) rewrites the file. A re-baseline is a reviewed diff of that file
  in the gameplay commit. The check runner never writes it.

## Evidence
- Game-cycle stdout digest unchanged `7b9baea3…ed5b6` (same bytes, now also equal to the tracked file).
- A mismatch reports the first differing line (exercised on a scratch file: changed line, added line).
- Architecture 2/2, Quick 13/13, Full 39/39.
- No browser smoke: test tooling only, nothing the pages load.
