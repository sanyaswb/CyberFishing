# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.52.62 - Overlay windows with DevTools icons instead of emoji (TK-397, spec 186)

- dev.html: overlay window headings that had emoji (ПРОДУКТИВНІСТЬ, ЗАВАНТАЖЕННЯ, ЕХОЛОТ, ДЕБАФИ, …) show the same line icons as DevTools, the same on every phone; emoji in the overlays' text are gone; the balance windows' reset button shows the reset icon.

## v0.52.61 - Overlay: a metric's explanation under its row (TK-396, spec 186)

- dev.html: a tap on a highlighted metric name in an overlay window opens its explanation right under the row — what it is, the formula, the parameters with their values now and a button to open each parameter in DevTools; a second tap closes it (on a phone there is no console). The startup report without a clipboard now opens in the DevTools text window instead of the browser's prompt.

## v0.52.60 - Overlay core without fallbacks (TK-395, spec 186)

- No visible change: the DEV overlay's core takes everything it needs from its composition (no hidden global defaults or optional calls), so a missing part fails at once instead of silently doing nothing.

## v0.52.59 - «ПРОДУКТИВНІСТЬ» draws its frame bar with three shapes (TK-393, spec 186)

- dev.html: the frame bar of the «ПРОДУКТИВНІСТЬ» overlay looks the same but is three shapes instead of up to 240, so the overlay itself costs the phone less while it measures.

## v0.52.58 - The DEV live snapshot at the overlay's cadence, not every frame (TK-392, spec 186)

- dev.html: with the overlay, DevTools or console modules on, the game built the debug snapshot (bite chances of every species and more) every frame although everything reads it every 150 ms; now it builds it every 150 ms (60 → 6–7 times a second). Less DEV work in the frame, so «ПРОДУКТИВНІСТЬ» measures closer to the real game.

## v0.52.57 - An overlay window that fails to draw shows why; the others keep updating (TK-391, spec 186)

- dev.html: if one DEV overlay window ever fails to draw, it shows a red notice with the cause, and the other overlay windows keep updating (before, every window after it froze without a sign).

## v0.52.56 - Review: DevTools without fallbacks for what always exists (TK-389.1)

- No visible change: two DevTools parts no longer carry a fallback for a method or a wrapper that is always there (the saving section's status row, the Spine section's controller).

## v0.52.55 - Review: a DevTools search filters once per redraw (TK-387.1)

- dev.html: while a DevTools search or «Змінені» is on, a redraw of ПОГОДА or the zone editor filtered the panel twice (once over a half-built section); now once.

## v0.52.54 - A deep DevTools section's «i» is in the breadcrumbs (TK-390)

- dev.html: a section opened inside (third level, with breadcrumbs) shows its «i» at the right of the breadcrumbs, so its description opens and closes there; back in the tree the «i» is beside the section's title again.

## v0.52.53 - DevTools cleanup: one Spine section, icons instead of symbols (TK-389)

- dev.html: the rod's and the boat's Spine sections are one section in code (no visible change; the boat's export now saves the skeleton with the latest bone edits). Buttons «Оновити», «Авто погода», «авто», «Скинути розділ до коду» and the loading layers show icons instead of the symbols ↻ ↺ ✓; the shop says «· видано ×N» after a grant.
