# CyberFishing changelog

## v0.18.0 — scaling configs

- Split `FISH_DB` into fish category files while preserving the public `FISH_DB` global.
- Added reusable fish physics presets and profile factory helpers.
- Added runtime config override store, export/import/reset support and immutable `BASE_CONFIG`.
- Routed DevTools CONFIG edits through runtime overrides instead of mutating the base config.
- Replaced vague passive retrieve naming with `passiveRetrievePowerRatio`.
- Removed `Infinity` from item config in favor of explicit open-ended ranges.
- Added fish DB structure and config override checks.

## v0.17.5 — architecture cleanup

- Split fight physics math into dedicated calculator classes.
- Added explicit FightPhysicsPipeline frame order for fight updates.
- Routed FishForceSystem, FishPullResistanceModel and TensionSystem through calculators.
- Started removing temporary fish physics compatibility aliases from runtime reads.

## v0.17.4 — safe balance

- Added project version source of truth and in-game version badge.
- Added config schema validation utility.
- Added headless balance simulator utility.
- Added physics units and naming convention documentation.

## v0.17.3 — physics transparency

- Added physics formula map.
- Grouped debug overlay by cause/effect blocks.
- Added golden tests for key formulas.
