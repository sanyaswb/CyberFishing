# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.52.46 - Gas mask filters change while fishing, one at a time under radiation (TK-385, spec 185)

- With the tackle in the water the gas mask's filters can still be changed in its editor (the rest of the equipment stays locked, the mask stays on). Under radiation or during an emission the filters change one at a time: the last filter with time left cannot come out until a new one is in. Without radiation and an emission — freely.

## v0.52.45 - The gas mask's HUD indicator with cracks (TK-384, spec 185)

- While a gas mask is worn, a round indicator stands in the HUD column after the radio: its fill is the mask's condition, cracks appear at 80, 60, 40, 20 and 0 % (at 0 it is cracked through, with a red outline), and it fades while the mask does not protect. A tap shows the filters' time left. (A Spine effect of cracked glass comes later.)

## v0.52.44 - The gas mask wears by its quality while it filters (TK-383, spec 185)

- While a filter is working (on the location under radiation or during an emission) the gas mask wears: quality 3 goes from 100 % to 0 in 5 minutes. At 0 it cracks: it stops protecting and its filters stop; the other filter keeps what is left. Without radiation or an emission the mask does not wear.

## v0.52.43 - The gas mask protects through its filters (TK-382, spec 185)

- The gas mask protects only with a filter that has time left: then the emission's darkening and blur are gone and the radiation's hiss is half as strong. The filters work one at a time (the one with less time first, the other takes over without a gap), and their time runs only on the location under radiation or during an emission. A removed filter keeps its time.
- Without a working filter (or with a cracked mask) the mask does not protect and there is no cast during an emission; the message says what is missing. When the protection ends, the effects come back smoothly over 10 seconds.

## v0.52.42 - Gas mask filters and the mask's two filter cells (TK-381, spec 185)

- Two gas mask filters: «Фільтр ФПК-1 „Вугільний“» and «Фільтр ФПК-1 „Попіл“», 3 minutes each (same parameters), with simple icons. The gas mask now has two filter cells: a tap on the mask opens its editor, a filter goes into a free cell, «Спорядити» puts the mask on. Gas mask quality is 3.
- dev.html: two of each filter in the DEV start and once in an existing DEV save; DEV shop «Фільтри протигаза». The filters do not act yet — the next stage makes the mask protect only through them.

## v0.52.41 - God mode: a hold removes the vodka too (TK-380.1)

- dev.html, God mode «GOD зняти ефект утриманням»: a hold now arms any effect with a timer, the vodka (its drunkenness) included — before it took debuffs only, and no debuff in the game has a timer. Effects held by their source (the location's radiation, the gas mask) stay.

## v0.52.40 - DevTools no longer goes empty after a bottle of vodka (TK-378.1)

- dev.html: with any active effect (vodka, a gas mask in its slot, radiation) DevTools stayed empty until a reload. Fixed: the «СТАТУСИ» section reads the level again, and every page draws.
- If one DevTools section ever fails to draw, it now shows the error in its own page and the rest of DevTools keeps working.

## v0.52.39 - DEV God mode: remove a debuff by holding its badge (TK-380)

- dev.html only, with God mode «GOD зняти дебаф утриманням» on (DevTools → God mode): hold a debuff's round badge in the HUD for half a second — a cross appears in its middle and its time does not open; the next tap removes the debuff. A short tap shows the time as before. Debuffs with a timer only.

## v0.52.38 - The fiery ash flies with the wind (TK-379)

- The emission's embers drift with the wind: its direction and strength set where and how fast they fly, a gust carries them faster, and they turn smoothly when the wind changes. Nearer embers fly faster.
- A separate switch: DevTools «ПОГОДА» → «ПОПІЛ» → «Вигляд (загальний)» → «Попіл летить за вітром»; the drift speed is «ВІТЕР» → «Знос попелу, px/с» (now 90).

## v0.52.37 - Sobering up by steps (TK-378)

- Vodka lasts by the bottles: 1 bottle — 1 minute, 2 — 3, 3 — 5, 4 — 7, 5 bottles — 10 minutes; another bottle raises the level by one from the level now.
- The drunk effects step down smoothly: with 5 bottles level 4 at 7 minutes left, 3 at 5, 2 at 3, 1 in the last minute; each step glides over 30 seconds, and the end fades over 30 seconds too.
