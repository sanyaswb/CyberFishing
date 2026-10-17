# Landscape split inventory (DEV switch)

Owner request, 2026-10-17. A DEV-only switch changes how the inventory opens on wide landscape screens: the inventory
takes a configurable share of the width (default 70%) on the side without the rod, and the remaining strip (30%)
stays a fully playable game. The current full-screen inventory stays the default and is unchanged.

## Owner decisions

- The game narrows into the strip: the canvas occupies only the strip and the rod stands inside it. The view is
  narrower, so less water is visible.
- The existing fishing lock stays: while tackle is in the water the inventory can be browsed, equipment changes keep
  their current warning.
- Only wider than 820 logical px and in landscape orientation; phones in landscape keep the full-screen inventory.
- DEV-only switch: production composes no split source and never activates it.
- The inventory share (70/30) is adjustable in DevTools too.

## Behavior

- `CONFIG.debug.inventorySplit = { enabled: false, inventoryShare: 0.7, defaultSide: "right" }`, edited live in
  DevTools (CONFIG.debug; `defaultSide` is a right/left toggle). `inventoryShare` is clamped to 0.5..0.85; the game
  strip is the rest.
- The split applies while the inventory is open, the switch is on, the UI surface is wider than 820 logical px and
  the window is landscape. Otherwise the inventory is full-screen, as before.
- Side: on opening with a cast rod, the inventory takes the side opposite to the rod's screen position; a rod at or
  right of the centre puts the inventory on the left, a rod left of the centre puts it on the right. Without a cast
  (owner, 2026-10-17) it opens on `defaultSide`: right by default, left when set. The side is kept while the
  inventory stays open (a share or window change keeps it).
- The canvas is resized to the strip and placed on its side; world input subtracts the strip's left edge, so casting,
  aiming, panning and the fight work inside the strip. HUD anchored to screen edges (toolbar, clock, fullscreen,
  depth selector, version badge, the DEV tools toggle in the portal layer) moves into the strip through the `--ui-edge-*`
  variables, set on the UI surface root (`UiSurfaceAdapter.setLayoutProperty`); centred HUD (hold charges,
  continue) uses the strip centre.
- The rod keeps its world position whenever the strip opens, closes or changes width: the camera pans so the rod
  stands at the centre of the new canvas, and a cast rod's screen position follows. Line, float and fight geometry
  are unchanged. A plain window resize keeps its existing behavior.
- Screen-pixel tunings (edge scroll, rod-control range) act on the narrower canvas while the split is open.

## Ownership

- `InventorySplitLayoutPolicy` (game/presentation/viewport) is pure: settings, viewport, orientation, open state and
  side in, one frozen layout out.
- `GameStageLayout` (platform/browser/ui) owns the DOM: canvas position, the UI surface edge variables and the
  inventory modal's split classes; it notifies one listener when the stage rectangle changes.
- `DevInventorySplitSource` (dev/runtime) reads the CONFIG values and the `config-updated` event.
- `GameApplication` handles the stage change in its update step (resize, then rod recentring through
  `GameViewportFacade.recenterRod`). Production passes no stage: no new listener, allocation or behavior.

## Acceptance

- Focused checks for the policy (gates, clamps, sides), canvas/input origin, the HUD edge variables and rod recentring.
- Architecture, Quick and Full green; game-cycle digest unchanged.
- Owner check in dev.html: switch on, open the inventory before and after a cast, cast/fight in the strip, change
  the share live, close the inventory.
