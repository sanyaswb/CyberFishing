# CyberFishing changelog

## v0.18.7 — stamina endurance split

- Split fish condition resources into separate `maxStamina` and `maxEndurance` values.
- Kept endurance on the weight/level formula and derived stamina as `endurance * staminaRatioFromEndurance`.
- Added `CONFIG.stamina.fish.staminaRatioFromEndurance = 0.1`.
- Updated fight force, stamina controller, renderer and debug console reads to use separate stamina/endurance maxima.

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
