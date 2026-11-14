# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.50.123 - Faster DevTools opening

- TK-308: DevTools draws a section's rows when it is first opened (or when a search, the changed filter, an overlay link or a blocking switch needs them) instead of drawing every collapsed section on each opening: 32,528 -> 507 elements and 223 -> 8.5 ms per opening in Node; a hidden overlay window is no longer written on every update.

## v0.50.122 - DevTools text dialog

- TK-307 (spec 174 C5): exports and imports in DevTools «Сервіс» (overrides, the asset load plan) open the panel's own text dialog with copy, download and open-file buttons, and errors stay in it with the reason; results show as a short line at the bottom of the panel instead of the browser's prompt and alert.

## v0.50.121 - DevTools drill-in sections

- TK-306 (spec 174 C4): DevTools shows at most two levels of sections in place; a deeper section opens inside its module's page on its own, under breadcrumbs back to the module and every section above it, so labels keep the panel's full width.

## v0.50.120 - DevTools names, descriptions, search

- TK-305 (spec 174 C3): DevTools rows show the key with its Ukrainian name under it and an «i» that opens the description; a changed value is marked and can be put back to the code's value by itself; a search under the title finds parameters in every module by key, name or path and keeps them editable in place; «Змінені» shows only changed values.
