# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.46.20 - Zone Editor Revision 3

- Zone editor: check the zones to edit (2 px outline, fill under the pointer), move a whole zone from its middle 30%; the fullscreen button hides with the game UI.

## v0.46.19 - DevTools from the Left Edge

- While the zone editor is on, the DevTools button hides too; the panel opens from the left screen edge (mouse hover or swipe right).

## v0.46.18 - Zone Delete and Editor Screen

- The zone editor deletes any zone, the last one too; while it is on, the game's buttons and windows are hidden.

## v0.46.17 - Perspective Grid Off

- Turning the zone editor on shows the cell grid only; the perspective grid stays off until switched on.

## v0.46.16 - Zone defaults

- Zone physics of every category is on by default (obstacles, snags, moving fish school); the zone editor starts with zone areas and depth numbers hidden.

## v0.46.15 - Zone Editor Revision 2

- Spec 129 Revision 2 (TK-044…TK-048, DEV only): one "Увімкнути" switch (zones, cell grid, dragging); per-category zone lists whose first switch is the zone's physics; the selected zone filled, others muted; "Сітка клітинок" (opacity sliders, line step, snap, cell size, depth numbers) and "Сітка перспективи" (show, projection physics, step, projection values) sections; old debug-map config keys removed. Full 66/66; game-cycle baseline unchanged. Owner check pending.

## v0.46.14 - Zone Editor Tools

- Spec 129 (TK-040…TK-043, DEV only): colour squares for zone categories; the location debug map (grid, depth numbers, zone fills) follows its own switches, also under the open editor, with a visible grid; "Locations / Zones" moved into the zone editor in six sections; the selected zone is outlined with handles over a map cell grid and its edges can be dragged with snapping to cells. Full 66/66 incl. Quick/Architecture; game-cycle baseline unchanged. Owner check pending.

## v0.46.13 - Float Rocking Stage 2

- TK-039 / spec 128 stage 2 (owner): right after landing the float rocks ×3 and settles over 1.5 s; the float's wind tilt (breeze and gusts, already reduced by its wind compensation) and the rain make it livelier, swelling smoothly (0.6 s); heavy ballast rocks half as much and 30% slower; the tempo follows the waves' speed / wavelength. The phase is integrated, so tempo edits never make the float jump; 30/60/144 FPS rock alike. New DevTools settings in canvas.water.floatRocking (landingBoost, landingSettleSec, windShare, rainShare, ballastCalm, ballastSlow, waveTempoShare); the DEV status row shows each multiplier. Visual only. Full 66/66 incl. Quick/Architecture; game-cycle baseline unchanged. Owner phone check pending.

## v0.46.12 - Simpler Float Rocking

- TK-038 / spec 128, owner correction: in v0.46.11 the float did not move on the phone. Rocking is now simple and not synchronised with the waves: slow sines with unrelated frequencies, strength = water amplitude / 20 × surface size (far calmer). Standing bobs (bobPx 8) and sways (swayPx 3); lying bobs and turns about the middle of its visible body (lyingTurnDeg 10); periodSec 2; biteShare 0.5; its own switch, independent of the water switch. The water field is back to its v0.46.10 code (the shared pattern module removed). DevTools → "🖼️ СЦЕНА WebGL" → "покачування поплавка" shows frames, state and current offsets. A check drives the real builder with the real rocking. Full 66/66 incl. Quick/Architecture; game-cycle baseline unchanged. Owner phone check pending.

## v0.46.11 - Float Rocking on the Waves

- TK-038 / spec 128: the float rocks on the water's waves with the water's own amplitude, wavelength, speed and vertical share, calmer far away. A standing float bobs with the water under it and sways a little; a lying one bobs with the mean of the water under its ends and tilts about the middle of its visible body by the wave slope (up to 12°); a lean between mixes both, bite steps rock at half strength, a hooked fish stops it. The line ends at the rocked point. The water's sine pattern moved to the engine (CrossingWavePattern), its map byte-identical. DevTools: canvas.water.floatRocking (enabled, bobShare, swayShare, rotationGain, maxRotationDeg, biteShare), both renderers, off with still water. Full 66/66 incl. Quick/Architecture; game-cycle baseline unchanged. Owner visual and phone performance check pending.
