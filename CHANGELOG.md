# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.51.57 - Zone editor categories from one list (TK-359)

- The zone editor takes its categories from one place (their colours), and the weather zones drawn anywhere from one list, so a new zone category no longer needs edits in four files. Nothing changes on screen.

## v0.51.56 - DevTools weather fade no longer sticks (TK-358.1)

- After a DevTools weather switch (rain, storm, fog) was turned off, its quick fade stayed for the rest of the session, so the natural events of that kind came and went faster than the location smoothSec. The fade now lasts only while held and until the release has arrived.

## v0.51.55 - Weather code review: shared parts, fixed bugs (TK-358)

- The rain, water, ash and starfall share one implementation of their zones on screen, zone masks, background placement and colours; the weather modules use the engine number helpers. The look is unchanged.
- Fixed: the player statuses are released with the game and a status renewed after that gets its end again; the radiation debuff appears once its description is back; the weather controls no longer duplicate DevTools «СТАТУСИ»; an ash check that compared the wrong embers.

## v0.51.54 - The bolide can burn out (TK-357)

- A bolide may now burn out before it leaves the sky (never before 20 % of its path): its head flares and is gone, its tail stops where it was and fades smoothly, and sparks fly off the flare, slowing and falling a little. Tunable in DevTools «Конфіг» → canvas → starfall → bolide → burst.

## v0.51.53 - Starfall mask on one layer (TK-356.1)

- The falling stars and the bolide share one layer under one sky mask: one stencil pass a frame instead of two, and the mask can no longer show up as a white shape when it is taken off one of them. The scene checks now model Pixi masks.

## v0.51.52 - Clip falling stars and bolide to the sky zones (TK-356)

- Ordinary falling stars and the bolide now share a Pixi Graphics sky mask so tails and glow cut off cleanly at the sky zone boundary and never spill onto the world below; the mask redraws only when sky rectangles change and is removed when sky zones are off.

## v0.51.51 - Ash and starfall density per location, like the rain (TK-355)

- The ash count and the stars a minute are now the whole location count (the ash over the background, the stars over the whole sky), and a screen shows its visible share: a narrow phone screen shows fewer embers and stars at the same density instead of squeezing them all in. A screen that shows the whole location looks as before.

## v0.51.50 - Starfall test switch in the weather controls (TK-354.1)

- DevTools «ПОГОДА» → «Стан і керування»: «Зорепад (ніч)» moves the game clock to the night and holds the starfall at «Зорепад: сила, %»; «Болід зараз» under it. «ЗОРЕПАД» keeps the night state and its settings only.
- Measured: rain at 100 % with a storm plus a triple-dense starfall and a bolide cost about 0.1 ms of JavaScript a frame on a desktop; the starfall adds two small draw calls.

## v0.51.49 - DevTools «ЗОРЕПАД» (spec 182 stage E, TK-354)

- DevTools «ПОГОДА» → «ЗОРЕПАД»: the night now (plain or a starfall night with its periods and the bolide), the strength by hand (stars at any hour), «Зорепадна ніч зараз», «Болід зараз», the stars and the bolide look (general) and the night settings (location), live.

## v0.51.48 - The bolide (spec 182 stage D, TK-353)

- At most once a starfall night, at any moment (quiet stretches too), a big star falls: a long wide bright tail with a glowing, slightly flickering head, slower and longer than the others; it fades like them. Its look is live in DevTools «Конфіг» → canvas → starfall → bolide.
