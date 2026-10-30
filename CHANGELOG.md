# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.49.4 - Bait boat immersion Spine animation replay on re-aiming, track 0 clearing, and completed clip restart

- Delivery / Spine: updated `SpineScene.prototype.setAnimation` to allow completed one-shot animations (`isComplete() === true`) to replay from 0 rather than being blocked by early equality return, and ensured `clearTrack` cleans entries immediately via `state.clearTrack` when `mixSec <= 0` (Spec 150 / TK-153).
- Delivery / Animation: cleared track 0 alongside compartment tracks 1..3 (`for (let track = 0; track <= 3; track++) scene.clearTrack(track, 0)`) in `BoatAnimationController` on boat change, and reset `currentClip` to empty on idle, guaranteeing reliable `boat3--immersion` replay whenever aiming is cancelled and restarted (TK-153).

## v0.49.3 - Radio battery empty feedback, warning notice, red HUD indicator, and VOLIA playback resume

- Radio / Inventory: clicking power without a charged battery scrolls to the battery socket, flashes it in red error feedback (`inventory-equipment-feedback--error`), and displays the warning notice «Без енергії діла не буде» (Spec 142 / TK-152).
- Radio / HUD: styled depleted battery state (`hud-indicator--empty`) with red circle border alongside red icon; clicking the indicator opens the radio editor with battery feedback and warning (TK-152).
- Radio / VOLIA 77.2: implemented non-destructive stream player pause and resume on page visibility changes, resuming VOLIA playback from the exact paused position without cue or restart (TK-152).

## v0.49.2 - Red border and dark-red background warning state for empty bait boat button

- Fishing / HUD: styled empty bait boat toolbar button (`chum-control--boat-empty`) with high-visibility red border (`var(--ui-danger, #ff4444)`) and dark-red background (`rgb(117, 23, 6)`), ensuring unambiguous visual indication when chum runs out while keeping the button active and clickable (Spec 150 / TK-151).

## v0.49.1 - Active empty bait boat launch button with editor opening and compartment feedback

- Fishing / HUD: kept bait boat toolbar launch button active when compartments are empty with `boat-lvl--3_no-bait.webp` artwork, clickable cursor, and non-blocking interaction (Spec 150 / TK-150).
- Delivery / Inventory: clicking empty boat launch button opens the bait boat assembly editor in inventory, flashes empty cargo compartments in red error feedback (`inventory-equipment-feedback--error`), and displays the load chum hint (TK-150).

## v0.49.0 - Bait boat lvl3 Spine animation, night lights, multi-track hopper doors, and dynamic visuals

- Delivery / Spine: introduced full skeletal Spine animation for Level 3 bait boat (`boat-lvl--3.json`), featuring water immersion (`boat3--immersion`), forward propulsion (`boat3--move-forvard_start` -> `boat3--move-forvard1`) with bow forward orientation, and night lights (`boat-light`, `boat3-night_light*`) active in the dark (Spec 150 / TK-141..TK-149).
- Delivery / Hopper: implemented multi-track sequential bay door opening (`boat3--open-section-1..3`), synchronized bait release and slot hiding (`section--1-bait*`), and persistent open bay doors across trips with pre-opened empty bay tracking (TK-143, TK-148, TK-149).
- Delivery / UI & Tools: added dynamic inventory and chum button artwork switching (`boat-lvl--3_bait.webp` vs `boat-lvl--3_no-bait.webp`) and `CONFIG.ui.boat` live DevTools tuning under "SPINE" (TK-141, TK-145).
