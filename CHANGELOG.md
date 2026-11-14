# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.51.2 - Reveal search waits for Enter (TK-319.1)

- DevTools «Пошук» = «Розгорнути»: typing only marks the matches and opens their sections; the panel scrolls to a match (and switches the module) only on Enter — the search key of the phone keyboard — and the next Enter goes to the next one.

## v0.51.1 - Reveal search mode, landscape full screen closes fully (TK-319, TK-312.1)

- DevTools: «Панель» → «Пошук» chooses «Фільтр» (only the matches) or «Розгорнути» (every row stays, the matches' sections open, the current match is outlined, Enter / Shift+Enter step through them across modules). On a landscape phone «На весь екран» now closes completely (it moved by 400 px only, half stayed on screen).

## v0.51.0 - DevTools as an engine tool, overlay links, weather, live bait and keepnet

- Minor release of v0.50.1–0.50.130 (owner-approved minor). DevTools (spec 174): a rail of modules with own SVG icons, one edit path and one parameter row description, search and the changed filter, drill-in sections with breadcrumbs, the text dialog in place of prompt, lazy sections (opening ~25× faster), number fields that step by precision, list pickers, dependent parameters, phone layouts (full screen in portrait, side panel in landscape), panel settings (adaptive width, full screen, opening side — TK-317), hints with name, description and path behind «i», copy-key buttons, and names and descriptions audited against the code (TK-318). Overlay: separate windows with scale, metric names linked to their DevTools parameters. World: the window is only the camera, procedural rain with rings, living waves, continuous wind and gusts, weather export/import. Gameplay and UI: live bait by species in the switcher and backpack, keepnet filters and preview, victory window, carp mix packs, cast rod movement within line reach and water bounds, rain zones and a fullscreen zone editor, a FREE badge for free actions, the night float icon. Release: production build without DEV, offline cache, strict CSP, a release check before every push. Game-cycle report unchanged.

## v0.50.130 - DevTools hint below the row, copy key, night float icon (TK-314.1, TK-315, TK-316)

- DevTools: the «i» hint opens under the row and the control stays on the right; a copy button beside every parameter copies its key for a code search (Ctrl+Shift+F). The night float has its own icon with the glowing tip (convert-images glow-icon); the glow overlays in the card and the depth button are gone.

## v0.50.129 - DevTools parameter hints, tighter breadcrumbs, FREE badge (TK-314)

- DevTools: a parameter row is the key with «i» right after it; the Ukrainian name, description and path are in the «i» hint; breadcrumbs are tighter. Free house actions and the DevTools item shop show a FREE badge (rounded, slowly turning green) instead of «Безкоштовно».

## v0.50.128 - DevTools full screen on a portrait phone (TK-313)

- Portrait phone: DevTools takes the whole screen, the module icons are one row on top; the phone CSS now follows the base rules that kept the rail a 60 px column (incidents I-21).

## v0.50.127 - DevTools panel settings

- TK-312: the last DevTools module «Панель» holds the panel's own settings: «Адаптивна ширина» makes the panel on a computer as wide as its content (up to 720 px and 60 % of the screen), «На весь екран» lets it take the whole screen on a phone; both are remembered.

## v0.50.126 - DevTools cleanup

- TK-311 (spec 174 E): DevTools cleanup: unused row bridges and the tooltip method removed, the weather location list on the common row builder without its fallback, 17 module-internal constants no longer exported, the last emoji and raw colours gone; design rules and architecture describe the new DevTools.

## v0.50.125 - DevTools on phones

- TK-310 (spec 174 D): on a narrow portrait phone DevTools is a bottom sheet across the width (half the height, nearly all of it with its handle) with the module rail as a row on top, so the game stays visible above it; on a landscape phone it is a compact side panel at most half the screen wide.

## v0.50.124 - Overlay metric links

- TK-309: in every overlay module a metric whose description names a game parameter looks like the weather module's links; a click opens that parameter in DevTools and still writes the formula to the console, and a press on it does not drag the window.
