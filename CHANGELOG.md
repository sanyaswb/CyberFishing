# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

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

## v0.50.119 - DevTools module rail

- TK-304 (spec 174 C2): DevTools shows one module at a time from a rail of seven (Гра, Конфіг, Бази, Локація, Сцена, Діагностика, Сервіс); the chosen module and each module's scroll are remembered, an empty module says so, and a link from the overlay or a blocking switch opens its module first.

## v0.50.118 - DevTools icons

- TK-303 (spec 174 C1): DevTools draws its own outline SVG icons (panel button, section chevrons, root sections, navigation, warnings, export) instead of emoji and text arrows; colours come from --devtools-* tokens, labels use the system sans font and values stay monospace; the panel has an opaque background without blur (cheaper on phones).

## v0.50.117 - DevTools rows from one description

- TK-302 (spec 174 B1): every DevTools parameter row is built from one description (DevToolsUI.addParameter) with its own control class (switch, text, number list, slider beside the number, list, segments); the config tree uses it, the older row methods remain as thin bridges until stage E.

## v0.50.116 - DevTools panel modules

- TK-301 (spec 174 B3): every area of the DevTools panel is its own module (shop, overlay, config, debug, scene with weather, zone editor, database, Spine, radio, hooked fish, service) with one contract; DevTools keeps only the panel's lifecycle, navigation and module order. The panel looks and works the same.

## v0.50.115 - DevTools sections by place

- TK-300 (spec 174 B4): DevTools remembers open sections by their place, not their title (two sections with one title no longer open together); a new fish on the hook redraws only its sections, so the panel keeps its scroll and focus during a fight; a full redraw keeps the scroll too. Open sections are reset once.
