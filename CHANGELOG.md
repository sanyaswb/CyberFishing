# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.51.12 - Irregular blur pulses and a swaying vignette (TK-324.1)

- Emission screen: the blur comes in sharp, glitch-like pulses of random strength and an ever-changing rhythm that quickens toward the peak; the darkening has smoother edges and sways like a swell, closing in deeper than it opens out.

## v0.51.11 - Emission darkening and blur, no cast without a gas mask (spec 179 stage E, TK-324)

- Without a gas mask an emission darkens the screen from the edges inward and blurs it in pulses that quicken toward the peak — the HUD and windows too, DevTools stays sharp (CONFIG.emission.screen.includeHud off: the world only). A cast during an emission opens the inventory with «У вас немає протигазу»; a fight already on goes on.

## v0.51.10 - Fiery ash during an emission (spec 179 stage C, TK-323)

- During an emission glowing embers of different sizes float through the air, smoother and slower than rain: they drift with the wind, rise slowly, wander, flicker and cool from yellow to red; their number follows the emission's strength. DevTools «ПОГОДА» → «Вигляд попелу».

## v0.51.9 - Emission background after the map's phases (TK-322.1)

- The emission's background now loads after every time-of-day phase of the current map, low copy first and the full picture right after, like the other backgrounds; an emission waits for the full picture.

## v0.51.8 - Emission background and red rain (spec 179 stage B, TK-322)

- Location: during an emission its own background fades in over the day/evening/night picture with the emission's strength (alone at the peak), on the water too; the rain and its rings turn red. The picture loads after the first frame, and an emission waits for it.

## v0.51.7 - Random session seed for the whole game (TK-321.2)

- The game's random numbers (bites, fish weight and anomalies, weather, wind, emission) now start from a fresh random seed every launch; before, every session repeated the same sequence. CONFIG.debug.seed repeats a session on purpose; DevTools «ПОГОДА» shows the session's seed.

## v0.51.6 - Emission starts by chance, DevTools randomizer (TK-321.1)

- Weather: an emission now starts by a roll once a minute (the chance grows with each failed roll, a 20-minute pause after each emission and at the start), so its moment cannot be known ahead; about 82% of emissions come 30–60 minutes apart. A fresh random emission seed per session. DevTools «Діагностика» → «РАНДОМАЙЗЕР» runs the game's real random many times and shows a short report.

## v0.51.5 - Emission and radiation model (spec 179 stage A)

- Weather: the location's emission (start, peak, fade with random durations, random pause between emissions) holds a storm with its own settings and leaves it as an ordinary storm; the location's radiation (0 outside an emission on the test location, 1 at the peak) is in the environment. No visuals yet. DevTools «ПОГОДА» → «Викид»: state, start/peak/fade/end now, freeze, radiation by hand.

## v0.51.4 - Section description styled as the «i» hint (TK-320.1)

- DevTools: a section's description (behind the «i» beside its title) is the same box as a parameter's «i» hint — the same background, padding and 12 px text, names in bold, rows without lines.

## v0.51.3 - DevTools modes as lists, colour picker, section info, selectable text (TK-320)

- DevTools: hints no longer say «увімкнено/вимкнено»; 11 text parameters with fixed modes (biteSequenceMode, canvas.scene, cameraFollowPriority, …) are lists; colour parameters (#hex, rgb/rgba) have a swatch that opens a colour and opacity picker, keeping the value's format; a section's description sits behind an «i» beside its title and opens at the top of the section; the panel's text can be selected and copied.
