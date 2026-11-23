# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.52.53 - DevTools cleanup: one Spine section, icons instead of symbols (TK-389)

- dev.html: the rod's and the boat's Spine sections are one section in code (no visible change; the boat's export now saves the skeleton with the latest bone edits). Buttons «Оновити», «Авто погода», «авто», «Скинути розділ до коду» and the loading layers show icons instead of the symbols ↻ ↺ ✓; the shop says «· видано ×N» after a grant.

## v0.52.52 - A DevTools section that fails to draw shows why (TK-388)

- dev.html: if a DevTools section ever fails to draw when it is first opened, it opens with a red notice naming the error; the rest of the panel and the search keep working (before, it silently did not open, and a search stopped at it).

## v0.52.51 - DevTools sections redraw cleanly: one «i», bones and radio effects follow the choice (TK-387)

- dev.html: «↻ Оновити» no longer adds another «i» beside a section's title each time; in «SPINE → вудка/кораблик → Кістки» choosing another bone shows its fields (before, the previous bone's fields stayed and an edit changed that bone); in «РАДІО → Звук → ефект» switching it on shows its parameters at once.

## v0.52.50 - DevTools no longer goes empty after a section's «i» (TK-306.1)

- dev.html: sometimes, after a tap on the «i» of a deep section (for example «Зорепад»), every row of DevTools vanished and the «i» sat in the panel's top-right corner over the close button. It happened when such a section was opened a second time after leaving it. Fixed: the section always opens with its own rows, the «i» stays beside its title.

## v0.52.49 - Review: the gas mask's per-frame check allocates nothing (TK-382.1)

- No change in play: the gas mask's check every frame no longer creates temporary objects (less garbage collection while a mask is worn).

## v0.52.48 - Review: browsing the inventory under radiation saves nothing (TK-385.1)

- Under radiation with a gas mask on (and while the bait boat is on the water) opening the inventory, choosing a section, a filter or going back no longer writes the whole save each time; only real changes are saved.

## v0.52.47 - Review: a background inventory write no longer rebuilds the closed inventory (TK-386)

- Smoother play under radiation: every few seconds the game writes a battery's charge, the items' wear and now the gas mask's filter and wear; each such write rebuilt the whole inventory window, even when it was closed (~7 ms on a PC, more on a phone). Now the closed inventory is left alone and drawn when it opens; a write takes about a fifth of the time.

## v0.52.46 - Gas mask filters change while fishing, one at a time under radiation (TK-385, spec 185)

- With the tackle in the water the gas mask's filters can still be changed in its editor (the rest of the equipment stays locked, the mask stays on). Under radiation or during an emission the filters change one at a time: the last filter with time left cannot come out until a new one is in. Without radiation and an emission — freely.

## v0.52.45 - The gas mask's HUD indicator with cracks (TK-384, spec 185)

- While a gas mask is worn, a round indicator stands in the HUD column after the radio: its fill is the mask's condition, cracks appear at 80, 60, 40, 20 and 0 % (at 0 it is cracked through, with a red outline), and it fades while the mask does not protect. A tap shows the filters' time left. (A Spine effect of cracked glass comes later.)

## v0.52.44 - The gas mask wears by its quality while it filters (TK-383, spec 185)

- While a filter is working (on the location under radiation or during an emission) the gas mask wears: quality 3 goes from 100 % to 0 in 5 minutes. At 0 it cracks: it stops protecting and its filters stop; the other filter keeps what is left. Without radiation or an emission the mask does not wear.
