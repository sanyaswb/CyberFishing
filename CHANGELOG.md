# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.46.5 - Mobile Float Below Inventory Selector

- TK-031 / G-115: at mobile toolbar widths <=820 logical px, place the radial selector in a dedicated upper row and keep float/depth below, left of appearing chum/net actions. Preserve measured selector bounds, slider expansion, wide/classic layout and shared production/DEV/catalog composition. Full 66/66 incl. Quick/Architecture; game-cycle baseline unchanged. Owner responsive acceptance pending.

## v0.46.4 - Night Float Without Daylight Glow

- TK-030 / G-114: night-float halo and additive tip light now follow the location's night lighting instead of the item variant alone. Daylight renders only the original red-tipped body in WebGL and Canvas, including after dawn on an existing cast; preserve DEV switches and all float geometry/gameplay. Full 66/66 incl. Quick/Architecture; game-cycle baseline unchanged. Owner visual/phone acceptance pending.

## v0.46.3 - Lying Float Towed by Its Bottom

- Spec 127 stage 4 (TK-025…TK-029): the float's lean is one vector on the water plane; a lying float is towed by its bottom (the tip trails at physics.floatPose.lying.trailLengthMeters, swings around through the player side, keeps its direction at rest, ignores drift with the water); the body is projected with the water's tilt, so a float lying toward the player is shorter but visible and a lean away draws slightly longer. Full 66/66 incl. Quick/Architecture; game-cycle baseline unchanged. Owner visual and phone check pending.

## v0.46.2 - Night Float Halo Switches

- The yellow/red bite-colour halo around the tackle is off by default (owner); the night float gets a green halo in the same style. DevTools switches: ui.float.biteHalo, ui.float.nightHalo, ui.float.nightTipGlow. Full 66/66 incl. Quick/Architecture; game-cycle baseline unchanged. Owner visual check pending.
