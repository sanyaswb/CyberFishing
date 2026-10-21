# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.45.43 - Simple Illustrated Water Perspective

- G-112 / spec 126: replace camera distance and overhead reference with exact water length, artistic tilt and a far-size ratio. Defaults: 30 m, 30 degrees, 0.3. Preserve full grid/water bounds and exact aim metres; one metric owns surface sizing and matching chum containment. Remove the camera-ray diagram and obsolete controls; optional grid-width contraction defaults off. Full 65/65, including Quick/Architecture; game-cycle baseline unchanged. Owner visual/phone acceptance pending.

## v0.45.42 - Stable Water Width Across Camera Angles

- G-111: remove camera-driven X zoom and default lateral expansion off. Parallel-X chum widths stay stable across tilt edits; the green zone, metre grid and animated water retain their full authored bounds/height. Tilt warps internal spacing and visible metres; DEV distinguishes overhead reference length from actual far distance. Add near/far rays and their shaded sector from the shared metric; overhead rays are parallel at 90°. Full 65/65, including Quick/Architecture; game-cycle baseline unchanged. Owner visual/phone acceptance pending.

## v0.45.41 - Unified Water Plane Projection

- G-110: one fitted camera projection for metres, movement, sprites, waves, chum and landing contours. Overhead water stays uniform and circular; authored bounds/length and the 50 px/m engine unit are preserved. DEV exposes camera tilt/distance and fitted scale; ground chum influence retains save format and timing. Full 65/65, including Quick/Architecture; game-cycle baseline unchanged. Owner visual/phone acceptance pending.

## v0.45.40 - DEV Zone Editor Camera Tilt Diagram

- Add toggleable schematic SVG diagram visualizing camera view angle, tilt arc/right-angle marker and water distance ruler in DevTools zone editor under perspective controls. Full: 65/65, including diagram builder regressions, Quick and Architecture. Owner acceptance pending.

## v0.45.39 - Configurable Water Metric Lateral Expansion

- Add lateralExpansion parameter to location distanceProfile and DEV zone editor to toggle cone-shaped lateral perspective expansion on the water plane. When disabled, transverse scale remains uniform (50 px = 1 m) while depth compression is preserved. Full: 65/65, including water metric and zone editor regressions, Quick and Architecture. Owner acceptance pending.

## v0.45.38 - Inventory Hold Recognition Delay

- Restore a shared 300ms recognition delay before every inventory cell's 200ms hold countdown (500ms total). Keep progress hidden and avoid animation frames during recognition; preserve short clicks, movement/cancel and the separate green-pick cancellation. Full: 65/65, including focused UI/platform, Quick and Architecture. Owner timing acceptance pending.

## v0.45.37 - Stable Inventory Selector Startup

- TK-014: pending selector artwork incorrectly enabled classic backpack/keepnet shortcuts before radial readiness. Separate pending, ready and failed preload so radial startup never flashes classic controls; preserve explicit classic mode, failure fallback and disposal. Committed release Full: 65/65 including selector regressions, Architecture, Quick and Pages; the pick-cancel controller is included. Owner startup acceptance pending.

## v0.45.36 - Uniform Inventory Hold Speed

- Apply 200ms holds from pointerdown to all inventory cells: backpack, saved kits, equipment, editor and header bait. Remove the activation delay through shared defaults; preserve existing cell actions, cancellation and click suppression. Full: 64/65, including UI/platform, Architecture and Quick; Pages still requires the prior uncommitted pick-cancel controller. Owner acceptance pending.

## v0.45.35 - Header Bait Hold Ring

- Restore animated header bait hold feedback as a thin ring without a shadow. Remove bait at 200ms from pointerdown with no activation delay; preserve cancellation, release-click suppression, artwork refresh and other item timings. Full: 64/65, including UI/platform, Architecture and Quick; Pages still requires the prior uncommitted pick-cancel controller. Owner visual acceptance pending.

## v0.45.34 - Quick Tackle Attachment State

- Fix TK-011 acceptance: repeated equipment-cell picks initialize/prepare attachment-capable roots, so an equipped hook immediately accepts bait and a feeder rig accepts chum. Header activation repairs a previously saved loose equipped root missing that state without changing its identity or save format. Cover single/stack hooks, both list layouts, chum, repaired reload and persistence rollback. Owner acceptance pending.
- Hold an equipped bait header icon to return its portion to the backpack using normal equipped-item timing. Preserve hook/siblings/A, cancel stale holds and consume the release click across slot updates; active green targets retain 200ms pick cancellation. Full: 64/65; the prior uncommitted pick-cancel controller still blocks Pages.
