# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.52.2 - Touch cast controls: scroll, tap to aim, no long-press re-cast (spec 183, TK-361)

- On a phone with a ready rod a sideways swipe now scrolls the map instead of aiming. A tap starts aiming: the aim waits until a touch pulls down with power and casts; a release at zero power keeps it, a tap or a double tap removes it. A long swipe down aims and casts at once. The mouse works as before.
- The long-press re-cast is gone for touch and mouse: reel the tackle in, double tap, cast. Game-cycle report unchanged.

## v0.52.1 - DevTools weather «Керування»: live switches, sliders when on (TK-360)

- «Стан і керування» is now «Керування». A strength slider shows under Дощ/Шторм/Туман/Викид/Зорепад only while it is on; «Болід зараз» is the last row and on a phone closes DevTools so the bolide is seen falling.
- «The fog comes on after the starfall goes off»: the switches showed the state of the last redraw. The starfall's test switch moves the clock to 23:00 (the fog's ×3 window), a fog started by itself and the next redraw revealed it. The switches now follow the live state while the panel is open. Game-cycle report unchanged.

## v0.52.0 - Emission, player statuses, starfall and the weather review

- Minor release of v0.51.1–0.51.57 (owner-approved minor). Emission (spec 179): a state of the location with radiation, its background and red rain, fiery ash, darkening and pulsing blur, the radiation hiss (denser at the edges) and Geiger clicks, the gas mask and vodka. Player statuses (spec 181): buffs and debuffs with live parameters, round HUD badges with a draining fill and countdown, the radiation debuff, the radio badge with its drawing, wave and battery charge, DevTools «СТАТУСИ».
- Weather (spec 180): independent events with timelines, general and location settings, DevTools «ПОГОДА» sections, saving and the RANDOMIZER; separate rain, ash and sky zones, densities per location. Starfall (spec 182): a night check at 21:00, periods of floating strength, stars in the sky zones, a bolide that may burn out with a flare and sparks, DevTools «ЗОРЕПАД» and a test switch.
- A critic code review of the weather: shared scene parts instead of copies and the fixes it found; the review is now asked about before every push (docs/code_review.md). Game-cycle report unchanged.

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
