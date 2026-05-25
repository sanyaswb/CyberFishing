# CyberFishing changelog

## v0.18.6 — stamina weight scaling

- Changed fish stamina to scale from `baseStamina + weightKg * 1000 * level`.
- Removed stamina dependence on fish force `basePower` and `levelBasePower`.
- Added `staminaBossMultiplier` support for last-level fish below their level average weight.
- Passed level average weight into fight setup for generated and fixed debug catches.
- Added fight-system checks for weight/level stamina scaling and boss stamina multiplier.

## v0.18.5 — debug overlay simplification

- Renamed `overlay_devtools_links.js` to `overlay_metric_inspector.js`.
- Removed the unused `overlay_devtools_links_focus_patch.js` file.
- Rendered fight-physics metric buttons directly from `overlay.js` instead of post-render DOM decoration.
- Removed overlay metric `MutationObserver` and global inline-style DOM scans.
- Added semantic debug overlay row/label/value classes and scoped metric button event handling.
- Added overlay HTML caching and configurable `CONFIG.debug.overlayUpdateMs`.

## v0.18.4 — overlay desktop click fix

- Integrated the desktop hover/click fix directly into `overlay_devtools_links.js`.
- Overlay metric buttons now inspect on `pointerdown`, so frequent overlay redraws cannot swallow the click.
- Removed hover style changes that caused visual flicker under the mouse cursor.
- Increased the button hit area to a stable 14x14 square without changing overlay layout.

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
