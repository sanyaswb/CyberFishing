# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.51.36 - Status badge in the HUD (spec 181 stage C, TK-343)

- A drunk vodka shows a round badge with a bottle under the radio: its green fill drains from the top down as the time runs out, turns yellow and red, and the badge fades away at the end; a tap shows the time left.
- The radio and the statuses share one column under the clock; debuffs get a red outline. The fill is a CSS animation: no per-frame work.

## v0.51.35 - Vodka halves what you see of the emission (spec 181 stage B, TK-342)

- The emission's screen effect gets the full emission strength; the vodka weakens its output: exactly half the darkness and the blur at any phase (before, 50 % at the input showed only 20–30 % outside the peak), the blur keeps the emission's rhythm; the gas mask still shows nothing.
- The vodka's three shares (darkening, blur, pulse rate) are live in DevTools «Конфіг» → statusEffects → vodka → Модифікатори.

## v0.51.34 - Player buffs and debuffs: the status architecture (spec 181 stage A, TK-341)

- The vodka and the gas mask are player statuses described in `CONFIG.statusEffects` (duration, stacking, modifiers — the shares of the emission's darkening, blur and pulse rate that stay); the gas mask in its slot holds its status. Behaviour as in v0.51.33.
- DevTools «ПОГОДА» → «Стан і керування» → «статуси» lists the active ones with their time left; the descriptions are editable in «Конфіг» → statusEffects.
