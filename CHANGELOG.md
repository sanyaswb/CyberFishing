# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.52.30 - Review before push (TK-372.1, TK-374.1)

- The emission's shake no longer allocates on every frame; it shakes exactly as before.
- Descriptions brought up to date: the vodka stacks, and the real cost of being drunk (the scene's blur on every frame).

## v0.52.29 - Vodka stacks and makes you drunk (TK-374)

- Each bottle of vodka adds to the effect (up to 5) and starts its 10 minutes again; all of it ends 10 minutes after the last bottle.
- Under radiation the vodka protects from the emission's screen effects: 30 % for one bottle, 45 % for two, 60 % for three or more.
- Without radiation the player gets drunk: the world blurs and the view sways slowly in a figure of eight, stronger with each bottle. When radiation comes, the drunkenness fades smoothly and the vodka works as protection; after the radiation it comes back. The HUD stays sharp and still. The values are in DevTools «Конфіг» → canvas → intoxication.

## v0.52.28 - The emission shakes the view (TK-372)

- During an emission the view shakes. Early on there are rare light jolts, more often and stronger as the emission grows. At the peak the shake is constant and its strength keeps swinging. The HUD stays still, the gas mask does not stop it, and in the house there is none.
- The shake moves the scene's picture (a CSS move of its canvas, slightly enlarged so the edges stay hidden), so the scene is not drawn again for it. Its values are in DevTools «ПОГОДА» → «ВИКИД» → «Тряска».
