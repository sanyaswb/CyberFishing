# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.48.50 - Bait boat size and initial coordinates DevTools tuning and live water updates

- DevTools / Spine: added `SpineBoatDevSection` in DevTools under the "SPINE" category with live config tuning for `CONFIG.ui.boat` (`displayScale`, `x`, `xOffset`, `yOffset`), Spine switcher, clip and bone editors, and skeleton JSON export (Spec 150 / TK-145).
- Delivery / Chum: wired `CONFIG.ui.boat` display scale into `BoatChumRenderFrameBuilder` and initial coordinates/offsets into `ChumController`, enabling real-time visual repositioning of parked idle boats at shore when sliders are adjusted (TK-145).
- Config / Metadata: added `ui.boat` schema validation to `ConfigSchemaValidator` and localized labels for DevTools parameter inspection (TK-145).

## v0.48.49 - Bait boat lvl3 Spine animation, night lights, and door opening logic

- Delivery / Animation: integrated Level 3 bait boat Spine skeletal animation (`boat-lvl--3.json`) across immersion, move start/loop, and sequential hopper bay door opening (`boat3--open-section-1..3`) (Spec 150 / TK-142, TK-143).
- Delivery / Lighting: enabled night lights in slots `boat-light` and `boat3-night_light1..3` during nighttime in all animations except immersion (TK-142).
- World / Rendering: wired `BoatAnimationController` into `BoatChumRenderFrameBuilder` and `PixiWorldEntitiesRenderer`, rendering the Spine display object with motion trajectory alignment and falling back to text emoji (TK-144).

## v0.48.48 - Bait boat lvl3 inventory and chum controls dynamic artwork variants

- Delivery / Inventory: added dynamic artwork switching for bait boat lvl3 (`boat-lvl--3_bait.webp` when all 3 chum slots are equipped, `boat-lvl--3_no-bait.webp` otherwise) across inventory cards, thumbnails, and delivery slot (Spec 150 / TK-141).
- Fishing / HUD: updated `ChumControls` and `ChumController` to show the corresponding boat image on the toolbar button for boat delivery mode (TK-141).

## v0.48.47 - Sequential switch cue playback with configurable overlap, next_track-vinyl, and 2s track pause

- Radio: converted track and station switch cueing into sequential playback (`next_track-vinyl` or `next_track-radio` plays first, followed by incoming track audio from 0:00:00 without beginning cutoff or ducking), governed by new configurable `cueOverlapSeconds` parameter (TK-140).
- Radio / Vinyl: renamed `assets/audio/radio/vinyl/vinyl-6.mp3` to `assets/audio/radio/next_track-vinyl.mp3` alongside `next_track-radio.mp3` and exposed `cueOverlapSeconds` sliders for both vinyl and radio in DEV tuning (TK-140).
- Radio / VOLIA 77.2: inserted an authentic 2-second broadcast pause (`2000 ms`) between playlist tracks during automatic track progression and manual stepping on the same frequency without triggering station switch sweep cues (TK-140).

## v0.48.46 - Uncolored retro zero-state, station-only switch cues, and unmuted vinyl track start

- Radio / Retro: removed hidden distortion in `RetroRack` by making `drive = 0` yield a strictly linear $f(x) = x$ curve, extending lowpass to 22 kHz and highpass down to 10 Hz, and exposing `presenceQ` slider in DEV tuning for full acoustic transparency when sliders are zeroed (TK-139).
- Radio: separated station/frequency switching cues (`next_track-radio` / `vinyl-6`) from intra-station playlist track advances on the same frequency (VOLIA 77.2), playing switch sweep only when changing stations or waves (TK-139).
- Radio / Vinyl: removed initial 3.0s ducking/silencing on `trackCueGate` during vinyl needle drop cueing, allowing the incoming track to play immediately at normal volume without muffling or fade-in delay (TK-139).

## v0.48.45 - Dedicated physical 3-track transistor radio synthesizer section ("Радіо")

- Radio: created new independent "Радіо" (`RadioRack`) section implementing full 3-track physical transistor radio synthesizer with dual cascaded 24 dB/oct HPF/LPF, chassis resonance, asymmetric clipper, DynamicsCompressor AGC, carrier noise, and heterodyne whistle tuning (Spec 149 / TK-138).
- Radio / Walkie-Talkie: restored "Рація" (`WalkieTalkieRack`) and its configuration bit-for-bit to its previous architecture, keeping both effects fully independent in the chain and DEV tuning (TK-138).
