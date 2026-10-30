# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.49.14 - Procedural bait boat wake

- Delivery / Scene: a running boat leaves a procedural foam wake — puffs along both Kelvin arms (19.5°) that spread, grow and fade, smaller on far water — drawn as pooled sprites of one generated foam texture under the boat (2D fallback: translucent dots); the Spine `boats-wave--1` slot is off (spec 155).
- Tuning lives in `CONFIG.ui.boat.wake` (DevTools → SPINE → «Кораблик»). Game-cycle report unchanged.

## v0.49.13 - Inertial bait boat motion test switch

- DEV / Delivery: `CONFIG.ui.boat.inertialMotion` (DevTools → SPINE → «Кораблик») switches the boat to the catalog's inertial preset — 3 m/s² thrust, a quarter of the turn rate at rest, softer drag and more side-slip; off keeps the agile motion unchanged (spec 154 C). Game-cycle report unchanged.

## v0.49.12 - DEV bait boat route display

- DEV: DevTools → «РЕДАКТОР» → «Маршрут кораблика» draws the boat's planned route as a dashed line on the WebGL scene and the 2D fallback; production never shows it (spec 154 Q3). Game-cycle report unchanged.

## v0.49.11 - Bait boat route planning

- Delivery / AI: each boat leg is planned on the current map (passability at half a map cell, rebuilt on map edits; A* with string pulling, off the shore); the boat follows the route, rays stay only as a fallback, and a leg without progress replans and finally comes home with its cargo (spec 154 / G-127).
- Delivery / AI: a target in water the boat cannot reach is refused like an invalid cast; drag and side-slip damping are per second, so 30/60/144 Hz move alike (144 Hz was 28% slower). Game-cycle report unchanged.

## v0.49.10 - Bait boat Spine review

- Delivery / Spine: the boat waits for the export's clip lengths (`BOAT_ANIMATION_DURATIONS`, checked against `boat-lvl--3.json`; bunkers 2-3 open for 1.583 s, not 1.167 s); the end of the start clip no longer restarts an opening door; a reloaded start continues as motion; a drained boat drifts without the motor clip, wake or lights (TK-160).
- Delivery / Spine: bait, light, wake slots and held doors are written into the skeleton only when they change; the obsolete skeleton rewrite, the `returning` branch and the unused reduced-motion port are removed. Game-cycle report unchanged.

## v0.49.9 - Drained bait boat recovery by net or mooring

- Delivery: a drained boat drifts with the current; the landing net button takes it back inside the net's reach (outside the fight), and it is taken back automatically when it moors within `recovery.mooringMeters` (1 m) of the player's shore; the 40/200 px tap removal is gone (spec 151 / G-124).
- Delivery: bunker chum is spent when its bunker opens, so a recovered boat keeps its undropped cargo; while a boat is on the water the inventory rolls back any change to it, its battery or cargo; a launched boat is saved and restored after a reload; boats move on the map's water, not the visible screen. Game-cycle report unchanged.

## v0.49.8 - Chum spots by game time, merge and overfeeding

- Chum: zones now read the chum's effective stats; before, production zones had no bite bonus and never expired (spec 152 B4). Spots live by the game clock's monotonic time (DEV acceleration and phase jumps count), appear only when the chum reaches the water (boat: when the bunker opens), and drops of one chum merge into one spot with averaged age and centre (G-125).
- Chum: each drop adds feed eaten at `feed.eatenPerHour`; above `comfortLoad` the bonus falls to `overfedMultiplier` at `maxLoad` (carp mix: 0.25/h, 1.5, 4, 0.8). Old saves migrate (delivered zones keep their age, undelivered ones are dropped). Game-cycle report unchanged.

## v0.49.7 - Bait boat bunker count from one source

- Delivery: `BoatRules.sectionCount` is the only reading of a boat's `sections` (the property its cargo slot capacity reads); `BaitBoat`, `ChumController` and the inventory boat artwork use it instead of `?? 1` / `|| 3` / `|| 1` defaults (TK-156).
- An item without a positive integer `sections` carries no bunkers. Game-cycle report unchanged.

## v0.49.6 - Unused chum memory grid removed

- Chum: `ChumService` no longer writes or saves the per-location chum memory grid (`chum_memory_<location>`); nothing read it (TK-155). Game-cycle report unchanged.

## v0.49.5 - Bamboo bread bait stacks (10, 25, 50 pcs), WebP artwork, and DEV free shop entries

- Bait / Items: added discrete bamboo bread stack catalog items (`bread_10`, `bread_25`, `bread_50`) with WebP artwork (`bread--10.webp`, `bread--25.webp`, `bread--50.webp`), pack sizes (10, 25, 50 pcs), nominal grant quantities, and natural bait progression profiles (TK-154).
- Inventory / Config: updated default player inventory bread quantity to 25 pcs and replaced emoji glyph with WebP artwork for generic `bread` while excluding it from duplicate shop listings (`devExclude: true`) (TK-154).
- Fish / DEV: enabled peaceful fish bite multipliers (1.0) for all bread stack sizes, and exposed 3 discrete free shop buttons granting their nominal stack amounts in DevTools (TK-154).
