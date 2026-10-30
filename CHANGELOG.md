# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.48.53 - Forward boat start orientation, persistent open compartments, and disabled extra waves

- World / Rendering: corrected Spine boat view rotation in `PixiWorldEntitiesRenderer` (`view.rotation = boat.angle + Math.PI / 2`), ensuring the boat spawns and travels with its bow and headlight pointing forward toward the water instead of backwards facing shore (Spec 150 / TK-148).
- Delivery / Animation: implemented multi-track compartment holding in `BoatAnimationController` (`scene.setSampled(sec, clip, 1.0, 1.0)` on tracks 1..3), keeping bay doors open after bait is dropped during subsequent moves and return trips (TK-148).
- Animation / Spine: disabled unauthored wave slots `boats-wave--2` and `boats-wave--3` by default in `BoatAnimationController` (TK-148).

## v0.48.52 - Fixed SpineScene setSlotVisible Spine 4.3 SlotPose attachment contract

- Animation / Spine: fixed `SpineScene.prototype.setSlotVisible` to use Spine 4.3 runtime attachment API (`Skeleton.prototype.setAttachment(slotName, placeholder)` and `slot.pose.setAttachment`), resolving `TypeError: slot.setAttachment is not a function` on bait boat launch (Spec 150 / TK-147).
- Animation / Spine: preserved and restored authored slot alpha from `slot.data.setupPose.color.a` when making slots visible, retaining proper transparency for boat night lights and bait compartments (TK-147).

## v0.48.51 - Fixed Spine bait boat rendering over emoji fallback

- Delivery / Animation: fixed runtime boat creation in `BaitBoat` to preserve top-level `skin` and `emoji` from equipped `delivery` item alongside `effectiveStats`, ensuring `BoatChumRenderFrameBuilder` acquires animation descriptors (Spec 150 / TK-146).
- Animation / Spine: aligned `BoatAnimationController.#onBundle` with canonical `SpineRuntimeProvider` capability contract (`capability.available`, `createScene(bundle, surface)`), preventing premature fallback to "runtime-not-ready" (TK-146).
- Presentation / Scene: safely unwrapped `boatAnimation` in `game_render_composition.js` for robust frame builder wiring (TK-146).
