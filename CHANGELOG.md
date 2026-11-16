# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.51.33 - Gas mask and vodka against the emission (spec 179 stage F, TK-340)

- The gas mask goes into its now unlocked slot: no darkening or blur during an emission, and casting is allowed.
- Vodka: open it in the backpack and press «Випити» — the emission's darkening and blur are half as strong for 10 minutes; another bottle renews the time; casting still needs a gas mask.
- Both come from the DEV shop for now (placeholder art); DevTools «ПОГОДА» → «Стан і керування» shows the protection and its time left.

## v0.51.32 - Geiger counter clicks with the radiation (spec 179 stage D, TK-339)

- A procedural Geiger counter beside the radiation's hiss: random clicks, sparse at low radiation and a crackle at the peak, silent below 5 %; it starts after the player's first touch and stays silent in a hidden tab.
- DevTools «ПОГОДА» → «РАДІАЦІЯ» → «Звук лічильника (загальне)»: on/off, volume, threshold, clicks a second, tone and click length.

## v0.51.31 - Radiation hiss over the scene (spec 179 stage D, TK-338)

- WebGL scene: fine flickering grain over the world, stronger as the location's radiation rises during an emission (none below 5 %); one noise tile made in code, no filter, no frames when there is no radiation.
- DevTools «ПОГОДА» → «РАДІАЦІЯ» → «Шипіння (загальне)»: on/off, threshold, opacity, speck size and pace, live.

## v0.51.30 - Radiation as its own weather section (TK-337)

- DevTools «ПОГОДА»: «РАДІАЦІЯ» under «ВИКИД» holds the manual radiation and the location's radiation levels; «ВИКИД» keeps the event, the freeze and the screen.
