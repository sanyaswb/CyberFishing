# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.51.51 - Ash and starfall density per location, like the rain (TK-355)

- The ash count and the stars a minute are now the whole location count (the ash over the background, the stars over the whole sky), and a screen shows its visible share: a narrow phone screen shows fewer embers and stars at the same density instead of squeezing them all in. A screen that shows the whole location looks as before.

## v0.51.50 - Starfall test switch in the weather controls (TK-354.1)

- DevTools «ПОГОДА» → «Стан і керування»: «Зорепад (ніч)» moves the game clock to the night and holds the starfall at «Зорепад: сила, %»; «Болід зараз» under it. «ЗОРЕПАД» keeps the night state and its settings only.
- Measured: rain at 100 % with a storm plus a triple-dense starfall and a bolide cost about 0.1 ms of JavaScript a frame on a desktop; the starfall adds two small draw calls.

## v0.51.49 - DevTools «ЗОРЕПАД» (spec 182 stage E, TK-354)

- DevTools «ПОГОДА» → «ЗОРЕПАД»: the night now (plain or a starfall night with its periods and the bolide), the strength by hand (stars at any hour), «Зорепадна ніч зараз», «Болід зараз», the stars and the bolide look (general) and the night settings (location), live.

## v0.51.48 - The bolide (spec 182 stage D, TK-353)

- At most once a starfall night, at any moment (quiet stretches too), a big star falls: a long wide bright tail with a glowing, slightly flickering head, slower and longer than the others; it fades like them. Its look is live in DevTools «Конфіг» → canvas → starfall → bolide.

## v0.51.47 - Falling stars on the scene (spec 182 stage C, TK-352)

- On a starfall night short bright streaks fly down at a slant in the sky zones, more or fewer as the night's strength rises and falls; a star that leaves the sky fades. They lie over the sky, under the water and the world; frames only while a star flies.
- Their look is live in DevTools «Конфіг» → canvas → starfall (stars a minute, tail, speed, slant, colour).

## v0.51.46 - The starfall's night timeline (spec 182 stage B, TK-351)

- A starfall night is checked once at 21:00; a starfall night plans several periods of random strength (some quiet) that rise and fall smoothly until 5:00, and at most one bolide at a random moment; none during an emission. Settings in the location's weather (`starfall`).
- DevTools «РАНДОМАЙЗЕР» → «Зорепад»: the share of starfall nights, periods, quiet stretches, the strength by the night's hours and the bolides. Stars on screen come with stage C.

## v0.51.45 - Sky zone for the starfall (spec 182 stage A, TK-350)

- The zone editor gets «Небо (де падають зорі)»: the sky where the starfall will fall, its own zones and switch `enableSkyZones`; the test location's sky is the top of the location for now. No stars yet (stages B–D).

## v0.51.44 - Separate rain and ash zones (TK-349)

- The zone editor gets «Попіл»: the emission's ash (dust) flies only in its own zones, apart from the rain's; embers start inside a visible ash zone and fade out when they drift out; the switch `enableAshZones` off — ash over the whole screen.

## v0.51.43 - Radiation hiss denser at the edges (TK-338.1)

- The radiation's hiss is denser at the screen's edges and weaker in the middle, like a vignette; DevTools «РАДІАЦІЯ» → «Шипіння (загальне)» → «По краях»: the middle's share (1 — even over the whole screen), the calm middle's radius and the transition.

## v0.51.42 - Inline ColorField row, matching NumberField height and toggle close (TK-348.1)

- DevTools `ColorField`: keeps the swatch + text input on the same row as the label and reset button (wrapping together only on narrow screens) with `30 px` / `38 px` height matching `NumberField`; clicking the swatch again closes the active colour popup / opacity drawer while preserving the picked colour.
