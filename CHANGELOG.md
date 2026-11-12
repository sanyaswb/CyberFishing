# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.50.76 - Faster full check

- TK-272: the Pages release check reads each page's stylesheets from git in one batch instead of once per pair (about 2,600 git calls); it takes about 13 s instead of 95 s, and a full check run about 18 s instead of 100 s. It checks the same things.

## v0.50.75 - Procedural rain

- Spec 172 stage D iteration 1 (TK-271): it rains on the location: thin drops fall at the wind's slant, smaller and slower far away, as many as the rain and storm are strong; drops on the water leave rings and small ripples. DevTools «🌦 ПОГОДА» switches rain, storm and fog on with live strength, holds the wind's direction and tunes the rain's look.

## v0.50.74 - Water glints removed

- TK-270.1 (owner): the water glints of v0.50.73 are removed (their look did not fit; another approach later). The scene keeps Pixi's particle container for the coming rain.

## v0.50.73 - Glints on the water

- Spec 172 stage B (TK-270): the water sparkles on its wave crests: over all the water by day, in a path under the sun at sunrise and sunset and under the moon at night (the path widens toward the viewer); clouds and fog dim them. Tuned live in DevTools (water → glints); the sun and moon positions are in the location's sky settings.

## v0.50.72 - Pack item quantities in default starting inventory

- TK-269.1: starting inventory packs now populate with their configured pack quantities (e.g. 50 oil worms, 25 bread, 15 chum mix, 100/75/50/25/10 variants) instead of flat 1s, with single items remaining 1 each and 1 bait attached to the equipped hook.

## v0.50.71 - Default night, bamboo float tackle equipped, full inventory, HUD button strokes

- TK-269: default start time set to night (00:00); bamboo float rod, line, hook with oil worm, float and net equipped by default; starting inventory contains all 40 game items (1 of each); clock shadow removed; HUD and selector button borders normalized to match game-version-badge (1px solid rgba(var(--ui-accent-rgb), 0.35)).

## v0.50.70 - GodMode infinite cast distance across any equipment

- TK-268: GodMode infiniteCasting enables casting to any distance across the entire water map with any equipped tackle (pole, match, feeder, spinning), without tackle or line constraints restricting aim reach.

## v0.50.69 - Direct pixel depth reading without grid stepping

- TK-266.1: float, feeder and tackle read exact bottom depth directly from DepthMapReader at their continuous (x, y) coordinates without 40px grid stepping, while grid cells retain fixed central depths for DevTools and zone overview.

## v0.50.68 - Depth map reader non-linear calibration

- TK-266: depth map reader calibrated with non-linear piecewise interpolation matching the owner's exact color-to-depth control points (0.1m at rgb(254), 0.5m at rgb(217), 1.0m at rgb(147), 5.0m at rgb(54), 7.5m at rgb(35), 15.0m at rgb(10)), eliminating harsh depth transitions near the shore.

## v0.50.67 - Hand chum throw zone dimming and selector input isolation

- TK-267: hand chum throw zone dims unreachable water above the limit line (matching float depth limit); inventory selector neighbouring buttons are hidden with isolated pointer events and touch dragging is guarded against native screen scrolling.
