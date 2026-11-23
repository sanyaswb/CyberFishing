# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.52.56 - Review: DevTools without fallbacks for what always exists (TK-389.1)

- No visible change: two DevTools parts no longer carry a fallback for a method or a wrapper that is always there (the saving section's status row, the Spine section's controller).

## v0.52.55 - Review: a DevTools search filters once per redraw (TK-387.1)

- dev.html: while a DevTools search or «Змінені» is on, a redraw of ПОГОДА or the zone editor filtered the panel twice (once over a half-built section); now once.

## v0.52.54 - A deep DevTools section's «i» is in the breadcrumbs (TK-390)

- dev.html: a section opened inside (third level, with breadcrumbs) shows its «i» at the right of the breadcrumbs, so its description opens and closes there; back in the tree the «i» is beside the section's title again.

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
