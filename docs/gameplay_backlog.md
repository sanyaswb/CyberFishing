# Gameplay backlog

The single list of gameplay bugs, mechanics and balance work. Process: the "Gameplay changes" rules in
[DEVELOPMENT_RULES.md](../DEVELOPMENT_RULES.md). Structural cleanup stays in
[refactoring_remaining.md](refactoring_remaining.md).

Priority: **P1** breaks a session or loses progress · **P2** wrong gameplay result · **P3** polish, feel, noise.
Status: open → in progress → done (commit) or rejected (reason).

## Entry template

```text
### G-NNN Title (P?, status)
Found: date, by whom, where (index/dev, version).
Reproduce: steps or deterministic scenario.
Expected: …
Actual: …
Notes: suspected owner module, related checks.
```

## Open

### G-126 Window size moves the float, fish and boat (P1, open)
Found: 2026-10-30, owner, v0.49.7.
Reproduce: during a fight or a boat trip narrow the browser window or pan — objects near the screen edge are pushed toward the centre.
Expected: the window is only the camera; world positions and physics do not depend on it.
Actual: CONFIG.locations.lockZoneXToScreen takes the physics X bounds from the visible screen (GameWorld.getDynamicBounds), and WaterEntity clamps into them every frame; the fight's side share divides by half the canvas width.
Notes: [spec 153](../specs/153-viewport-independent-world/spec.md).

### G-125 Chum zones do not follow game time and undelivered zones never expire (P2, open)
Found: 2026-10-30, owner + code review of the bait boat, v0.49.7.
Reproduce: launch the boat, let the battery run out before the drop (or reload) — the zone stays in chum_active_<location>
forever; with DEV time acceleration the clock runs faster but zone bonuses do not.
Expected: zones live and expire by game time; an active zone stays until a new one is actually dropped over it.
Actual: zone age = real time x CONFIG.debug.timeScale; undelivered zones are saved forever; a boat's not yet delivered zone
replaces an overlapping active zone at click time.
Notes: [spec 152](../specs/152-chum-zone-lifecycle/spec.md); ChumZone, ChumService, GameTimeClock.

### G-124 Drained bait boat cannot be recovered (P2, open)
Found: 2026-10-30, owner, v0.49.7.
Reproduce: launch the boat, let the battery run out far from the shore.
Expected: it drifts with the current; the landing net picks it up inside the net's reach, or it is taken back when it moors
at the shore; bunker chum returns; it is lost only when the player leaves the location.
Actual: it drifts forever, only a tap within 40 px and 200 map px of the bottom removes it, no new boat can be launched
until reload, and the reload loses it.
Notes: [spec 151](../specs/151-bait-boat-drift-recovery/spec.md); ChumController, ChumService, BaitBoat, Net.

### G-123 Fine connected masks for ordinary coordinate zones (P2, done in v0.47.0; owner acceptance pending)
Found: 2026-10-23, owner, spec 138.
Reproduce: trace a stepped shore inside one coarse zone without refining the global grid.
Expected: a local ×2/×4 side-connected mask controls real boundaries/contours, clipping Pixi waves to keep excluded shore still and preserving depth/the coarse water raster.
Actual: ordinary rectangles/circles alone cannot represent that boundary.
Notes: additive optional local mask data; no player-save change. LMB adds, RMB removes, inversion requires connectivity;
mesh mode dims outside the host immediately. Deterministic input/query/file/movement/cache scenarios; owner visual/performance acceptance pending.

### G-122 Grid-size edits move or resize existing zones (P2, done in v0.47.0; owner acceptance pending)
Found: 2026-10-23, owner, spec 137.
Reproduce: shrink cellSize 40→30/17 with fractional zones and a moving body away from its start.
Expected: exact map-space layout and live positions remain; only the grid resolution changes.
Actual: rounded geometry drifts, water clipping scales in the wrong units, moving bodies restart at authored coordinates.
Notes: retain authored design units; derive integer raster coverage from exact geometry. No new mechanic or save-format change.
Verified: pending-resize failure reproduced before fix; shrink/grow cycles, partial cells, live motion, water clip, next snapped edit and authored geometry invariance pass. Full 67/67; unchanged game-cycle baseline. Owner visual acceptance pending.

### G-121 Circle or square moving-zone bodies (P3, done in v0.46.31)
Found: 2026-10-23, owner, spec 135.
Reproduce: adding a dynamic zone always produces rectangular geometry without a shape choice.
Expected: circle/square creation choice, round body selection and shape-preserving editing/export.
Actual: rectangular body only.
Notes: existing movement bounds stay rectangular; no new buff/collision mechanic.
Verified: deterministic creation, numeric/contour editing, shape hit tests, WebGL/Canvas and browser/CLI round-trips pass. Full 66/67, only known committed PNG release failure; game-cycle baseline unchanged. Owner visual and phone performance acceptance pending.

### G-120 Random grid-aligned moving-zone starts (P3, done in v0.46.31)
Found: 2026-10-23, owner, spec 134.
Reproduce: create maps with different controlled random draws; starts always equal authored x/y.
Expected: moving zones start at random legal grid positions; editing refresh preserves live positions.
Actual: fixed authored start at each load.
Notes: LocationMap fresh creation / DynamicZone; zone-editor deterministic scenarios.
Verified: pre-fix controlled low draw failed; legal extreme starts, fine-grid refresh, independent start RNG and no-fit/stationary cases pass. Full 66/67, known committed lobby PNG failure; game-cycle unchanged. Owner visual acceptance pending.

### G-119 Moving zone crosses its allowed area by half its size (P2, done in v0.46.31)
Found: 2026-10-23, owner, moving-zone editing and runtime motion (spec 133).
Reproduce: body x=8, w=2 inside bounds x=0, w=10, positive horizontal velocity; advance a fixed step.
Expected: its right edge stays at or below 10 and horizontal velocity reverses at the edge.
Actual: DynamicZone checks x+w/2, so its right edge may reach 11. Editor drag/resize has no movement-area constraint.
Scope: full-rectangle runtime bounce and shared DEV containment, without changing RNG scheduling or save format.
Resolution: full-body edge reflection, including exact contact/large steps; shared rectangle constraints also limit DEV movement/resize and numeric edits. Fixed-clock regression scenarios pass. Full 66/67: only pre-existing pages-release PNG failure; game-cycle unchanged, no rebaseline. Owner visual acceptance pending.

### G-116 Selector sectors gain a thick yellow border during interaction (P3, implemented in v0.46.6)
Found: 2026-10-22, owner, radial selector.
Reproduce: expand the selector and highlight or focus equipment/backpack/keepnet.
Expected: the main toolbar button's feedback style, without an extra yellow outline or thicker sector border.
Actual: highlighted and focused shapes used --ui-focus-color plus stroke-width 0.09 instead of ordinary 0.05.
Resolution: shared toolbar background tokens, accent border at normal width and info-colored keyboard focus. No gesture, geometry, animation or state changes; TK-032. Companion cosmetic task TK-033 replaces the central icon with four squares, preserving the suitcase source outside runtime.
Evidence: existing selector interaction and CSS ownership checks pass; appearance remains owner-checked, with no pixel assertions.

### G-115 Mobile float/depth button shares the radial selector row (P3, implemented in v0.46.5)
Found: 2026-10-21, owner, mobile bottom controls.
Reproduce: use a float on a narrow screen, then show the chum/net actions.
Expected: selector in an upper row, float/depth below it and left of the other actions; expanding the slider keeps those actions stable.
Actual: one wrapping toolbar row mixes the selector reserve with tackle actions; row placement depends on their available width.
Resolution: toolbar owns a separate selector host. At <=820 logical toolbar px its full-width last flex item wraps above actions; depth retains first order. The selector's measured root is unchanged; wide/classic layouts and depth expansion keep existing behavior.
Evidence: existing startup input regression failed before mount injection; production/DEV/catalog share the mount and UI component/selector checks pass. Owner responsive visual acceptance pending.

### G-114 Night float keeps glowing in daylight (P3, implemented in v0.46.4)
Found: 2026-10-21, owner, after v0.46.3.
Reproduce: equip a night float and cast during the day; observe both the green outside halo and additive light over its red antenna.
Expected: no outside/inside glow in daylight; the original red tip stays red. Night lighting and DEV glow switches keep working, including day/night changes on an existing cast.
Actual: FishingEquipmentRenderModelBuilder selected both effects from variant=night alone, without reading location time.
Resolution: inject the cached EnvironmentSystem snapshot time through bootstrap and reuse backgroundTimeBlend into one retained record. Gate both effects by the same night-light condition; daylight also excludes the optional bite halo on this night float. Renderers consume the same model, unchanged art and geometry; no gameplay/config/save/baseline changes.
Evidence: float-pose daylight regression failed before the fix; tests cover 12/18/19/19.01/21/midnight/5/6.99/7/9, unchanged geometry, DEV switches, Canvas body-only rendering and WebGL dawn clearing both layers. Owner visual/phone acceptance pending.

### G-113 The float leans by hand-written angles: wrong sideways lean, jumps, stretching (P2, implemented in v0.46.0)
Found: 2026-10-21, owner, float review.
Reproduce: retrieve straight toward the player (the float turns sideways: `moveY` mixed into roll); the same ground speed near and far leans differently (pixels per second); bite start/end, hook and stop snap the angle; a rise bite or heavy ballast stretches/shrinks the bar.
Expected: the tip leans away from the line or fish pull and lags the motion; sideways components turn roll, the depth component foreshortens; smooth springs at any frame rate; the body sinks, never stretches; a few general multipliers.
Resolution: [127](../specs/127-float-pose-physics/spec.md). `FloatPoseAnimator` (presentation) sums motion through the water in ground metres, line pull, fish and wind with `CONFIG.physics.floatPose` gains into damped springs for roll, pitch and draft; the rig's intended lean, bite timing and random numbers are unchanged. Ballast `heightScale` became `restDraft`.
Evidence: `float-pose` check (signs, diagonal, metric independence, continuity, 30/60/144 FPS, draft, lying/standing/over-depth, reuse) and migrated `rod-side-tension`; Full 66/66, game-cycle baseline unchanged. Owner play check and phone performance pending.

### G-112 Exact water length is replaced by confusing camera-dependent metres (P2, implemented in v0.45.43)
Found: 2026-10-21, owner, v0.45.42 screenshot.
Reproduce: enter 30 m water and tilt 30 degrees; camera distance 30 reports 112 m, distance 900 reports 61.7 m. The 10 m aim line sits near shore and the overhead-reference control changes the meaning of length.
Expected: author exact 30 m water, artistic ellipse tilt and one understandable far-size ratio; fixed grid/water bounds, coherent aiming/motion/area bonus.
Resolution: [126](../specs/126-simple-water-perspective/spec.md), replacing the camera/reference models. Defaults 30 m / 30 degrees / 0.3; no camera distance or ray sector. WaterMetric owns exact positions, velocities and illustrated area footprint queries; chum rendering and containment agree. Grid-width contraction remains optional/off. Save schema, bonus timing and engine base units remain.
Evidence: exact-length regression fails before the fix (270.42 instead of 30 m at 17 degrees); exact endpoints, 10/20/30 m aiming, inverse/Jacobian, near/far ratio, area containment, save/reload, reset/import and boat scenarios pass. Full and owner acceptance are recorded in spec 126.


