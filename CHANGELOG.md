# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.52.36 - Review before push (TK-374.4, TK-376.1)

- No change in play: the code that reads a value by the number of bottles is shared now, and a small cleanup in the drink button's wiring.

## v0.52.35 - Drunk waves from four bottles (TK-374.3)

- From four bottles the world slowly waves: the picture skews and stretches unevenly in long waves that never repeat and never move in step, now strong, now almost still; five bottles a little stronger. The HUD stays still and no scene edge shows.
- It is a CSS warp of the scene's picture (no filter, the scene is not redrawn). The values are in DevTools «Конфіг» → canvas → intoxication → «Хвилі».

## v0.52.34 - Drunk blur comes and goes like a defocus (TK-374.2)

- The vodka's blur is no longer constant: it comes and clears smoothly, each time for a different while and strength. One bottle — mostly sharp, now and then a light defocus; two — more often; from three on there is always some defocus with stronger, more frequent and longer episodes, strongest at five.
- The values are lists by the bottles in DevTools «Конфіг» → canvas → intoxication → «Розфокус».

## v0.52.33 - The production start is a short set; dev.html keeps every test item, with vodka and a gas mask (TK-377)

- A new player in the game starts with the bamboo rod, the day float, a 15 m line, the basic hook and 15 oil worms (one on the hook) — nothing else. The bamboo rod without a reel takes 10 m of the line; the other 5 m lie in the backpack.
- dev.html starts a new player with every test item plus 10 vodka (one stack) and a gas mask; a dev.html save from before gets the 10 bottles and the mask once.

## v0.52.32 - A drink slot and a HUD drink button (TK-376)

- A new «Напій» slot beside the gas mask takes the bottles as one stack; a tap on a bottle in the backpack puts it there, «Випити» is in the slot's editor.
- While the slot holds a drink, a button left of the item selector shows it and how many are left; a tap drinks one, also while fishing. The last bottle hides the button.

## v0.52.31 - A pack of hand chum is many throws; identical bottles are one stack (TK-375)

- A pack of hand chum put into its slot goes there whole: a pack of 100 is 100 throws, each takes one; the auto-refill puts in the next whole pack. Taking it off returns the rest to the backpack.
- Identical bottles of vodka are one stack: a new bottle joins the ones already in the backpack, and separate bottles from an older save join on load.
