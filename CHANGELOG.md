# CyberFishing changelog

## v0.18.3 — overlay console formulas

- Simplified overlay metric buttons: they now print formula details to the browser console instead of trying to control DevTools DOM focus.
- Added console tables with influencing `CONFIG.*` and `HOOKED_FISH.*` paths plus current runtime values.
- Kept the small overlay square buttons, but removed the fragile DevTools navigation behavior from the bridge.

## v0.18.2 — clean overlay DevTools paths

- Added stable `data-devtools-path` attributes to DevTools sections, rows and labels.
- Updated overlay link navigation to focus exact DevTools paths first instead of relying on truncated labels.
- Removed the need for the runtime `overlay_devtools_links_focus_patch.js` workaround.

## v0.18.1 — overlay DevTools links

- Added small overlay link buttons before supported debug metric labels.
- Buttons open DevTools and focus the related config/runtime parameter.
- Metrics with multiple influencing parameters cycle through those paths on repeated clicks.
- Focused DevTools rows pulse with a white highlight to guide the developer's eye.

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