### G-111 Camera tilt greatly changes chum width even with lateral expansion disabled (P2, implemented in v0.45.42)
Found: 2026-10-21, owner screenshots after spec 124.
Reproduce: 30 m maximum and 30 m camera distance, width switch off; compare 17 and 53 degrees.
Expected: stable transverse scale and ground-circle width between angles; lateral expansion defaults off.
Actual: automatic fitting changes X scale from 142.74 to 42.79 map px/m (3.34x width).
Resolution: [125](../specs/125-stable-water-width/spec.md). Keep the full authored green-zone bounds and fix the transverse scale using the overhead reference length. Tilt changes internal metre spacing/actual far distance; grid and animated water always fill the same complete rectangle. DEV distinguishes overhead reference from actual metres and shows near/far rays with a shaded sector from the same metric (parallel at 90°). Modern omitted/fresh/reset width settings default off; explicit true still contracts with distance.
Evidence: the new fixed-scale regression fails before the fix. The full-height regression also fails before the final correction. Actual contour widths, 17/53/90-degree edits, projection inverses/velocities, unchanged runtime boundaries/full clipping, default/reset/import, boat equivalence and save/timing scenarios pass. Full and owner acceptance are recorded in spec 125.

### G-110 Visual perspective collapses at a 90-degree shore and disagrees with physical water (P2, implemented in v0.45.41)
Found: 2026-10-21, owner, map/perspective review.
Reproduce: angleTop=0, angleBottom=90; chum at mid-water receives visual scale about 6.12e-17. The same curve also shrinks its influence, independently of the metre grid.
Expected: one finite water projection; overhead circles and grid remain uniform, ground radius agrees with drawn boundary.
Actual: tangent normalization collapses zones; independent visual/physical curves disagree.
Resolution: [124](../specs/124-unified-water-projection/spec.md). Owner chooses exact bounds/metres and automatic fitting, with camera distance controlling perspective strength. Ground chum influence, overlap, wave spacing and shared chum/landing contours use the authoritative metric. Engine units, chum save format and bonus timing stay unchanged.
Evidence: the initial short-water matrix fails under the old minimum-length restriction. Camera matrix/inverses/velocities, off-centre boundary points, viewport transforms, save/reload/expiry, boat flat-lake equivalence and bounded geometry reuse pass. Full and owner phone/visual acceptance are recorded in spec 124.

### G-109 Distinguish normal clicks before the 200ms inventory hold countdown (P3, implemented in v0.45.38)
Found: 2026-10-21, owner timing correction after v0.45.37.
Reproduce: hold any filled inventory cell slightly longer than a normal click.
Expected: a recognition delay before the 200ms action countdown, shared by all cells.
Actual: feedback started immediately and the action fired 200ms after pointerdown, making normal clicks too easy to turn into holds.
Resolution: restore the shared 300ms activation delay, retain 200ms progress (500ms total). No progress/RAF during recognition; short click and movement/cancel keep their behavior. Green pick cancellation stays separate at 200ms.
Evidence: delayed-feedback regression failed before the change; UI scenarios cover delay/499–500ms boundaries across backpack, kits, equipment, touch editor and header, cancellation during both phases and short release. Platform clocks/progress/cleanup pass. Owner acceptance pending.

### G-108 TK-014 classic backpack flashes before the radial selector on startup (P3, implemented in v0.45.37)
Found: 2026-10-21, owner, first game load in index/dev.
Reproduce: start in radial mode with selector artwork preload still pending.
Expected: the selected control mode appears once its assets are ready, with no temporary classic shortcut.
Actual: composeInventorySelector computed radial as loaded AND configured, then made classic controls visible whenever radial was false. Pending preload therefore enabled classic, and completion replaced it with radial.
Resolution: distinguish pending, ready and failed preload. Pending radial keeps both shortcuts hidden; ready reveals radial; only explicit classic mode or a real preload failure reveals classic. Config changes during preload use the current mode; late completion after disposal cannot change controls.
Evidence: the deferred-preload regression failed before the fix; existing selector scenarios now cover pending mode switches, ready, explicit classic, failure fallback and late success/failure disposal. Owner startup acceptance pending.

### G-107 The 200ms hold speed was applied only to header bait (P3, implemented in v0.45.36)
Found: 2026-10-21, owner correction after v0.45.35.
Reproduce: hold a backpack card, equipped rod/tackle or filled editor cell, then compare to header bait.
Expected: every cell uses 200ms from pointerdown, without an activation delay.
Actual: header bait used 200ms while other cells kept 300ms delay plus 800/1500ms countdown.
Resolution: make 200ms/zero delay the controller defaults; equipped and header consumers share this duration.
Evidence: the backpack timing regression failed before the fix; existing UI scenarios now verify 199/200ms boundaries for backpack, saved kit, rod/tackle and touch editor, plus header cancellation. Platform clocks/progress/cleanup pass. Owner acceptance pending.

### G-106 Header bait hold has no progress feedback and takes too long (P3, implemented in v0.45.35)
Found: 2026-10-21, owner, header bait removal in v0.45.34.
Reproduce: hold LMB on an equipped, unhighlighted bait icon in index/dev inventory.
Expected: an animated circular indicator without a shadow; remove the portion after 200ms from pointerdown.
Actual: compact-header progress was disabled, and card defaults delayed removal by 300 + 800ms.
Resolution: reuse shared hold feedback in the artwork host with a thin mask and no shadow; inject zero activation delay and 200ms duration only for header bait. Keep card timing, green-target cancellation and stale/release-click protections.
Evidence: the existing UI deadline scenario failed before the fix and passes after it; platform performance/Date-clock scenarios verify immediate progress, half-fill at 100ms and cleanup. Owner visual acceptance pending.

### G-105 Header bait cannot be removed by an equipped-item hold (P3, implemented in v0.45.34)
Found: 2026-10-21, owner addition to the TK-011 acceptance fix.
Reproduce: hold LMB on an equipped bait icon in the inventory header switcher.
Expected: return only that portion to the backpack; preserve the hook, other bait slots and automatic-mode switch.
Actual: the header supported only click-to-pick and had no removal command/gesture.
Resolution: reuse the equipped-item hold controller without card progress decoration, with explicit expected item identity and atomic detach. Consume the release click across in-place slot rebinding; green pick targets keep 200ms cancellation priority.
Evidence: existing UI/integration scenarios cover deadline, RMB, movement/cancel, stale bait, close/reopen, short click, pick cancellation and exact-slot removal. Spec 123; Full 64/65 (the prior uncommitted controller still blocks Pages), owner acceptance pending.

### G-104 Repeated equipment-cell selection leaves hooks without bait sockets (P2, implemented in v0.45.34)
Found: 2026-10-21, owner TK-011 acceptance, index/dev inventory.
Reproduce: activate the empty tackle cell, repeat the green cell to equip a hook, then press the bait header icon.
Expected: the equipped hook owns its bait socket and accepts bait immediately.
Actual: the quick path equips a loose root without assembly state; the header resolver finds no socket and reports missing tackle.
Resolution: initialize and prepare attachment-capable roots inside the existing equip transaction. Header commands repair an already equipped loose single root missing that state, keeping its identity and releasing its equipment reservation only within the atomic transaction. Saved loadout roots keep their existing handling; no schema changes or read-model mutation.
Evidence: inventory-integration failed before the fix; covers single/stack hooks in both list visibility modes, feeder chum, old-state repair, save/reload and persistence rollback without item loss. Full 64/65 (the prior uncommitted controller still blocks Pages), owner acceptance pending.

