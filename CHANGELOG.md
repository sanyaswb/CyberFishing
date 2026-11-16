# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.51.46 - The starfall's night timeline (spec 182 stage B, TK-351)

- A starfall night is checked once at 21:00; a starfall night plans several periods of random strength (some quiet) that rise and fall smoothly until 5:00, and at most one bolide at a random moment; none during an emission. Settings in the location's weather (`starfall`).
- DevTools «РАНДОМАЙЗЕР» → «Зорепад»: the share of starfall nights, periods, quiet stretches, the strength by the night's hours and the bolides. Stars on screen come with stage C.

## v0.51.45 - Sky zone for the starfall (spec 182 stage A, TK-350)

- The zone editor gets «Небо (де падають зорі)»: the sky where the starfall will fall, its own zones and switch `enableSkyZones`; the test location's sky is the top of the location for now. No stars yet (stages B–D).

## v0.51.44 - Separate rain and ash zones (TK-349)

- The zone editor gets «Попіл»: the emission's ash (dust) flies only in its own zones, apart from the rain's; embers start inside a visible ash zone and fade out when they drift out; the switch `enableAshZones` off — ash over the whole screen.

## v0.51.43 - Radiation hiss denser at the edges (TK-338.1)

- The radiation's hiss is denser at the screen's edges and weaker in the middle, like a vignette; DevTools «РАДІАЦІЯ» → «Шипіння (загальне)» → «По краях»: the middle's share (1 — even over the whole screen), the calm middle's radius and the transition.

## v0.51.42 - Inline ColorField row, matching NumberField height and toggle close (TK-348.1)

- DevTools `ColorField`: keeps the swatch + text input on the same row as the label and reset button (wrapping together only on narrow screens) with `30 px` / `38 px` height matching `NumberField`; clicking the swatch again closes the active colour popup / opacity drawer while preserving the picked colour.

## v0.51.41 - Direct swatch picker and full-width row for DevTools colours (TK-348)

- DevTools `ColorField`: the colour swatch and text input now share one row spanning the full width of `devtools__row`; clicking the swatch opens `<input type="color">` directly without an extra intermediate box click and updates the swatch colour immediately, while the inline row underneath appears only for the opacity slider (`rgba`/`#rrggbbaa`).

## v0.51.40 - Two − / + number fields for from-to DevTools pairs (TK-347)

- DevTools: two-number `[from, to]` parameters (`lengthJitter` and weather/fish/item ranges) now render as two separate `NumberField` controls with `−` / `+` step buttons (`NumberPairField`) instead of a single comma-separated text input; longer numeric lists (RGB triplets, `liveBait.capacities`) keep list input.

## v0.51.39 - Radio indicator: the radio drawing, the wave and the battery charge (spec 181 stage F, TK-346)

- The radio's HUD circle shows the inventory's radio drawing while it is silent and the moving wave only while it plays; its fill from the bottom is the battery charge, green → yellow → red as it runs down.

## v0.51.38 - Debuff «Радіація» in the HUD (spec 181 stage E, TK-345)

- While the location's radiation is above zero, a red badge with the radiation sign stands in the indicator column under the radio (a debuff without a timer); it fades when the radiation is gone.

## v0.51.37 - DevTools «СТАТУСИ» (spec 181 stage D, TK-344)

- DevTools «Гра» → «СТАТУСИ»: the active buffs and debuffs with their time left and modifiers, «Видати» / «Зняти» / «Зняти всі», and the descriptions (`CONFIG.statusEffects`) as live parameters — the vodka's duration and shares change at once.
