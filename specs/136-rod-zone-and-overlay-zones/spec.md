# Rod zone and the game's overlay zones in the location editor

Owner request, 2026-10-23. Status: specified; owner answers Q1–Q5 pending, not implemented.
DEV editor work; whether the rod zone also changes the game is owner question Q1.

## Request

1. Create a zone "Вудка": a circle one grid cell across, a purely technical zone from which the zones that depend on
   the rod's position are drawn. Place it at the bottom centre; it moves only left and right, with the same movement
   logic as the rod. Colour white.
2. Move every zone that is in "Оверлеї гри" into "Зони", after "Редагувати рухомі", and give them the same editing
   as the other zones.

## Findings (verified in the code, v0.46.33)

- **The rod is anchored to the screen, not the map.** `GameViewportFacade.getRodScreenX` returns the cast rod's screen
  X while a cast is out (`CastRodControl`), otherwise `ui.rod.x` (`"center"`: the canvas middle) moved by
  `RodVisualOffsetSystem` and clamped to the playable bounds on screen. `getRodVirtualPos` maps that screen X to the
  map and sets Y to `bounds.bottom`, the bottom edge of the castable zones (`LocationMap.getCastableBoundsVirtual`).
  So the rod's map X follows the camera (`MAP_DB.<id>.initialAlignment` places the camera at start), and its Y follows
  the castable zones. There is no authored rod position per location.
- **The overlays are drawn only while their game state runs**, from runtime state, and their sizes come from
  different owners:

  | Overlay (`CONFIG.locations.show*`) | When | Anchored at | Size from |
  | --- | --- | --- | --- |
  | Зони прикормки (`showChumZones`) | chum spots thrown | each spot | the chum item's radius (item catalog) |
  | Зона підведення (`showCatchZone`) | fight | rod X on the shore line | landing distance: landing policy of the equipped rod + reel |
  | Зона останнього ривка (`showLastDashZone`) | fight | shore line, full width | the hooked fish's `lastDash.triggerDistanceMeters` |
  | Зона підсаки (`showNetZone`) | net active | shore line, full width | the net's trigger (`net.getTriggerVirtualY`) |
  | Зона прицілювання (`showAimingZone`) | scouting | the rod's shore line | effective cast distance of the equipment, or the location's `chumCastDistance` for hand chum |
  | Сектор виважування (`showPoleFightSector`) | pole fight | rod tip | fight physics sector settings and the line radius |
  | Радіус ліски (`showFightLineRadius`) | fight | rod tip | the released line |

  Only `chumCastDistance` is a location parameter; the others belong to equipment, items, fish or physics settings
  shared by every location. Dragging an overlay in the editor therefore edits a value of one of those owners, not a
  zone of the location.
- The editor's "Зони" section today: "Редагувати ігрову / перешкоди / зачепи / рухомі", "Редагувати всі", "Показати
  всі", then one list per category (physics, show, number, shape, tree, delete, add). The overlay switches live in
  "Оверлеї гри (спільне для всіх локацій)" with the master `debugVisuals`.

## Decisions (recommended; owner approval pending)

- **D1 Rod zone.** A new editor category "Вудка" (`rod`), colour `#ffffff`, drawn as a circle one map cell
  (`CONFIG.locations.cellSize`) across. Its centre is on the shore line (the castable zones' bottom, the same Y as
  `getRodVirtualPos`), so it never moves vertically; dragging moves it horizontally, clamped to the castable zones'
  horizontal extent (the rod's playable bounds), snapped to the cell step like the other zones. Default: the middle of
  that extent. It has "Показати зону" and "Редагувати вудку" like the other categories, no physics switch (it has no
  physics) and exactly one item (no add/delete). Q1 decides where it lives.
- **D2 Overlay zones in "Зони".** After "Редагувати рухомі" come "Редагувати <overlay>" switches for the overlays and
  one list each after the four zone lists, with the overlay's colour swatch: "Показати зону" is the existing
  `CONFIG.locations.show*` switch (so it still applies in the game), and the master "Показувати оверлеї гри"
  (`debugVisuals`) moves to the top of the overlay lists. "Оверлеї гри" disappears as a section.
- **D3 Preview from the rod zone.** While the editor is on, each shown overlay is drawn as a static preview from the
  rod zone with the current values (the equipped rod/reel/line, the location's chum distance, the physics settings; for
  "останній ривок" a chosen fish, Q3), so it can be seen and edited without casting or fighting.
- **D4 Editing an overlay = editing its size parameter.** Dragging the preview's edge changes the value it is drawn
  from, through the validated config path, snapped to whole metres (Q4 for the step). The parameter each overlay edits
  is owner question Q2; the recommended mapping:

  | Overlay | Drag edits | Owner of the value |
  | --- | --- | --- |
  | Зона прицілювання (hand chum) | `MAP_DB.<id>.chumCastDistance` | the location (exported with the location) |
  | Зона прицілювання (rod) | not edited: equipment stats | — (shown only) |
  | Зона підведення | the landing distance of the landing policy in use | landing policy config |
  | Зона підсаки | the active net's trigger distance | the net item |
  | Зона останнього ривка | `lastDash.triggerDistanceMeters` of the chosen fish | the fish profile |
  | Сектор виважування | the sector's angle (edge drag) | fight physics config |
  | Радіус ліски, Зони прикормки | not edited: runtime values | — (shown only) |

- **D5 Stages.** Stage 1: the rod zone (D1) and the overlays moved into "Зони" with show switches and previews (D2,
  D3). Stage 2: dragging overlay edges (D4), after the owner confirms the mapping. Each stage is one patch version.

## Checks

- `zone-editor`: the rod zone is a cell-wide circle on the shore line, white; a drag moves only X, clamped to the
  castable extent and snapped; it has no physics switch, add or delete; the overlay lists follow "Редагувати рухомі"
  in order and their show switches write `CONFIG.locations.show*`; previews are built from the rod zone; stage 2: an
  edge drag writes the mapped parameter through the validated path.
- Game-cycle report unchanged unless Q1 makes the rod zone a game value (then a gameplay entry and a reasoned
  re-baseline, per DEVELOPMENT_RULES "Gameplay changes").
- Full run once per stage.

## Owner questions

- **Q1 Where the rod zone lives.** (a, recommended) editor only: a preview anchor in the editor state, reset per
  location, nothing changes in the game; (b) a location value exported with the zones (`zones.rod`) that the game uses
  as the rod's start: the camera opens so the rod stands there (a gameplay change, replaces `initialAlignment.x` for
  the rod).
- **Q2** The drag mapping in D4: accept it, or name other parameters (for example per-location landing distances).
- **Q3** "Останній ривок" depends on the fish: preview with a chosen fish from a select (recommended), or only while a
  fish is hooked?
- **Q4** Snap for overlay sizes: whole metres (recommended) or the cell step?
- **Q5** Stages as in D5 (recommended), or everything in one go?