### G-103 Touch buttons lack transient hold feedback (P3, implemented in v0.45.32)
Found: 2026-10-20, owner TK-012, index/dev touch/non-hover surfaces.
Reproduce: hold a HUD/toolbar/menu or inventory button on a touch device, then release.
Expected: reuse the component's hover feedback during the press only; no remaining hover after release/cancel.
Actual: the previous policy disabled both hover and decorative active states on touch surfaces.
Resolution: native scoped active styles in component owners; keep desktop capability gating, keyboard focus and semantic states.
Evidence: CSS policy and UI checks pass; Full 64/65 (Pages needs the prior pair's new controller committed). Spec 121; appearance/release acceptance belongs to the owner.

### G-102 Empty-cell pick shows compatible items for unrelated cells (P3, implemented in v0.45.31)
Found: 2026-10-20, owner TK-011, index/dev inventory.
Reproduce: with rods, a boat and a net in the backpack, activate the empty rod cell.
Expected: Compatible contains only matching rods with every available rod subtype selected; other cells/sockets behave likewise.
Actual: the global compatible category also includes items for other equipment slots.
Resolution: scope Compatible to the exact pick target; initialize the existing subtype IDs through an injected projection query.
Evidence: inventory-integration reproduced the failure and passes rod families, narrowing, changed cell and exact editor socket. Spec 120; owner acceptance pending.

### G-101 Missing consumable prerequisites cannot be explained from the header (P3, implemented in v0.45.30)
Found: 2026-10-20, owner amendment to TK-010.
Reproduce: press the grey bait/chum icon without an equipped supporting tackle.
Expected: existing warning and red whole-field feedback on the missing rod/tackle; no inventory change.
Actual: native disabled buttons swallowed the activation.
Resolution: header-only opt-in for unavailable activation; application emits authoritative rejection feedback using the existing overlay/revision contract.
Evidence: UI and inventory-integration cover actionable unavailable icons, warning, error tone/slot, and unchanged gameplay snapshot; owner visual acceptance pending.

### G-100 Empty equipment/editor targets lack the header repeat-pick behavior (P3, implemented in v0.45.30)
Found: 2026-10-20, owner TK-010-1.
Reproduce: repeat an active empty equipment cell or editor socket.
Expected: one first displayed compatible item is equipped; portrait retains its inline editor.
Actual: commands restarted the pick, and portrait editor tabs never entered a pick.
Resolution: extend the same candidate intent and current repository validation to equipment/editor targets; project the active socket highlight and preserve the editor.
Evidence: inventory-integration failed before the change, now covers equipment and inline-editor repeats/cancellation; existing UI scenarios cover all action dispatch and editor routes. Spec 119; Full/owner acceptance pending.

### G-099 Active inventory picks cannot be cancelled by hold/right-click (P3, implemented in v0.45.30)
Found: 2026-10-20, owner TK-010-2.
Reproduce: start a pick and hold its active target for 200ms or right-click it.
Expected: clear the pick without equipping/removing or leaving the page; no browser context menu anywhere in the game.
Actual: no cancellation command; browser input controls retained context-menu exceptions.
Resolution: authoritative pick-cancel command, delegated browser hold/right-click controller, complete input cleanup and global context-menu suppression.
Evidence: task-interactions covers 199/200ms, mouse/touch, move/cancel/blur, stale DOM, click suppression and disposal; platform-runtime covers editable-control context menus. Spec 119; Full/owner acceptance pending.

### G-098 Repeating a highlighted consumable header icon does not equip (P3, implemented in v0.45.29)
Found: 2026-10-20, owner TK-010, index/dev inventory.
Reproduce: activate a bait/chum header icon to highlight compatible items, then repeat that same icon.
Expected: equip one first displayed compatible item using current filtering/sorting; another icon changes only the target.
Actual: the repeated icon restarted the pick without equipping.
Resolution: presentation submits the first displayed candidate ID only for the highlighted icon; the application rechecks target, custody, reservation and compatibility, then uses the existing atomic attachment path. Preserve manual confirmation priority, A settings and save semantics.
Evidence: inventory-integration and inventory-ui failed before the change and pass after it, covering both kinds/layouts, current order, stale candidates, empty selection and one-time consumption. Spec 119; owner acceptance and final Full pending (automatic approval review usage limit).

### G-097 Clock phase switching skips midnight after evening advances (P2, implemented in v0.45.22)
Found: 2026-10-20, owner declines clock acceptance in v0.45.21, DEV location/House.
Reproduce: double activate at 12:00 to reach 19:00, let calendar time advance, then double activate again.
Expected: 12:00 -> 19:00 -> 00:00 -> 12:00, with night environment/background and unchanged acceleration/save schema.
Actual: any positive night blend during dusk was classified as night, so the next command returned 12:00.
Resolution: TimePhaseControl distinguishes fully reached night from partial dusk blending; reuse existing blend thresholds and the shared clock anchor.
Evidence: task-interactions failed 12 versus 0 after 100ms of elapsed calendar time; passing regression now covers the cycle, environment phase, rate isolation and storage. dev-time covers the House jump from 19.001 to 0 and its night background. See spec 116; owner acceptance pending in tasks.md.

### G-096 Clock phase command bypasses the DEV acceleration flag (P2, implemented in v0.45.22)
Found: 2026-10-20, owner correction to TK-005, DEV location/House.
Reproduce: turn off debug.timeAccelerationEnabled and double activate the clock, or turn it off between the two clicks before the next UI update.
Expected: no phase or speed change while disabled; ordinary production clocks remain passive. Enabling restores both DEV actions.
Actual: only single acceleration checked the flag; double activation remained enabled and production composition installed its own phase command.
Resolution: guard DevTimeControl.advancePhase with the live injected flag; disable both view actions and cancel pending activation on control-state changes; remove the default production phase command and the passive House catalog callback.
Evidence: dev-time failed 19 versus 12 with the flag off; task-interactions now covers production isolation, disabled mouse/keyboard clicks, disable/re-enable, pending cancellation, live flag races, and existing disposal/movement scenarios. See spec 116; owner acceptance pending in tasks.md.

### G-095 Hand chum selection immediately shows reachable cast area (P3, implemented in v0.45.10)
Found: 2026-10-20, owner instruction.
Reproduce: with hand chum equipped, click the chum button on the toolbar without pressing/dragging the water.
Expected: immediately upon clicking the button, the accessible cast range (dashed line and shaded area) appears on the water, before any pointer drag starts, and stays visible while aiming.
Actual: the accessible cast area was hidden until the pointer drag began (and only if debug.casting.showChumDistanceLine was true); clicking the hand chum button alone showed no cast range boundary.
Notes: `CastingRenderFrameBuilder.#buildChumAim` now builds `aimingZone` immediately whenever hand chum aim is active, before and during pointer dragging, and keeps it hidden for boat delivery or when aim is idle. Focused check `chum-aim-zone-check.js` covers idle aim, active power aim, boat chum exclusion and idle dismissal. Architecture, Quick and Full checks pass; game-cycle baseline and save format unchanged. Owner visual acceptance pending.

### G-093 Closed depth control blocks radial selection and aiming (P2, implemented in v0.45.4)
Found: 2026-10-20, owner's follow-up to G-092/TK-008, dev.html with an equipped float.
Reproduce: show the depth control with its track closed; move through its transparent vertical footprint while selecting radial sections or aiming an equipped rod. Move an active aim over the float/HUD itself.
Expected: only visible depth controls receive presses; radial selection and an already-owned world aim continue without an invisible input wall.
Actual: DepthSelector retained the vertical panel's flow footprint and UiEventShield.makeSolid forced pointerEvents=all on its wrapper. Canvas captured map navigation only, so equipped aiming lost pointer movement over HUD targets.
Notes: new platform regression failed with vertical orientation; the equipped-aim capture check failed null vs pointer 1 before the fix. The toolbar now owns a common depth/net group, with horizontal slider and mobile depth row above the net. Closed content is hidden/inert; event shielding no longer turns layout into a solid hit region. Canvas owns every pointer gesture started on it. Previous document-wide selector pointermove tracking and coordinate-only leave retention were removed; the selector's own transparent retention handles internal routes. Owner requested upright art in all sections; rotations were removed. Existing depth step/range/callback and gameplay/save semantics preserved. Owner visual/performance acceptance pending.

### G-092 Radial selector closes while crossing its fan (P3, implemented in v0.45.3)
Owner root-cause correction (v0.45.4): the visible interference was the float depth control's transparent hit region, addressed in G-093. The previous global tracking workaround was removed; lifecycle and animation geometry checks remain valid.
Found: 2026-10-20, owner review of TK-008 in v0.45.2, dev.html desktop hover.
Reproduce: enable radial mode and move from its central button upward, through the centre and between sections; repeat across child hit regions or after an unrelated ancestor class update.
Expected: the fan remains open throughout its retention region; only leaving the whole region or a real visibility/layout change cancels it.
Actual: root pointerleave and the unconditional ancestor MutationObserver cancelled the fan even while pointer coordinates remained within its region.
Notes: pointerleave is now coordinate/related-target aware, document pointermove bridges hit-region changes, and ancestor changes compare visibility and cached geometry. Focused checks cover these cases, real hide/layout cancellation, translated outer-edge selection mid-animation, reduced motion and disposal. Owner also requested a full quarter-disk central button, equal gaps and outward candidate movement for mouse/touch; recorded in spec 117. Visual and phone performance acceptance pending.

### G-091 Newly equipped item feedback flashes only the inner well (P3, implemented in v0.45.1)
Found: 2026-10-19, owner declines TK-003 editor acceptance in v0.45.0.
Reproduce: equip a component in the editor and inspect the green success flashes on its expanded tab; compare the feedback footprint with the whole tab container and its inset.
Expected: both success flashes cover the entire item field/tab, with matching rounded edges, including the active tab's free width. One event, one overlay; preserve timing, input and reduced motion.
Actual before fix: InventoryUI adds inventory-slot--equipped-flash to the small inner well; the editor's outer padding and widened tab remain unlit.
Resolution: resolve the outer field/editor tab as the feedback host and reuse a shared inert overlay, including an existing compatible-target layer when present. Remove the obsolete inner-well flash style; no gameplay/state/timer change or replaced tools.
Evidence: failing-before inventory-ui regression expects a full-container feedback host but finds none; it passes after the fix for loadout fields, expanded editor tabs, reused/new overlays and revision deduplication. Focused inventory UI/integration, Architecture 4/4, Quick 37/37 and Full 63/63 pass; game-cycle/save bytes unchanged. The owner's declined editor acceptance stays open in tasks.md.

### G-090 Pointer aim leads before the viewport reaches the location edge (P3, implemented in v0.45.0)
Found: 2026-10-19, owner correction to TK-002.1, index/dev in v0.44.1.
Reproduce: while the camera can still pan right, hold the pointer at X=250 in a 400px viewport.
Expected: aim stays at X=250 until the right camera limit is reached; left-half lead is enabled only at the left limit. Preserve 80px maximum, centred return and shared release/preview mapping.
Actual before change: the centred curve applies unconditionally, so aim is X=290 despite available camera travel.
Resolution: amend spec 114, read the authoritative directional limits from ViewportProjector, gate the existing curve in CastPowerAim and recalculate after edge-pan steps. No new camera state, renderer offset, save field or obsolete tool.
Evidence: task-interactions fails before the change with 290 versus 250, passes after it; real-projector free/edge/wrong-side, same-update arrival/departure, release, resize and whole-map cases covered. Focused checks, Architecture 4/4, Quick 37/37 and Full 63/63 pass; game-cycle baseline/save bytes unchanged. Owner visual acceptance remains pending in tasks.md.

### G-089 Mobile notice sheets also replace desktop top notices and leave a top gap (P2, implemented in v0.44.1)
Found: 2026-10-19, owner correction to TK-001, inventory/House and UI catalog in v0.44.0.
Reproduce: show a notice above 820px; it incorrectly overlays the bottom. On a phone, show an inventory warning; the old portrait hint-region padding also shifts the header/content down.
Expected: <=820 logical UI-surface px gets a bottom sheet without top footprint or bottom border; >820 keeps the original top-flow notice, full border, close behavior and timer (inventory 5000ms, House 4000ms).
Actual before fix: the sheet modifier/gesture was unconditional, House's top regions were removed, and the mobile top-region padding matched the visible absolute sheet.
Resolution: subscribe to injected UI-surface metrics; toggle sheet state/handle/drag, restore House's panel/header flow and inline duration, exclude sheet children from top padding/margins, remove border-bottom only in the sheet modifier. One timer/message owner, no game/save changes or obsolete tools.
Evidence: failing-before task-interactions regression at 820→821px; focused resize/cancel/stale-exit/timer, House host/header, inventory footprint, catalog and CSS checks pass. Architecture 4/4, Quick 37/37, Full 63/63; game-cycle/save bytes unchanged. Owner browser acceptance remains pending in tasks.md.

### G-088 Pointer aim recentres at the contact instead of the viewport midpoint (P3, implemented in v0.44.0)
Found: 2026-10-19, owner correction to TK-002, index/dev in v0.43.1–v0.43.2.
Reproduce: start aiming at X=40 in a 400px viewport, move right to X=300, then return the pointer to X=200.
Expected: the line coincides with the pointer at viewport centre, regardless of the starting contact; a symmetric positional lead grows to 80px on either side over the existing 100px ramp.
Actual before fix: the mapping uses pointerStart.x; even with the requested 80px maximum, returning to X=200 leaves the line at X=280. The initial default maximum was 100px.
Resolution: amend [114](../specs/114-pointer-aim-lead/spec.md); use the injected game viewport midpoint in CastPowerAim, preserve the shared preview/edge-pan/release path and reduce the configurable default maximum to 80px. No new renderer state or save migration.
Evidence: failing-before `task-interactions` regression (280 versus 200), passing after the fix; off-centre starts, reversal, release/preview/target, edge pan, resize and keyboard covered. Focused checks, Architecture 4/4, Quick 37/37 and Full 63/63 pass; game-cycle baseline and save bytes unchanged. No obsolete tools. Owner visual/play acceptance pending in tasks.md.

### G-087 Wide backpack gestures do not switch inventory sections (P2, implemented in v0.43.1)
Found: 2026-10-19, owner follow-up to TK-007, wide index/dev inventory in v0.43.0.
Reproduce: open Backpack in landscape/desktop and drag left/right across its overview or item list.
Expected: one swipe selects Keepnet/Equipment; Keepnet swipes back to Backpack. No hidden portrait page consumes the gesture.
Actual before fix: section navigation shared the portrait-only paging flag, while the outer controller ignored the nested list pager even when its paging was off. TK-007 had been scoped too narrowly to editor tabs.
Resolution: separate all-layout section and portrait collection flags; wide nested collections forward to the section command. The parent measures the touched column once at start/end; editor navigation remains disabled and horizontal filters retain their own scroll.
Evidence: failing-before wide-list mouse regression; mouse/touch, overview/list, both remembered portrait pages, keepnet return, cancel/click suppression and editor blocking. Focused inventory/keepnet checks pass; Architecture/Quick/Full and owner visual acceptance recorded in tasks.md. No obsolete tools or baseline changes.

### G-086 Double activation changes the calendar phase (P2, implemented in v0.43.0)
Found: 2026-10-19, owner TK-005, index/dev/House.
Reproduce: double activate the clock; previously production was passive and DEV performed two acceleration clicks.
Expected: one day/evening/night transition, with DEV single speed still available and no fabricated simulation time.
Resolution: [116](../specs/116-clock-phase-switch/spec.md), GameTimeClock anchor command and injected activation controller.
Evidence: 299/300/301ms, rate isolation, calendar continuation, DEV handoff/environment and unchanged v1 format; full 63 checks pass. Owner browser acceptance pending.

### G-085 Bare line slows down after exhausting slack (P2, implemented in v0.43.0)
Found: 2026-10-19, owner TK-006, cast rod control.
Reproduce: cast with only rod/reel/line and move laterally across the taut boundary.
Expected: retain configured free-motion speed for a bare line; retain x3/x1 with terminal load.
Actual before fix: the controller had no equipment-load reading and always selected x1 while taut.
Resolution: [115](../specs/115-bare-line-rod-speed/spec.md); canonical read-model flag, passed by Waiting/Biting.
Evidence: failing-before 405 versus 415 at 50ms; loaded transition, geometry, line limits and unchanged game-cycle pass. Owner play acceptance pending.

### G-084 Aiming stays under the finger at viewport edges (P3, implemented in v0.43.0)
Found: 2026-10-19, owner TK-002, pointer casting/recasting/chum.
Reproduce: start aiming centrally, move horizontally toward an edge and release.
Expected: smooth additional lead up to 100 logical pixels; preview and target use the same coordinate.
Actual before fix: pointer X was clamped and copied directly, without lead.
Resolution: [114](../specs/114-pointer-aim-lead/spec.md), shared CastPowerAim mapping and injected configuration.
Evidence: failing-before half-ramp 250 versus 300; symmetry, clamp, return, release and disabling pass. Owner phone/play/performance acceptance pending.

### G-083 Transient notices occupy the top content flow (P3, implemented in v0.43.0)
Found: 2026-10-19, owner TK-001, inventory and House.
Reproduce: trigger a warning or notice; previously it appeared above controls and moved them down.
Expected: bottom sheet, shared handle, five-second lifetime, downward dismissal at 10% of initial height.
Resolution: injected HintSheetController; one timer owner, text scrolling, capture/cancel and stale-callback guards.
Evidence: 19/20px boundary at 200px height, paused timer, replacement during exit, scrolling and disposal; inventory/House/catalog and full checks pass. Owner visual acceptance pending.

### G-082 Artwork drag interrupts wide editor gestures (P3, implemented in v0.43.0)
Found: 2026-10-19, owner TK-007, wide inventory editor.
Reproduce: drag artwork in a tab row/preview; native image dragging or a child's lost capture can cancel the owner gesture.
Expected: mouse/touch horizontal scroll or page swipe, without accidental activation or stuck capture.
Resolution: shared scroll/pager dragstart suppression, capture ownership filtering and cleanup; resize invalidates swipe commit.
Evidence: failing-before native drag regression, mouse/touch drag and listener/capture disposal, inventory and House contracts pass. Owner browser reproduction/acceptance pending.

### G-081 Sticky action children may paint beyond rounded corners (P3, implemented in v0.43.0)
Found: 2026-10-19, owner TK-004, item editor.
Reproduce: scroll a long editor until its action row sticks; inspect the lower corners.
Expected: one rounded panel surface before/during/after sticking.
Actual before fix: radius existed but children were not clipped to its outline; the reported visual contour was not browser-verified.
Resolution: local overflow clip and isolation, keeping existing radius/sticky geometry and ScrollContainerAligner.
Evidence: inventory UI and CSS guards pass. Owner visual verification pending.

### G-080 Socket selection highlights only the inner well (P3, implemented in v0.43.0)
Found: 2026-10-19, owner TK-003.3, item editor.
Reproduce: select a compatible item for an editor socket; the wider tab area remains unlit.
Expected: full rounded tab highlight, with no second inner pulse.
Resolution: project canonical pick state for rod sockets and paint a tab-owned highlight layer.
Evidence: inventory UI verifies the enclosing tab and absence of inner highlight; integration/CSS checks pass. Owner visual acceptance pending.

### G-079 Redundant divider above editor parameters (P3, implemented in v0.43.0)
Found: 2026-10-19, owner TK-003.1, editor parameter page.
Reproduce: view root/filled-cell parameters in the editor.
Expected: no extra top divider above the first parameter; other parameter views retain their borders.
Resolution: editor-scoped border override; no global parameter redesign.
Evidence: CSS usage and inventory UI checks pass. Owner visual acceptance pending.

### G-078 Opening a boat editor leaves the backpack visible (P2, implemented in v0.43.0)
Found: 2026-10-19, owner TK-003.2, portrait inventory.
Reproduce: activate an editable boat from the backpack.
Expected: reveal that instance's editor immediately after successful preparation.
Actual before fix: panelMode changed, activeSectionId stayed backpack.
Resolution: the UI-state editor transition reveals equipment-host and preserves entry context.
Evidence: integration scenario fails before the change and passes after; component editing and inventory UI contracts pass. Owner visual acceptance pending.

### G-077 Editor Back loses the entry section (P2, implemented in v0.43.0)
Found: 2026-10-19, owner TK-003.4, inventory editor.
Reproduce: enter from backpack or equipment, change/view a component and press Back.
Expected: restore the originating section and backpack category/filter/sort; retain saved-loadout return route.
Actual before fix: there was no stored editor origin.
Resolution: transient InventoryUiState return context, retained across same-editor component commands and cleared on exit.
Evidence: backpack/equipment integration routes, existing saved-loadout contracts and byte-identical save round-trip pass. Owner visual acceptance pending.

### G-076 Automatic perspective zoom enlarges casting and chum areas (P2, implemented in v0.42.2)
Found: 2026-10-19, owner, v0.42.1.
Reproduce: open index/dev at the original 30° setting and compare casting spread, chum areas and near-field sizes with the earlier game.
Expected: restore the original visual scaling and physical 50 px = 1 m base; retain the editor tools.
Actual: shared physical/visual projection uses lateral pixels/metre divided by sin(30°), doubling near-field widths; fitting short lengths can enlarge the scale further.
Resolution: [113](../specs/113-restore-original-scaling/spec.md). Restore archived sine/tangent visual formulas, original 0°/30° location angles and physical WaterMetric without tilt/autofit. Keep 30 m, compression from the green-zone shore, all editor tools and Overlay off. Visual angle edits never alter physical metres. This owner rollback supersedes G-070/G-073/G-074's projection model.
Evidence: the initial regression returned visual scale 2.0000000000000004 instead of 1. Historical formula samples, actual chum render/gameplay boundaries, physical metric identity, boat/line limits and actual editor/reset/export/import checks pass. Automated suites and owner visual acceptance are recorded in spec 113.

### G-075 DEV Overlay opens by default (P3, done in v0.42.1)
Found: 2026-10-19, owner request during perspective testing.
Reproduce: open DEV with base settings; diagnostic Overlay starts visible.
Expected: Overlay starts off and can be enabled manually in DevTools.
Actual: `CONFIG.debug.overlay` defaults to true.
Resolution: set the existing master flag to false. Keep module selections and the manual toggle unchanged.

### G-074 Perspective tilt forces a different location length (P2, done in v0.42.1)
Found: 2026-10-19, owner, v0.42.0.
Reproduce: keep a 30 m location and select 15°; the editor refuses unless the far distance grows to at least 49.46 m.
Expected: angle and length are independent inputs; projection zoom fits the authored water rectangle. Restore the original 30° shore angle and 30 m far distance.
Actual: near-shore projection scale was fixed to the physical base-pixel unit, imposing an angle-dependent minimum length.
Resolution: [112](../specs/112-independent-location-projection/spec.md). Fit the shared metric automatically while retaining physical metre/base-pixel units, exact inverses and velocity derivatives. Remove the obsolete minimum getter and UI restriction. Retain compression from the lower green-zone edge.
Evidence: first focused check rejected 1° at 0.1 m. Independent length/angle matrix, actual editor edits, grid/chum/landing geometry, boat and idle-tackle regressions cover the fitted mapping. Architecture 4, Quick 36, Full 62 pass; game-cycle baseline unchanged. Owner visual/phone check pending.

### G-073 Location authors cannot set the water-plane tilt (P2, implemented in v0.42.0)
Found: 2026-10-18, owner, Pages v0.41.8 and phone screenshot of the DEV editor.
Reproduce: open the zone editor's perspective group and try setting a shore angle or locating export/reset controls beside it.
Expected: each location has an editable angle in degrees, clear distance labels and nearby save/reset actions; all metre calculations and render areas agree with the selected tilt.
Actual: the metric's shore squash is fixed at 1; raw fields `enabled/linearShare/maxMeters` cannot change tilt, labels are truncated and save actions are in another section.
Resolution: [111](../specs/111-location-perspective-tilt/spec.md). Add per-location `tiltDegrees` (1–90; default 90 preserves existing profiles), extend the shared metric and its exact inverses/velocities, invalidate on angle edits and validate range. Labelled DEV controls reject incompatible angle/distance edits before mutation, show the needed minimum and expose export/import/local reset. Labels wrap instead of truncating.
Evidence: first focused failure at a requested 1° shore ratio (actual 1); 1/15/30/45/90°, grid, actual chum geometry, live caching and reset/export round-trip covered. Real boat and idle-tackle checks include 30/45° water. Architecture 4, Quick 36, Full 62 pass with unchanged game-cycle baseline. Owner visual/phone acceptance pending.

### G-072 Perspective stays flat through the near half of the green zone (P2, done in v0.41.8)
Found: 2026-10-18, owner, Pages v0.41.7.
Reproduce: enable the DEV metre grid and compare equal chum areas 0, 1 and 2 m from the lower green-zone edge; repeat after pan/rotation.
Expected: perspective compression begins immediately at that lower edge, shared by areas, world scale and physical distances; moving the green zone moves the origin.
Actual: the shipped `linearShare: 0.5` leaves the near half of the water uniform. After G-070 shared that metric with rendering, nearby areas keep the same size and the perspective appears to start mid-water.
Resolution: the location profile uses `linearShare: 0`; the existing shore-based metric, 30 m far edge and shared rendering/physics mapping remain authoritative. No additional projection curve or tool is introduced.
Evidence: `water-metric-check` first failed on an actual chum render radius 1 m from shore; covers cast-area boundaries, equal chum radii, edited bounds and both viewport orientations. Architecture 4, Quick 36, Full 62 pass with unchanged game-cycle baseline. Owner visual/phone checks pending.

### G-071 DEV zones lack a shared metric-grid editor (P3, done in v0.41.7)
Found: 2026-10-18, owner's WebGL/physics follow-up.
Reproduce: inspect all zone categories, compare near/far metre sizes and edit geometry while keeping the scene running.
Expected: one DEV section with optional black background, actual metre grid, independent visibility, live zone/profile edits and bounded cached WebGL redraw; the rod keeps its screen scale.
Actual: controls were scattered, diagnostic zones were raster-only and no metre grid shared the physical metric.
Resolution: [110](../specs/110-dev-zone-editor/spec.md); cached static/moving annotations, the same Canvas fallback and existing runtime override/validation/export flow. Owner phone/visual acceptance pending.

### G-070 World scale and metre distances use different perspective curves (P2, done in v0.41.6)
Found: 2026-10-18, owner's physics/grid audit.
Reproduce: compare the size of equal ground distances and world objects near/far; pan or resize the viewport.
Expected: one water metric for movement, world scale and metre grid; camera zoom applies once, the rod keeps its screen scale.
Actual: WorldPerspective used a separate tangent/angle curve; float, boat bars and waypoint sizes applied different camera factors.
Resolution: shared LocationMap/LocationWaterMetricResolver instances, metric-derived WorldPerspective and consistent world-size camera scale. Spec 109; owner visual acceptance pending.

### G-069 Current carries idle tackle beyond the equipped line (P2, done in v0.41.5)
Found: 2026-10-18, owner, following the WebGL session.
Reproduce: equip 9 m line and a fixed float at 1 m selected depth, cast and leave it drifting in a current; repeat while biting and on perspective water.
Expected: at most 8 m of ground-plane reach from the current rod, the same depth-adjusted budget used by casting and fights; retrieval remains possible.
Actual: waiting/biting integrate drift without a final line constraint, so the tackle can exceed its available line.
Spec: [108](../specs/108-line-and-perspective-audit/spec.md). Re-cast G-068 and boat metres G-007 are already fixed in v0.41.3/v0.41.4.
Evidence: deterministic actual-current regression first failed at an 8 m limit; waiting/biting, uniform/profiled water, fixed/sliding float, feeder/spinning and velocity/retrieval checks now pass. Full 61 checks; game-cycle baseline unchanged. Owner visual check pending.

### G-068 A re-cast aim keeps the rod, line and tackle on screen (P3, done in v0.41.3)
Found: 2026-10-18, owner, index (v0.41.2).
Reproduce: cast, then long-press while the tackle is in the water and aim the re-cast.
Expected: exactly the first aim: the CAST bar and the aim line, no rod, line, tackle or fight areas (spec 099 D3), also while the cast flies; the tackle shows again when it lands.
Actual: `WaitingState.getRenderState` kept `fishing.visible` true and drew the aim over the old tackle; the aim population was duplicated in scouting and waiting.
Notes: one rule `GameState.populateRodCast(target, bounds, aim, inFlight)` for both states, keyed on the aim's visual and the flight. `utils/checks/gameplay/recast-aim-check.js` failed first ("a re-cast aims exactly like the first cast: no rod") and passes now.

### G-066 Post-cast rod speed and line feedback ignore remaining slack (P3, in progress)
Found: 2026-10-17, owner request.
Reproduce: cast off-center, move the rod toward the tackle to create slack, then move away until the free length ends.
Expected: configurable x3 rod speed through slack and x1 after it ends; visible line tightening begins at the same boundary for any tackle.
Actual: constant base speed and visible line tightening on every rod displacement, including movement through slack.
Spec/evidence: [102](../specs/102-cast-line-speed/spec.md). Initial focused speed assertion failed with `405 !== 415`; speed/time partition and rendering regression coverage added. Implemented in v0.41.0: the exact staged gameplay snapshot passed Architecture (4), Quick (29) and Full (55), with unchanged game-cycle baseline. Visual testing and feel acceptance remain with the owner.

### G-064 Rod motion toward the fish cannot compensate a dash (P2, in progress)
Found: 2026-10-17, owner request.
Reproduce: set fight rod alignment false; move the rod toward the fish's occupied side during high tension or a dash.
Expected: progressively relieve real tension only during actual screen motion, faster at higher loads; stop/limits/return/reversal away immediately clear relief.
Actual: existing same-direction multipliers can avoid added lateral tension, but do not relieve existing fish tension.
Spec/evidence: [101](../specs/101-rod-side-tension/spec.md); focused deterministic check first failed at an unchanged 8 kg, now passes; Architecture 4, Quick 29, Full 55 and index/dev browser smoke passed; game-cycle baseline unchanged. Owner play acceptance remains pending.

### G-065 Pre-bite rod motion lacks line and float feedback (P3, in progress)
Found: 2026-10-17, owner request.
Reproduce: cast a float, wait without a bite and move the rod left/right.
Expected: tighten the line with its existing pull response and tilt the float opposite the rod's actual movement; stop releases the response without passive retrieval or depth rise.
Actual: the cast line geometry can move the tackle, but lateral rod displacement does not feed either the line straighten state or the float's pull impulse.
Spec/evidence: [101](../specs/101-rod-side-tension/spec.md); waiting, render-composition and float-impulse deterministic checks pass; Architecture/Quick/Full and index/dev browser smoke passed. Independent live settings default to enabled; owner play acceptance remains pending.

### G-063 Cast rod lateral control and movement-sensitive bites (P2, in progress)
Found: 2026-10-17, owner request, index/dev v0.38.7.
Reproduce: cast, hold A/D while waiting or biting; also evaluate an eligible fish while rod-driven float movement occurred.
Expected: configurable full-range cast control; normal bites release and guaranteed bites hook on actual rod motion; non-spinning rod-driven float motion gives a configurable absolute 0.1% bite chance on the next bite tick.
Actual: lateral screen input is gated to playing; waiting/biting have no such rod-motion rules and bite probability ignores rod-driven float movement.
Spec/evidence: [100](../specs/100-cast-rod-control/spec.md); deterministic `cast-rod-control` check, full validation and owner play acceptance tracked there.
Implemented in v0.39.0: focused check, Architecture (4), Quick (28), Full (54) and index/dev browser smoke passed; game-cycle baseline unchanged. Owner play acceptance remains pending.

### G-061–G-062 Owner reports of 2026-10-15, evening (P2, done)
- G-061 Equipment and keepnet sections collapsed on phones (equipment 0 px tall, tab bar at the top): spec 080 removed the warning row from the inventory modal but kept three grid row tracks, so the main area fell into a content-sized row. Fixed by the hint region row; rule and check: grid templates match the container's children ([spec 086](../specs/086-hint-regions/spec.md)).
- G-062 Hints floated over content: every hint now has an in-flow region at the top of its container that pushes the content down ([spec 086](../specs/086-hint-regions/spec.md)).

### G-059–G-060 Owner reports of 2026-10-15, later (P3, done)
- G-059 Hints had three styles; the keepnet help was clipped by its column and the House notice was fixed to the viewport: one `ui-hint` with a close button, inside its container ([spec 080](../specs/080-hints-in-containers/spec.md)).
- G-060 House clock skipped minutes (01 → 04): it refreshed once per second while game time runs at x240; it now updates on every game minute ([spec 081](../specs/081-house-clock-every-minute/spec.md)).

### G-052–G-058 Owner inventory/input reports of 2026-10-15 (P2/P3, done in v0.36.0)
- G-052 Header bait glyph sat ~4px right/1px low (emoji advance wider than its grid box): one shared ui-glyph centred by measured ink ([spec 073](../specs/073-glyph-ink-centring/spec.md)).
- G-053 Wide header had four sections; header circles did not apply a waiting bait/chum; wide picks switched to the backpack although the list was visible; backpack/keepnet filters and items shared one panel ([spec 074](../specs/074-header-sections-and-collections/spec.md)).
- G-054 Portrait backpack had no backpack stats; filters reserved empty rows; container gaps differed ([spec 075](../specs/075-backpack-pager-and-capacity/spec.md)).
- G-055 Map drags with a rod lacking reel/line showed the equipment warning; dragging over a card selected it instead of scrolling (P2, [spec 076](../specs/076-scroll-input-fixes/spec.md)).
- G-056 Backpack list stopped scrolling vertically after the pager (unstyled wrapper broke the height chain; spec 076 follow-up).
- G-057 Wide left column: tab bar and each section painted their own backgrounds; one sidebar parent now owns it ([spec 077](../specs/077-inventory-sidebar-parent/spec.md)).
- G-058 Portrait rodless rod cell ran under the auxiliary row (viewport estimate of the header): equipment sized from its real row ([spec 078](../specs/078-portrait-equipment-real-size/spec.md)).

### G-051 Switch containers are taller than their tracks/close and desktop placement is left-aligned (P3, done in v0.36.0)
Found: 2026-10-15, owner mobile/landscape reference review.
Reproduce: open the three-bait header in landscape/desktop; browser measured 72px pills versus 44px tracks and close, with the group 259px left of center at a 960px preview.
Expected: common control height, aligned borders and small left item inset in both phone orientations; desktop switch group centered across the upper row.
Actual: independent outer/track/close heights, portrait-only compact styling and a left-aligned group.
Fix/evidence: remove independent outer height and vertical padding, inject one header height into close and switches, share compact geometry across orientations, and use symmetric desktop grid columns. Browser checks at 240–960px confirm equal height/top edges, fitting five-slot contents and zero desktop center offset.
Validation: real index 1280×800 and DEV 600×340 show 44px for every pill/track/close with aligned top edges and no console warnings/errors; Architecture 4/4, Quick 25/25 and Full 51/51 pass.

### G-050 Backpack items have no separate rounded container (P3, done in v0.36.0)
Found: 2026-10-15, owner portrait backpack review.
Reproduce: open the backpack; its transparent item panel merges with the large backpack illustration behind it.
Expected: one opaque rounded item container like the equipment panels, filling all free space with style-consistent padding and insets.
Actual: the portrait override deliberately removes the panel background and boundary.
Fix/evidence: reuse the existing inventory-panel mix, equipment background and panel radius; remove the transparent override and reserve a bottom inset. Browser verifies an opaque rounded full-height panel, four columns and internal scrolling.

### G-048 Narrow bait cells clip art and expose square selection borders (P3, done in v0.36.0)
Found: 2026-10-14, owner's 336px screenshot with two worms and cast chum.
Reproduce: select a header bait slot; artwork sits in a roughly 17px-wide, 30px-tall cell and receives a square outline.
Expected: complete artwork inside separated circles, a circular border only for selection/focus, and opaque automatic-mode surfaces.
Actual: art is squeezed/cropped, selection is rectangular, and active background tints are transparent.
Fix/evidence: one shared switch style owns circular artwork, count separation and opaque state colors. Browser checks at 240–960px cover three bait/two chum slots, round bounds and non-overlapping counts.

### G-049 Header weight uses space needed by bait icons (P3, done in v0.36.0)
Found: 2026-10-14, owner portrait header review and fixed-100kg clarification.
Reproduce: open the narrow header with multiple bait slots, weight and close button.
Expected: weight as a lower row inside inventory-header, with a 100kg scale and icon left; 1kg fills 1%. Mobile spans the header content width; desktop follows the left panel width.
Actual: the weight badge competes for header width and has no scale.
Fix/evidence: separate header load row, shared header/main column properties, presentation config and a small renderer that reuses the shared resource meter. Focused checks cover lower-header containment, 1%/100% clamping and stable meter nodes; browser verifies mobile width and exact desktop-column alignment.

Validation for G-048–G-050 (2026-10-15): Architecture 4/4, Quick 25/25 and Full 51/51 pass with the unchanged
game-cycle baseline. Index/DEV browser smoke confirms the header-contained scale and rounded backpack panel;
DEV warning/error logs are empty. Owner visual/play acceptance is pending.

### G-042 Portrait inventory header changes composition at 520px (P3, done in v0.36.0)
Found: 2026-10-14, owner browser review.
Reproduce: use three bait slots and resize portrait through 520/521/600px while the side panel is hidden.
Expected: proportional header geometry through 820px, with numbers below artwork and all controls inside the row.
Actual: desktop icon dimensions appeared above 520px; icons/counts overlapped and controls stopped fitting.
Fix/evidence: one header unit and coordinated 820px composition; browser geometry checks at 240/280/319/320/520/521/600/740/820px confirm fitting pills and separated counts. The side panel appears at 821px.

### G-043 Equipped bait keeps the generic placeholder (P3, done in v0.36.0)
Found: 2026-10-14, owner portrait inventory review.
Reproduce: equip a worm whose catalog art is an emoji rather than an image URL.
Expected: actual equipped bait artwork replaces its empty-slot placeholder.
Actual: the generic bait SVG took precedence over the item's icon.
Fix/evidence: shared renderer chooses actual image/icon for filled slots; focused check and index/dev browser checks show the worm artwork.

### G-044 Automatic switch loses its movement on refresh (P3, done in v0.36.0)
Found: 2026-10-14, owner portrait inventory review.
Reproduce: toggle automatic bait and inspect thumb positioning and DOM identity.
Expected: working checkbox, smooth transform animation and retained focus across mode/numeric updates.
Actual: layout overrides made the thumb static and full header replacement interrupted its transition.
Fix/evidence: restored transform track, in-place header/switch updates and listener disposal checks; browser confirms transform changes and the shared 180ms transition in index/dev.

### G-045 Equipping from backpack leaves the changed equipment out of view (P3, done in v0.36.0)
Found: 2026-10-14, owner portrait inventory review.
Reproduce: equip a rod from the backpack into an empty rod slot.
Expected: return to equipment and flash the changed slot green once.
Actual: the item equipped but the backpack stayed open without this feedback.
Fix/evidence: transient feedback revision, automatic section selection and one-shot CSS flash; focused command/UI checks and production browser confirm rod tab/flash and no replay on refresh.

### G-046 Bare hook opens an empty crafting menu (P3, done in v0.36.0)
Found: 2026-10-14, owner portrait inventory review.
Reproduce: select a compatible loose hook after equipping a rod and line.
Expected: equip directly; bait is chosen through the header.
Actual: the removed bait socket left the player in an empty craft editor.
Fix/evidence: atomic prepare/equip through existing assembly operations; focused integration and production browser confirm equipment tab, fitted hook and no craft panel.

### G-047 Consumable counts ignore manual mode and duplicate uniform bait stock (P3, done in v0.36.0)
Found: 2026-10-14, owner count clarification.
Reproduce: fill three hooks with different baits, disable automatic mode, then use three identical baits.
Expected: manual mode shows total 3 and 1/1/1 for different baits; uniform filled slots show only the total in both modes. Automatic mode shows deduplicated available reserve.
Actual: backpack reserve remained visible in manual mode, and identical slot counts repeated the same pool.
Fix/evidence: the manual-mode regression failed before the fix; focused renderer, reserve-signature and integration checks cover modes, freshness/variant identity and partial targets. Browser confirms 102 + 12/80/10, 3 + 1/1/1, uniform automatic 12/manual 3 with hidden individual counts.

Validation for G-038–G-047: Architecture 4/4, Quick 25/25 and Full 51/51 pass; game-cycle baseline unchanged.
Index/dev browser smoke passes with no warning/error logs in the changed flow. Behavior is documented in
[inventory-behavior.md](inventory-behavior.md). Owner visual/play acceptance is pending.

### G-041 Header pills hide a third bait and its reserve (P3, done in v0.36.0)
Found: 2026-10-14, owner `inventory-switcher-mob-v2.png` sketch.
Reproduce: equip three different baits with backpack reserves 12/80/10 and leave cast chum empty.
Expected: three separate icons with their quantities below, total 102 beside A, an empty pill with total zero, and a compact close button in the mobile header row.
Actual: the earlier compact contract capped the icons at two and showed no individual reserves.
Fix/evidence: spec 072 v2 header; focused checks failed before the change and pass for exact reserves, deduplicated totals and independent third-slot replacement. Architecture, Quick and Full required; owner visual acceptance pending.

### G-038 Backpack shortcut reopens the previously selected keepnet (P2, done in v0.36.0)
Found: 2026-10-14, owner portrait inventory review.
Reproduce: open keepnet, close the inventory, then press the location backpack button; also press backpack while keepnet is open.
Expected: select the requested backpack section; pressing its shortcut while already there closes it.
Actual: the generic toggle reopened keepnet or closed the wrong section.
Fix/evidence: section-specific shortcut; the focused UI regression failed before the fix and passes after it.

### G-039 Bait selection remains nested inside hook crafting (P3, done in v0.36.0)
Found: 2026-10-14, owner portrait inventory review and sequential-selection clarification.
Reproduce: equip one/two hooks, then try to select or replace bait through the header; inspect hook cards.
Expected: available header icons, one-click sequential filling, one proposed replacement with repeat-click confirmation; worm beside worm + bread proposes replacing bread.
Actual: the icons only toggled automatic mode; hooks exposed nested bait compartments and selection.
Fix/evidence: spec 072; focused checks verify exact stock changes, no mutation during proposal, highlighting, cancellation and lock policy. Owner visual acceptance pending.

### G-040 Chum header includes hand and boat supplies (P2, done in v0.36.0)
Found: 2026-10-14, owner portrait inventory review.
Reproduce: equip cast chum, hand chum and boat cargo, then inspect the header pill.
Expected: only cast-tackle chum and its refill stock; configured multiple slots follow the bait icon contract.
Actual: the header combined all three sources and showed multiple unrelated portions.
Fix/evidence: tackle-only target projection and refill scope; the focused integration regression failed before the fix and passes after it.

### G-036 House day/night images step instead of blending (P3, done in v0.36.0)
Found: 2026-10-14, owner House review against the test location.
Reproduce: open the House around 17:00–21:00 or 05:00–09:00 game time (timeScale 240, optionally DEV ×5) and watch the room art.
Expected: the same continuous crossfade and layer composition as the test location.
Actual: opacity changed only on the 1 s House refresh (3–17 % jumps); the House always stacked three layers.
Fix/evidence: shared `timeOfDayLayers` for location Canvas and House DOM; House blends each refresh with a linear CSS transition. Map/House layer and no-write checks in house-check. Spec 063; owner visual acceptance pending.

### G-037 House DevTools ignore aquarium visual edits and miss validation (P3, done in v0.36.0)
Found: 2026-10-14, owner DEV House review.
Reproduce: dev.html → House, DevTools → CONFIG.liveBait.visual: change gridSizePx or showZone.
Expected: the aquarium grid/zone reacts immediately; House DevTools validate edits like the location page.
Actual: the motion keeps the startup snapshot of the frozen liveBait config; no validation, production item catalog.
Fix/evidence: House startup applies `config-updated` visual edits; shared DEV validation composition. The startup check failed before the fix. Spec 064; owner check pending.

### G-033 Selected feed is separate from active information and cannot reopen its list (P3, done in v0.35.0)
Found: 2026-10-14, owner House review and compact-text correction.
Reproduce: choose a feed, inspect the remaining open list, plain preview and separate active-feed caption; try clicking the preview to change the draft.
Expected: one shared item row right of the equal-height action; selection closes the list, preview reopens it, text is compact and warnings remain below. Disabled action reads Load when reserve exists.
Actual: list remains open, preview lacks row styling/quantity, active information is duplicated and preview cannot reopen selection. Putting the warning inside the row makes it oversized.
Fix/evidence: the focused selection-close check failed before the fix. One row template/style now owns preview/list rendering; countdown and available-stock label checks pass with stock, failure and remount scenarios. Spec 062; owner visual/input acceptance pending.

### G-034 Desktop menu changes height while the mouse moves between its buttons (P3, done in v0.35.0)
Found: 2026-10-14, owner mouse review.
Reproduce: hover a compact dock button, then move through a gap or handle without leaving the container.
Expected: hold container height while the cursor remains inside; the handle has no hover highlight and cannot initiate expansion.
Actual: individual hover loss shrinks the container and shifts its handle/buttons; the handle also highlights.
Fix/evidence: HouseView latches desktop mouse hover until dock exit, with a CSS minimum height matching the compact/full button transition. Focused checks cover gaps, handle, exit, touch/hybrid policy, 100 events/one write and listener disposal. Shared handle custom property removes only this instance's hover background. Owner visual/input acceptance pending.

### G-035 House buttons stay full-width on desktop and repeat stat words (P3, done in v0.35.0)
Found: 2026-10-14, owner layout request.
Reproduce: inspect House install/upgrade actions in landscape and aquarium target level/capacity.
Expected: content width with padding in landscape, full container width only in portrait, and shared level/fish icons with target numbers in upgrade.
Actual: actions are always stretched, and upgrade repeats level/capacity words.
Fix/evidence: responsive container styles and a shared SVG symbol source implement the layout; numeric target/accessible-name and shared catalog checks pass. Owner visual acceptance pending.

### G-029 Aquarium refeeding discards time and can consume fresh packs repeatedly (P2, done in v0.35.0)
Found: 2026-10-14, owner feeding-mechanic request.
Reproduce: load Simple, immediately load Premium, or load it at exactly half of the Simple duration.
Expected: reject choice/loading before 50% elapsed; then add new protection to the remainder, display the latest feed and restart the gate.
Actual: every load immediately consumes inventory and replaces the previous protection.
Fix/evidence: the initial deterministic regression failed on immediate fresh-pack consumption. Shared domain budget, command gate and snapshot v5 carry preserve time and inventory across reload/offline, population changes, stale second-page commands and transaction recovery. Spec 061; Architecture 4/4, Quick 25/25, Full 51/51 and console-only smoke pass. Owner play acceptance pending.

### G-030 Feed rows consume immediately and require plus/quantity controls (P3, done in v0.35.0)
Found: 2026-10-14, owner House request.
Reproduce: open feeding, press a row's plus control; compare one-pack and multi-pack stock behavior.
Expected: whole-row selection of exactly one draft; the main action becomes Load and consumes one pack only after confirmation, with the selected item previewed on the right.
Actual: one pack consumes immediately; larger stocks open a quantity dialog.
Fix/evidence: production picker replaces the dialog with semantic row buttons, shared selected styles, deferred confirmation, lock explanation/focus and changed-stock handling. Catalog uses the same picker and time policy. Focused picker/catalog lifecycle checks pass; owner visual/input acceptance pending.

### G-031 Aquarium counter position and reserve row no longer match the owner layout (P3, done in v0.35.0)
Found: 2026-10-14, owner revised layout.
Reproduce: inspect level/capacity status and the reserve text in the House panel.
Expected: label on the left, count on the right, scale below; the reserve row is replaced by feeding and its item preview.
Actual: counts are below the scale/label per the earlier layout request, and reserve text consumes a separate row.
Fix/evidence: shared parameter headers and production HTML implement the new layout; focused House markup checks and the actual catalog view pass. Supersedes G-027's count/reserve placement. Owner visual acceptance pending.

### G-032 Initial aquarium fish and swimming zone are too small (P3, done in v0.35.0)
Found: 2026-10-14, owner visual tuning request.
Reproduce: use the initial visual configuration in the House/catalog aquarium.
Expected: nominal fish size 60px and relative zone width 0.80.
Actual: size 10px and width 0.65.
Fix/evidence: configuration values changed with their existing origins, height, spread and boundary-fitting policy retained. Deterministic motion checks still keep every fish inside its zone. Owner visual acceptance pending.

### G-026 House sheet disappears below the viewport and jumps back on release (P3, done in v0.35.0)
Found: 2026-10-14, owner visual/input review.
Reproduce: drag a sheet handle down and release; drag upward on desktop.
Expected: smooth height collapse ending at the persistent compact footer, without a reset or replayed entrance animation.
Actual: release resets the drag transform before dismissal, full-sheet translation goes offscreen, then the compact footer returns; removing drag state can restart the entrance animation.
Fix/evidence: shared height animation replaces translation/keyframes; dismissal is selected before visual reset. Focused checks cover the release value, compact target, upward settling, scaled coordinates, cached geometry, bounded resize writes and complete cleanup. Owner visual/input acceptance pending.

### G-027 Aquarium status duplicates upgrade text and scatters counts/actions (P3, done in v0.35.0)
Found: 2026-10-14, owner House review.
Reproduce: inspect aquarium level/capacity/feed stock and compare aquarium/auto-feeder install buttons.
Expected: readings below level scales; continuous grey/free-capacity meter filled green-to-red by occupancy; reserve within status; one target level/capacity upgrade label and uniform primary install actions.
Actual: right-hand capacity count, duplicate next-level list, separate reserve row and differently styled feeder installation.
Fix/evidence: production markup and shared meter/button styles implement the layout; funded/unfunded presenter ports and occupancy boundaries are checked. Current prices remain zero and production has no wallet; no payment/save behavior is introduced. Catalog adds full/unaffordable examples. Owner visual acceptance pending.

### G-028 Automatic feeder remains interactive without usable stock (P3, done in v0.35.0)
Found: 2026-10-14, owner House review.
Reproduce: install/enable feeder, exhaust its reserve, then inspect or attempt to change the switch.
Expected: bare slider without an outer pill; disabled/inactive while no usable feed remains, with the enabled model preference retained.
Actual: nested outer pill and an active enabled switch with empty stock.
Fix/evidence: the empty-stock check fails before the fix. Shared compact switch styling removes the outer container; selected-stock availability controls disabled/checked display and disabled events cannot dispatch. Catalog no-feed state reuses the same sources. Owner visual/input acceptance pending.

### G-025 House footer lacks reference states and explicit touch navigation (P3, done in v0.35.0)
Found: 2026-10-14, owner screenshots and touch clarification, fisherman-house.
Reproduce: compare closed/hover/open footer states; on a phone swipe upward, choose a section and then another miniature; swipe down over the backdrop.
Expected: compact accessible icon row; upward gesture reveals all names; selected section opens with other buttons miniature; direct switching and downward dismissal work without hover. Mobile fills available width, wide layouts are capped; footer glass reuses header styling and has no black gradient.
Actual: footer is fully hidden by default, labels always visible when shown, hover only lifts 12px, a black gradient/glow is retained, and open-sheet backdrop cannot receive the scene swipe.
Fix/evidence: the compact-footer accessibility check failed before the change. Production HTML, HouseView, shared sheet handles/gesture adapter and one CSS owner implement all states. UI catalog demonstrates the same compact/expanded/open states. Footer/sheet bottom borders are removed. Focused contracts verify switching, gesture cancellation, scaled handles, focus/disposal and styling reuse; Architecture 4/4, Quick 25/25, Full 51/51 and console-only loads pass with the unchanged game-cycle baseline. Owner visual/input acceptance pending.

### G-021 Fullscreen border differs from adjacent controls (P3, done in v0.35.0)
Found: 2026-10-14, owner review, shared game/House HUD.
Reproduce: compare fullscreen with the clock and other buttons.
Expected: common border thickness and appearance.
Actual: fullscreen uses a 1px green border while neighbouring controls use 2px borders.
Fix/evidence: HUD and toolbar share border width/color tokens; fullscreen no longer overrides the border. Shared style contracts and owner visual acceptance apply.

### G-022 Version jumps above bottom actions on narrow screens (P3, done in v0.35.0)
Found: 2026-10-14, owner review, index/dev v0.34.4.
Reproduce: shrink the viewport through 520px with the version badge visible.
Expected: version stays at the bottom action edge with equal height/gaps; excess text clips horizontally.
Actual: a media query changes the badge's bottom offset from 8px to 72px.
Fix/evidence: one composed `GameToolbar` flex row owns bottom placement and visible action spacing; badge shrink/clip has no breakpoint jump. Focused lifecycle/style contracts cover planned widths 240–1920px and production/DEV startup cleanup. Owner visual acceptance pending.

### G-023 Opposite House gesture switches panels immediately (P3, done in v0.35.0)
Found: 2026-10-14, owner review, House navigation.
Reproduce: open the header, then swipe/scroll upward once; reverse from the open category menu.
Expected: first close the opposite zone, then open the requested zone with another gesture; wheel input controls panels only.
Actual: one gesture switches zones; multiple wheel events can issue multiple commands and horizontal wheel pans the room.
Fix/evidence: `house-check` and `house-navigation-check` failed before the fix. State transitions close before opening; a direction/idle-gap wheel latch emits one command per burst without horizontal pan. Inventory wheel behavior is preserved. Owner input acceptance pending.

### G-024 House sheet floats above the bottom and mismatches dock width (P3, done in v0.35.0)
Found: 2026-10-14, owner review, room/aquarium/bait sheets.
Reproduce: open any category sheet on mobile or desktop.
Expected: sheet touches the bottom edge; buttons sit within its width with side insets of 20px mobile / 40px desktop.
Actual: sheet bottom is 94/106px above the screen and its 740px maximum width differs from the 1100px dock.
Fix/evidence: shared outer width and dock-height tokens anchor sheets at zero bottom, reserve content clearance and set the requested button insets. Focused CSS geometry contracts pass; owner visual acceptance pending.

### G-020 House navigation prototype leaves gaps on ultra-wide screens (P2, done in v0.35.0)
Found: 2026-10-14, owner review, House navigation prototype.
Reproduce: choose a 21:9 or wider viewport and inspect the room's left/right sides.
Expected: fill the viewport using the same cover principle as the test location.
Actual: height-only art sizing leaves empty side regions when the viewport is wider than the artwork.
Fix/evidence: art width uses `max(viewport width, viewport height × artwork ratio)` with centred vertical overflow. All five room levels are verified as 2752×1536. The focused CSS geometry contract covers 21:9 and 32:9; final visual acceptance belongs to the owner.

### G-018 House interior cannot be explored (P2, done in v0.35.0)
Found: 2026-10-14, owner request, Fisherman's House v0.34.4.
Reproduce: open the separate House page on a portrait viewport and drag or wheel over the room artwork.
Expected: pan through the full room with the map's inversion/sensitivity/distance settings; HUD and lower panels retain their screen positions.
Actual: the artboard is centred in a clipped scene; gestures only toggle the header/dock.
Fix/evidence: `utils/checks/ui/house-navigation-check.js` failed on touch movement before the fix. House composes the existing horizontal scroll adapter with manual scene gestures, physical/logical coordinate conversion and `input.mapPan`. Horizontal gestures pan the room; vertical gestures reveal header/menu, and background clicks toggle the zones. See [House navigation contract](../specs/060-house-navigation-header/spec.md). Commit and owner input acceptance pending.

### G-019 House header duplicates and relocates shared HUD controls (P3, done in v0.35.0)
Found: 2026-10-14, owner request, House/test comparison v0.34.4.
Reproduce: compare the clock/fullscreen controls on the test location and House, including accelerated DEV time.
Expected: reuse the same HUD components in one row with equal heights; scale the entire row when needed. The latest owner instruction adds borderless Play/category buttons and tap/swipe sheet dismissal.
Actual: clock/fullscreen have separate House sizes/positions and a scroll-controlled header; accelerated DEV time rearranges its rows.
Fix/evidence: common `hud-control` styles, `FullscreenControl` and `TimeDisplay`; bounded `HudRowSizer` adapts the single row. Header/menu visibility follows scene gestures, while shared sheet handles close panels with preserved focus/Escape and no cross. Architecture 4/4, Quick 25/25, Full 51/51 pass; console-only startup checks are clear. Commit and owner visual/input acceptance pending.

### G-016 Missing-rod warnings interrupt map navigation (P2, done in v0.35.0)
Found: 2026-10-14, owner request, index/dev v0.34.4.
Reproduce: with no equipped rod, press the map and drag horizontally with a finger or mouse.
Expected: distinguish a completed click from navigation; allow map exploration without opening Inventory. Equipped casting/fight and chum aiming keep their gestures.
Actual: power casting warns on pointerdown, and the viewport rejects panning while the pointer is held.
Fix/evidence: `utils/checks/ui/scouting-input-check.js` failed on the early warning before the fix. Pointer navigation is latched per gesture, accumulates movement between frames and supports injected inversion, sensitivity, distance and wheel settings. See [map input contract](../specs/059-map-navigation-input/spec.md). Commit and owner feel acceptance pending.

### G-017 Clock clicks fall through to fishing input (P2, done in v0.35.0)
Found: 2026-10-14, owner request, HUD clock in index/dev v0.34.4.
Reproduce: click the passive clock or disabled DEV time control without an equipped rod.
Expected: the clock owns its hit area in every state; enabled DEV acceleration clicks change time without a fishing warning.
Actual: the base clock has `pointer-events: none`, and only the active DEV variant intercepts hit testing.
Fix/evidence: the base clock accepts pointer hit testing and all clock variants use the existing UI event shield; focused coverage checks passive/disabled shielding. Commit and owner browser acceptance pending.

### G-009 DEV calendar acceleration (P3, done in v0.35.0)
Found: 2026-10-14, owner request, DEV game and Fisherman's House v0.34.4.
Reproduce: enable calendar acceleration under DEBUG and repeatedly click the time display.
Expected: DEV-only ×1.5 steps of0.5 through×5, then×1; the hours, day/night phase and House lighting advance together; production receives no acceleration rate. See [spec058](../specs/058-dev-time-controls/spec.md).
Actual: time display is passive, no controlled acceleration cycle, and House has no DEV tools.
Notes: transient multiplier on the shared calendar clock; fishing/real-time care remain unchanged. Validation/commit status recorded separately from owner browser acceptance.

### G-008 Live bait and aquarium care are not implemented (P2, in progress)
Found: 2026-10-11, owner request, index/dev v0.32.1.
Reproduce: land a 0.100 kg `crucian_stalker`, open the catch outcome, then inspect Inventory and the house page.
Expected: a third action converts the exact catch into live bait; the keepnet or fed aquarium owns its survival timer, and one selected survivor can be cast once. See [spec 055](../specs/055-live-bait-aquarium/spec.md).
Actual: Claim/Release only return to scouting; no caught-fish storage, survival, house runtime, or live-bait cast path exists.
Notes: use a fake clock and seeded RNG to check eligibility, single disposition, death/feeding, reload, and one-hook consumption.

### G-001 Fish developer diagnostics in the production console (P3, open)
Found: 2026-10-10, Claude, reading the fight composition (v0.32.0).
Reproduce: `index.html`, fight a fish until it is exhausted in phase 2, or until it breaks out of the centre while
mastery is applied.
Expected: the production console stays empty during a fight (the rule from spec 020).
Actual: production composition injects `ConsoleLogger` as the fight logger
(`bootstrap/production/fishing_services_composition.js`, `fightLogger`). `Fish` logs `[DEBUFF] …` and `[MASTERY] …`
lines through it.
Notes: confirmed by reading the code; not yet reproduced in the browser. Likely fix: production composes no fight
logger (or an inactive one) and DEV composes the console logger.

### G-003 Item cards show raw values instead of the display map (P3, open)
Found: 2026-10-11, Claude, browser check of spec 050 (dev.html).
Reproduce: open the inventory and hover the day float.
Expected: "Огрузка: Легка", "Кріплення: Глухий" (the `displayStats` maps in the item catalog).
Actual: "Огрузка light", "Кріплення fixed".
Notes: `InventoryItemParametersResolver` first adds rows from the raw effective stats. The mapped `displayStats` row
with the same parameter id is then skipped as already rendered.

### G-007 Bait boat ignores the water metric (P2, done in v0.41.4)
Found: 2026-10-11, owner request after spec 053; verified by reading the code (develop b2aa5b1e).
Reproduce: test location (30 m profile), send a bait boat to the far edge of the castable water.
Expected: the boat keeps its speed in metres everywhere, so far away it covers fewer map pixels per second, like the
tackle since 053.
Actual: `BaitBoat.update` integrates speed, braking, arrival radii, sensors and drift in map pixels; far away it is up
to ≈ 6.4× faster in metres.
Notes: task in [054](../specs/054-bait-boat-water-metric/spec.md) (ground plane scope around `boat.update`, like
`GroundPlaneScope`). Done 2026-10-18: `BaitBoatGroundPlaneScope` wraps every boat update in `ChumService.updateBoats`.
Before it, on a 40 m profile a level-1 boat crossed 18–22 m at 13.0 m/s against 3.0 m/s near the shore; now 3.0 m/s
both. `utils/checks/gameplay/bait-boat-water-metric-check.js`: flat-lake equivalence there and back with a queued waypoint, uniform
identity, map output; skipping the heading, avoidance heading, velocity or waypoint conversion each fails it.

## Owner play notes

## Fixed in v0.33.1

### G-009 Retained catches lose rarity and live-bait art (P2, done)
Found: 2026-10-12, Keepnet review.
Reproduce: retain a catch with numeric rarity 3/12, convert it and reload.
Expected: both catch and live bait show the same image and rating.
Actual: the save accepted strings only and discarded numeric rarity; live-bait views omitted art.
Fix/evidence: validated snapshot v2 and v1 migration; `keepnet_lifecycle_scenarios.js` failed on the missing rating before the fix and passes after it. Lost historical ratings remain unknown.

### G-010 Live-bait display and candidates disagree with elapsed care (P2, done)
Found: 2026-10-12, Keepnet review.
Reproduce: advance a fake clock past life expiry before the 10-second care tick, or keep the same species in a fed aquarium and an unfed keepnet.
Expected: expired fish are unavailable; aquarium feed protects only aquarium residents.
Actual: selected bait remained an attraction candidate; keepnet countdown incorrectly reused aquarium protection; auto-feed projection was absent.
Fix/evidence: detached event-time read projection, exact hook expiry check and persisted elapsed care even when a command is rejected; deterministic clock checks pass.

### G-011 Hook return can overflow the keepnet (P2, done)
Found: 2026-10-12, Keepnet review.
Reproduce: use a one-slot keepnet, cast its live fish, claim another catch, retrieve the bait.
Expected: capacity reserves the returning individual.
Actual: a hook freed its slot and retrieval could exceed capacity.
Fix/evidence: hook reservation and aquarium-cast capacity check; capacity regression passes.

### G-012 Automatic feeder ignores a nonzero configured trigger (P2, done)
Found: 2026-10-12, Keepnet review.
Reproduce: configure 50% trigger and ten-second feed duration, advance six seconds with one spare portion.
Expected: refill at five seconds, then display 90%.
Actual: settlement only scheduled feed exhaustion, leaving 40% at six seconds.
Fix/evidence: schedule the configured threshold as a care event; online/read/offline projections agree at 90%.

### G-013 Reload strands a living bait on an interrupted hook (P2, done)
Found: 2026-10-12, Keepnet review.
Reproduce: reload a fishing session after moving a selected fish to hook.
Expected: the surviving individual returns to the keepnet with remaining life.
Actual: new session has no cast ID but saved fish stays on hook and blocks selection.
Fix/evidence: fishing bootstrap explicitly recovers interrupted casts; house startup preserves active casts; reload checks verify life and identity, with no resurrection.

### G-014 Keepnet cannot inspect same-species catches clearly (P3, done)
Found: 2026-10-12, owner request.
Reproduce: retain several fish of one species with different weights and images.
Expected: one species thumbnail/count and a same-dialog list of individuals with weight and rarity.
Actual: flat text-only cards, no details and a full DOM rebuild every countdown tick.
Fix/evidence: species projection, card renderer and stable dialog refresh; `keepnet-check.js` covers navigation, exact IDs, images, ratings, actions, filters and focus.

### G-015 Full aquarium/keepnet outcomes lack a visible explanation (P2, done)
Found: 2026-10-12, spec 055 T051 and Keepnet review.
Reproduce: convert at victory with a full aquarium, or claim into a full keepnet.
Expected: show fallback destination or rejection and allow retry after freeing capacity.
Actual: fallback closed silently; rejected claims gave no feedback.
Fix/evidence: committed outcome metadata and injected presentation callback open Keepnet with the reason; victory retry/duplicate-input checks pass.

Add observations here in any form; Claude turns them into numbered entries.

## Done / verified

### G-119 The bait boat runs on a battery (P2, done)
Found: 2026-10-25, owner (spec 143): the boat's energy lived only in the session (`BaitBoat.energy`, `ChumService.#boatEnergy`), a reload restored a full boat, and an idle boat started at `boatItem.maxEnergy || 100` whatever its level (the catalog authors 60/90/120 per level).
Expected: one power system for devices; the boat consumes the battery in its slot while it is in the water (moving 12 units/s × level factor 1, 2/3, 1/2 = 5, 7.5, 10 min per 3600-unit battery; waiting at the spot a third; idle and drifting 0), the charge is saved and only falls, and the boat does not start without a charged battery.
Resolution (v0.47.25): battery item and `battery` slot (commit 46047ceb), `DevicePowerService` + `BoatPowerRatePolicy`; `BaitBoat` drifts through `runOutOfPower()`; `maxEnergy`/`energyDrainPerSec` and `ChumService.getBoatEnergy` removed. Starting inventory and existing saves get one battery (not inserted); the boat starts without one (D-P4, D-P7).
Evidence: `device-power` check (catalog rates, 300 s on 16 ms steps without the wall clock, writes, clamp, flush, tabs, grants, drift); the chum controller scenario refuses a boat without/with an empty battery; game-cycle report unchanged (it stubs the boats). Owner play check pending.

### G-118 Deleting the last castable zone breaks the game (P2, done)
Found: 2026-10-22, owner (TK-051): the zone editor silently refused to delete the only castable zone, because `LocationMap.getCastableBoundsVirtual` returned null without castable zones and the water metric, camera and rod read its bounds every frame.
Resolution (v0.46.18): without castable zones the bounds span the whole map grid and no cell is castable, so every cast is refused; the editor deletes any zone. Production locations always author castable zones, so play is unchanged.
Evidence: silent game-cycle assertion (whole-map bounds, no castable cell); game-cycle report unchanged.

### G-117 Zone physics on by default (P2, done)
Found: 2026-10-22, owner (TK-049, spec 129): the lake's obstacles, snags and moving fish school were authored but switched off by default.
Expected: every zone category takes part in the game by default; the zone editor starts with the zone areas and depth numbers hidden.
Resolution (v0.46.16): `CONFIG.locations.enableCollisions`, `enableSnags`, `enableDynamicZones` default to true (`enableCastable` already was). Production effect on the lake: casting into the 3x2-cell obstacle is refused, the 14x8-cell snag area on the right is active, and the moving x1.5 fish school is live. The zone editor's "Показати зону" switches start off; the depth numbers stay off.
Evidence: game-cycle report unchanged (its world scenario sets all four flags explicitly; the fight scenarios use no zones); zone-editor check asserts the hidden defaults. Owner play check pending.

### G-067 DEV page does not start on a fresh browser profile (P2, done)
Found: 2026-10-18, spec 103 stage 0 browser smoke (dev.html, v0.41.0; the same on the unchanged commit 4327ca8).
Reproduce: clear the site data (or use a new browser profile), open dev.html.
Expected: DEV starts with the starting inventory, like index.html does for a new player.
Actual: black canvas and no console output. Startup rejects with `TypeError: Starting inventory supports items and settings only (equipment: none; build templates: debug_float_build, debug_feeder_build)` from `StartingInventorySnapshotFactory`, and the DEV entry swallows the rejection. Opening index.html once (it writes the inventory save) lets dev.html start.
Resolution (v0.41.1): per the owner, both DEV build templates are obsolete and removed entirely, including the free shop. Removed `src/dev/data/dev_item_catalog.js`; DEV now injects the production `ITEM_DB` into startup, validation and DevTools. Failed shared startup reports the original error once through `ConsoleLogger`, while preserving cleanup, rejection and retry. Existing save data and inventory migration remain unchanged.
Evidence: the focused fresh-start regression first failed with the exact `StartingInventorySnapshotFactory` TypeError above and passes after the fix; the lifecycle check also covers console reporting, shared startup and retry. Architecture (4), Quick (32) and Full (58) passed with the game-cycle baseline unchanged. Browser smoke: fresh DEV and production origins start, the DEV starting inventory opens, and the console reports no startup errors. No utility, fixture, dependency or package script became obsolete; existing checks were updated for the shared catalog.

- Stage 6 defect: Fixed Catch with a spinner/wobbler/jig bite read the nonexistent `CONFIG.float.biteSequence`.
  Verified fixed 2026-10-10 by reading the code: `FixedCatchHook` takes the sequence from
  `BiteRules.selectBiteSequence` and creates no fish when there is none.
- Stage 6 defect: `DepthSelectorUI` requested an animation frame after `dispose()`. Verified fixed 2026-10-10 by
  reading the code: `DepthSelector` tracks pending frames, cancels them in `dispose()` and refuses new ones once
  disposed.
- G-002 Sliding float: done in [050](../specs/050-sliding-float/spec.md). A new catalog item; with it the selected
  depth costs no cast distance. Max depth stays line − rod, and the fixed float keeps line − depth.
- G-004 DEV item grant: done in [051](../specs/051-dev-item-grant/spec.md). DevTools → "🎁 ВИДАТИ ПРЕДМЕТ" adds any
  catalog item to the inventory, including the sliding float.
- G-005 Depth selection UX: done in [052](../specs/052-depth-selector-ux/spec.md). A float button with a slide-down
  depth track; while the track is open, a dashed cast limit line dims the unreachable water. The cast bar is removed.
  The owner checks the visuals.
- G-006 Perspective metres on the water: done in [053](../specs/053-water-metric/spec.md). One water metric per location
  (`MAP_DB.<id>.distanceProfile`, live in DevTools); casting, the fight and the tackle run in ground metres. The test
  location reaches 30 m at its far edge. Accuracy stays in map pixels (owner). Owner play check pending: hand chum reach (13.6 m).

### Shared aquarium feeding and safe fish stacks (2026-10-12, P2)

Reproduction: retain several species, add feed and let it expire; current care allocates separate species slots and uses keepnet lifetimes, while equal-death random order is unused. Keepnet groups special catches with ordinary catches. Expected: one shared three-quality pack bar, population penalties, saved independent starvation deadlines within 1/3/6 hours, and separate special-fish cards with rarity/weight stack representatives. Spec: specs/055-live-bait-aquarium/spec.md, T059–T065. Focused deterministic coverage is recorded in quickstart after validation.

### Inventory aquarium feed and phone filters (v0.34.1, P2)

Reproduction: DEV shop cannot grant aquarium packs; feed is held outside inventory, house acquisition lists every pack even without stock, and the touch shield/pan-y rule prevents horizontal phone scrolling. Expected: inventory-owned packs, grouped free DEV shop, available-only feed rows with exact quantity dialog, and native kinetic scrolling without toggling a checkbox during a swipe. Specs/055 FR-030–FR-035 and T066–T071.
