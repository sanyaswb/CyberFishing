# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.51.2 - Reveal search waits for Enter (TK-319.1)

- DevTools «Пошук» = «Розгорнути»: typing only marks the matches and opens their sections; the panel scrolls to a match (and switches the module) only on Enter — the search key of the phone keyboard — and the next Enter goes to the next one.

## v0.51.1 - Reveal search mode, landscape full screen closes fully (TK-319, TK-312.1)

- DevTools: «Панель» → «Пошук» chooses «Фільтр» (only the matches) or «Розгорнути» (every row stays, the matches' sections open, the current match is outlined, Enter / Shift+Enter step through them across modules). On a landscape phone «На весь екран» now closes completely (it moved by 400 px only, half stayed on screen).

## v0.51.0 - DevTools as an engine tool, overlay links, weather, live bait and keepnet

- Minor release of v0.50.1–0.50.130 (owner-approved minor). DevTools (spec 174): a rail of modules with own SVG icons, one edit path and one parameter row description, search and the changed filter, drill-in sections with breadcrumbs, the text dialog in place of prompt, lazy sections (opening ~25× faster), number fields that step by precision, list pickers, dependent parameters, phone layouts (full screen in portrait, side panel in landscape), panel settings (adaptive width, full screen, opening side — TK-317), hints with name, description and path behind «i», copy-key buttons, and names and descriptions audited against the code (TK-318). Overlay: separate windows with scale, metric names linked to their DevTools parameters. World: the window is only the camera, procedural rain with rings, living waves, continuous wind and gusts, weather export/import. Gameplay and UI: live bait by species in the switcher and backpack, keepnet filters and preview, victory window, carp mix packs, cast rod movement within line reach and water bounds, rain zones and a fullscreen zone editor, a FREE badge for free actions, the night float icon. Release: production build without DEV, offline cache, strict CSP, a release check before every push. Game-cycle report unchanged.

## v0.50.130 - DevTools hint below the row, copy key, night float icon (TK-314.1, TK-315, TK-316)

- DevTools: the «i» hint opens under the row and the control stays on the right; a copy button beside every parameter copies its key for a code search (Ctrl+Shift+F). The night float has its own icon with the glowing tip (convert-images glow-icon); the glow overlays in the card and the depth button are gone.
