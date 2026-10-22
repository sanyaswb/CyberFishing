# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.46.10 - Selector Placement Choice

- TK-037 (toolbars <=820 logical px): DevTools places the radial selector in the centre (default, the TK-036 layout), the right bottom corner (quarter fan) or the left bottom corner (mirrored fan), via CONFIG.ui.inventorySelector.compactPlacement. A corner selector puts the action column on the other side; a centred one follows compactActionsSide (right by default, or left). The float always ends the column in its corner and its track opens across the row while the selector fades out; the fan and aiming fades apply to every placement. Wider toolbars unchanged. Full 66/66 incl. Quick/Architecture; game-cycle baseline unchanged. Owner visual acceptance pending.

## v0.46.9 - Compact Toolbar Column and Fades

- TK-036 (toolbars <=820 logical px with the radial selector): the open half-disk central button is an exact half circle (its rounded bottom corners made CSS shrink every radius and flatten the top), so the gap to every petal equals the gap between petals. Every other action stands in one column at the right edge, packed up from the bottom corner: float/depth in the corner with its track opening leftwards while the selector fades out, then the net, then the chum and others. Opening the fan fades every other action out completely; aiming a cast fades out the whole toolbar; all fades are smooth (instant with reduced motion). Wider toolbars unchanged. Full 66/66 incl. Quick/Architecture; game-cycle baseline unchanged. Owner visual acceptance pending.

## v0.46.8 - Version in the DevTools Footer on Phones

- TK-035: at UI widths <=820 logical px, where the toolbar's version badge is hidden, the DevTools panel shows the project version (the same badge text from PROJECT_VERSION_CONFIG) in a fixed last row below the scrolling sections. Wider screens keep the toolbar badge. Full 66/66 incl. Quick/Architecture; game-cycle baseline unchanged. Owner visual acceptance pending.

## v0.46.7 - Centred Selector Fan on Compact Toolbars

- TK-034: at toolbar widths <=820 logical px the radial selector stands centred in the bottom row without a reserve and opens a symmetric fan over its neighbours: half circle (half-disk central button, three 60° petals) or 120° arc (round central button, three 40° petals), switched live by CONFIG.ui.inventorySelector.compactShape. The landing net stands right of it, the depth control further right with its track opening rightwards; the chum and other actions stand left, balanced around the selector. While the fan is open the other actions fade and a press beside it only closes it. Wider toolbars keep the corner fan. Full 66/66 incl. Quick/Architecture; game-cycle baseline unchanged. Owner visual acceptance pending.

## v0.46.6 - Selector Menu Icon and Shared Feedback

- TK-032/033: selector sectors share the main toolbar button's background/accent states without the extra yellow thick border; keyboard focus keeps the toolbar info color. Replace the central suitcase with a symmetric four-square SVG menu and retain the original in asset-sources/ui/archive/inventory-suitcase-v0.46.5.svg outside runtime assets. Interaction geometry and gestures unchanged. Full 66/66 incl. Quick/Architecture; owner visual acceptance pending.
