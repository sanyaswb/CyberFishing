# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.52.27 - The gas mask mutes the radiation's hiss (TK-373)

- In a gas mask the radiation's hiss on the screen is three times fainter (× 0.3). It still removes the emission's darkening and blur, as before. The share is a gas mask status modifier, adjustable in DevTools «Конфіг».

## v0.52.26 - dev.html keeps its DevTools button (TK-371.3)

- The house button (⌂) is in the released game only. dev.html has its DevTools button in the top-left corner again, and the strip along the screen's edge opens DevTools only in the zone editor, as before v0.52.22. In dev.html the house opens from DevTools («Будинок») or `?screen=house`.

## v0.52.25 - The Geiger counter is quiet in the house (TK-371.2)

- The Geiger counter kept clicking while the player was in the house during an emission (the location's world goes on there). In the house nothing of the location reaches the player, so the counter is silent now. Back outside, it clicks with the current radiation.

## v0.52.24 - A broken tackle says it is broken (TK-370.1)

- A cast with a broken item in the tackle opened the inventory with «Спочатку споряди ліску для закидання». It now shows «Снасть зламана — закинути не можна.».

## v0.52.23 - The house's code in the game's bundle (TK-371.1)

- The production game page loads the house's code with the rest of the game instead of on the first visit.
- The lazy load split the modules the house shares with the game into four more start files: 14 JavaScript files at start, over the limit of 10.
- The start is back to its own files. The house's art still loads only when the house is shown.
