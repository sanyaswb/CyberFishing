# One page, several screens: the House becomes a screen

Owner decisions, 2026-10-15: one page with several screens instead of separate HTML pages. `fisherman-house.html` is
removed completely and every link is rewritten; the structure is built for the planned preloader optimization. Access
to the House belongs to the future lobby; during development the button stays in DEV. Further recorded decisions:
background loading order is the current scene, then owned/available items and the starting locations, then the House;
the portrait loader poster may be cropped to 9:16.

## Why

The House ran as a second document (`fisherman-house.html`, its own entry; in DEV an iframe of
`dev.html?page=house&embedded=1`). It composed its own config runtime, game clock, live bait service and UI surface
from `localStorage`, synchronised with the game through `postMessage` handoffs (config overrides, the DEV clock rate,
the return message). For the preloader this meant decoded images could not be shared (a House prefetched by the game
would be decoded again in the iframe), two writable owners of the same live bait and clock state, and module/config
work repeated on every visit.

## Change

- `engine/screens/ScreenHost`: one active screen above the base game. `open(id)` suspends the base (the game loop
  stops), loads the screen through its lazy factory and keeps it until `close()`, which disposes it and resumes the
  base. A stale factory result (closed or disposed meanwhile) is disposed at once; a failed factory resumes the base.
- `presentation/house/house_screen_markup.js`: the House markup (formerly the page body), one source for the screen,
  the UI catalog and the checks. It is instantiated only when the screen opens, so it costs nothing at startup.
- `bootstrap/production/house_screen_composition.js` (`composeHouseScreen`, replaces `startFishermanHouse`): mounts a
  `.house` root into the page's `UiSurfaceAdapter` and composes the House over the session's own services:
  `GameCompositionRoot.getSessionServices()` returns the live bait service and the game clock it already built.
  No second config runtime, clock, live bait, storage listener or UI surface; no handoff messages.
  `HouseView` and `HouseNavigationController` listen on the injected screen root instead of `document.body`.
  The return control closes the screen.
- DEV: `development_game_startup` composes the `ScreenHost` with the House factory; DevTools "Будинок рибалки 🏠" opens
  it. The DEV clock rate travels between the game's and the House's time controls in memory (suspend/resume), as the
  handoff did. `dev.html?screen=house` opens it right after startup. The iframe route `dev.html?page=house`,
  `development_house_startup.js`, `development_page_startup.js`, `house.entry.js` and the House page are removed.
  `EmbeddedPageOverlay` stays for the UI catalog page.
- Production `index.html` is unchanged: the House is not reachable in production until the lobby composes the same
  `composeHouseScreen` (it then also links `house.css`).
- Release and tooling: the Pages builder, version copy, architecture entries, CSS page reader and checks no longer
  know a House page; the House assets stay under `assets/` and are released.

No gameplay, save or formula changes; the game-cycle report is unchanged.

## Preloader foundation this enables

The House screen declares no loads of its own yet. With the preloader steps it registers its asset group
(`scene.house.*`) with the shared queue: `prefetch` in the owner's order (after the current scene, owned items and
starting locations), promoted to `interactive` when the screen opens; its decoded images stay in the shared store while
the game runs.

## Verification

House (markup from the module, screen composition over injected services, return closes the screen), house navigation,
DEV time (rate carried between game and House controls), config runtime (DEV button opens the House screen), UI
catalog (markup module), CSS usage, Pages release, embedded overlay, architecture; new `ScreenHost` assertions.
Architecture, Quick, Full. Owner browser check of the DEV House flow; no browser testing by Claude.
