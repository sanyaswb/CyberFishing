# CyberFishing changelog

Latest 10 releases. Older entries: [CHANGELOG_ARCHIVE.md](<D:/dev/cyber fishing/CHANGELOG_ARCHIVE.md>).

## v0.48.28 - Visual preview synchronization on tab switch and default VOLIA 77.2 track order

- Inventory / Assembly: visual preview card now synchronizes with the active slot tab on swipe or tap, showing the equipped item card or the compartment icon for empty slots (TK-123).
- Radio: default VOLIA 77.2 playlist begins with "Ефір ВОЛЯ 77.2" followed by "Чому з Купола тікають на Іржавий Шельф" (TK-123).

## v0.48.27 - Radio channel switcher cleanup and continuous VOLIA 77.2 playback

- Radio: removed custom channel button and functionality from UI/preferences; tracks on VOLIA 77.2 now transition seamlessly to the next song upon completion without intermission pause (TK-122).

## v0.48.26 - Radio DEV sound tuning full parameters and collapsed list

- Radio: expanded DEV radio sound tuning to full parameter set across vinyl, walkie-talkie and battery/signal interference, organizing groups into collapsible accordion sections with range sliders (TK-121).

## v0.48.25 - Aligned item assembly editor width and margins in portrait mode

- Inventory: removed redundant horizontal and top padding on assembly editor in portrait mode, aligning content panels with header margins and pinning sticky actions to top (TK-120).

## v0.48.24 - Removed obsolete embedded page overlay platform code and test suite

- Tooling / Platform: deleted unused `EmbeddedPageOverlay`, its CSS rule in `dev-tools.css`, and its test suite `embedded-page-overlay-check.js`; pruned obsolete test fixtures and style readers (TK-119).

## v0.48.23 - Removed UI catalog code and cleared ui-catalog.html

- Dev / Catalog: removed all UI catalog code, components, examples, fixtures, styles, test suite, and DevTools navigation; cleared ui-catalog.html to an empty page (TK-118).

## v0.48.22 - Custom radio channel and dedicated station VOLIA 77.2

- Radio: added dedicated station VOLIA 77.2 (77.2 FM) playing atmospheric local broadcasts, custom MP3 channel with intermission receiver noise between tracks, channel switcher, and live sound effect controls (Spec 144 / TK-117).

## v0.48.21 - Auxiliary loadout bottom margin in portrait and tile grid in landscape

- Inventory: added bottom margin to auxiliary loadout panel in portrait mode and enabled multi-column tile grid layout in wide/square landscape mode (TK-116).

## v0.48.20 - Rodless loadout panel portrait alignment and layout fix

- Inventory: fixed portrait loadout layout when no rod is equipped, preventing two-column split and full-height stretch, and keeping primary and auxiliary panels full-width with a centered proportional rod slot (TK-115).

## v0.48.19 - Added battery variants Volt-2, Volt-3 and Volt-4

- Inventory: added three battery variants to the catalog: Volt-2 (7200 units, tier 2), Volt-3 (10800 units, tier 3), and Volt-4 (24000 units, tier 4) with dedicated assets, dynamic capacity readout, and DEV shop availability (TK-114).



