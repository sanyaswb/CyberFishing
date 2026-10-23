# Zones measured from the castable area, edited in the location editor

Owner request, 2026-10-23; revised the same day after the owner's answers. Status: owner answered R-Q1–R-Q3; implemented in v0.46.34 (fight sector: later, R-Q2);
owner check pending. DEV editor work: no game value changes unless a drag writes one (R-Q1).

## Request

1. (First version) A technical rod zone, and every zone from "Оверлеї гри" moved into "Зони" with the same editing as
   the other zones.
2. Owner's answers (2026-10-23):
   - Q1: no rod zone is needed.
   - Every zone that depends on the castable area and is measured from its bottom edge goes into the list "Ігрова
     область (закидання)", under "Показати зону": "Редагувати зону підсаки" and so on.
   - Every drag works exactly like the editing of the other zones.
   - Zones drawn as a half-circle (sectors) get an anchor on the castable area's bottom edge and an anchor of the
     maximum length the area stretches to.

## Findings (verified in the code, v0.46.33)

- **The rod is anchored to the screen.** `GameViewportFacade.getRodScreenX` gives the canvas middle (`ui.rod.x:
  "center"`), moved during a cast (`CastRodControl`) or a fight (`RodVisualOffsetSystem`) within the playable bounds;
  `getRodVirtualPos` maps it to the map at Y = `bounds.bottom`, the castable zones' bottom edge.
- **The zones from "Оверлеї гри", their shape and where their size comes from:**

  | Zone (`CONFIG.locations.show*`) | Shape | Measured from | Size from |
  | --- | --- | --- | --- |
  | Зона прицілювання (`showAimingZone`) | band across the screen, bottom edge to a line | castable bottom edge | rod cast: effective cast distance of the equipment; hand chum: `MAP_DB.<id>.chumCastDistance` |
  | Зона підсаки (`showNetZone`) | band | castable bottom edge | the active net's trigger (`net.getTriggerVirtualY`) |
  | Зона останнього ривка (`showLastDashZone`) | band | castable bottom edge | the hooked fish's `lastDash.triggerDistanceMeters` |
  | Зона підведення (`showCatchZone`) | half-circle on the shore (a band when the radius is 0) | rod X on the bottom edge | landing distance of the landing policy (equipped rod + reel) |
  | Сектор виважування (`showPoleFightSector`) | sector | rod tip near the bottom edge | `physics.fight.poleFightSector` (`maxAngleFromCenterDeg` 50, `shoreOpeningWidthMeters` 3) and the line radius |
  | Радіус ліски (`showFightLineRadius`) | half-circle | rod tip | the released line (runtime) |
  | Зони прикормки (`showChumZones`) | ellipses at thrown spots | each spot (not the bottom edge) | the chum item's radius |

  They are drawn only while their game state runs. Only `chumCastDistance` is a location value; the other sizes
  belong to equipment, items, fish or physics settings shared by every location, or exist only at runtime.

## Decisions (owner answers applied; R-Q1–R-Q3 open)

- **D1 No rod zone** (owner, Q1).
- **D2 Place.** In the list "Ігрова область (закидання)", right after "Показати зону", one block per dependent zone:
  "Показати <зону>" (the existing `CONFIG.locations.show*`, so it still applies in the game) and "Редагувати <зону>"
  (an editor switch like "Редагувати ігрову"), in the order прицілювання, підсака, останній ривок, підведення, сектор
  виважування, радіус ліски, each with its colour swatch. "Зони прикормки" are not measured from the bottom edge: their
  "Показати" switch goes to the same list without editing. The master "Показувати оверлеї гри" (`debugVisuals`) leads
  the block; the section "Оверлеї гри" is removed.
- **D3 Preview.** While the editor is on, every shown dependent zone is drawn from the castable area's bottom edge with
  the current values, without casting or fighting (the fish for "останній ривок": R-Q3).
- **D4 Dragging works like the other zones.** Hover fills the zone, the same edge band and cursor take an edge, and
  the value snaps to the map's cell step (`cellSize × snapCells`, as edges do), converted to the zone's metres by the
  water metric. Bands have one edge: their far line. A drag writes through the validated config path and is reverted by
  "Скинути зміни зон до коду" when the value is the location's.
- **D5 Half-circle zones and sectors get two anchors** (owner): a **base anchor** on the castable area's bottom edge,
  dragged only along that edge (the preview's centre; the game's real centre is the rod), and a **length anchor** at the
  end of the radius on the zone's middle line, dragged along it: the maximum length the zone stretches to. The sector
  also keeps its side edges: dragging one changes its half-angle. Anchors are drawn as handles in the zone's colour.
- **D6 What a drag writes** (R-Q1, recommended):

  | Zone | Far line / length anchor writes | Base anchor |
  | --- | --- | --- |
  | Прицілювання (hand chum) | `MAP_DB.<id>.chumCastDistance` (the location's, exported with it) | — |
  | Прицілювання (rod) | nothing: equipment stats; shown only | — |
  | Підсака | the active net's trigger distance (the net item) | — |
  | Останній ривок | `lastDash.triggerDistanceMeters` of the chosen fish | — |
  | Підведення | the landing distance of the landing policy in use | preview only |
  | Сектор виважування | preview length only (the game uses the line); sides write `maxAngleFromCenterDeg` | preview only |
  | Радіус ліски | preview length only (runtime line) | preview only |

  "Preview only" values live in the editor state, per location, and reset with the location.

## Checks

- `zone-editor`: the castable list holds the dependent blocks in order after "Показати зону"; each "Показати" writes
  its `CONFIG.locations.show*`; previews are measured from the castable bottom edge; a band's far line and a sector's
  length anchor snap to the cell step and write the mapped value (D6) through the validated path; the base anchor moves
  only along the bottom edge; sector sides write the half-angle; "Оверлеї гри" is gone.
- Game-cycle report unchanged (editor work); a drag that writes a game value changes only the session's overrides.
- Full run once.

## Owner questions

- **R-Q1** Accept the write table D6? Or should these distances become per-location values measured from the castable
  bottom edge (then the game reads them instead of the equipment, net or fish values: a gameplay change with a
  backlog entry)?
- **R-Q2** The sector's sides edit `maxAngleFromCenterDeg` (shared physics setting): yes (recommended), or keep the
  sector to the two anchors only?
- **R-Q3** "Останній ривок" depends on the fish: choose the fish in a select under its block (recommended), or show it
  only while a fish is hooked?

## Owner answers to R-Q1–R-Q3 (2026-10-23)

- **R-Q1:** show the real data; item physics is never changed for display. So the dependent zones are read-only
  previews of the values the game uses, with one exception: **hand chum** is a location setting
  (`MAP_DB.<id>.chumCastDistance`), so its zone is shown at once, even without hand chum equipped, and its far line is
  dragged like a zone edge. The **net zone** is shown from the equipped net. This replaces D6: nothing else writes.
- **R-Q2:** the fight sector needs its own work later; here it keeps only its show switch (no preview, no anchors).
- **R-Q3:** "останній ривок" shows the fish chosen in a select under its block.
- Consequence for D5: half-circle zones (підведення, радіус ліски) keep the base anchor on the bottom edge (moves the
  preview along it); their length is the real value, so the length anchor is drawn as a marker, not dragged.
- **Net (owner, later the same day):** like the fish, the net zone shows the net chosen in a select of the catalog's
  nets, not the equipped one.

## Implementation (v0.46.34)

- `src/dev/location/castable_zone_readings.js`: the real values through the game's own code — `EquipmentRules`
  (rod cast with the selected depth), the location's `chumCastDistance` (300 when unset, as `CurrentLocation`), `Net`
  over a catalog net's base stats, `LandingPolicyResolver` (equipped rod and reel), the fish's `lastDashTrigger`
  through `FishPhysicsProfile` and `FishBehavior.lastDashTriggerDistanceMeters` (the fight's own formula, now static),
  the equipped line's length. Production passes `getEquipment`, `equipmentRules` and the hook depth to the DEV builder.
- `src/dev/location/castable_dependent_zones.js`: the dependent zones' editor state (editing, hover, chosen net and
  fish, half-circle anchors per location), previews (bands from the bottom edge; water half-circles in perspective as
  polygons), hit-testing and drags. Only the hand chum far line writes (`MAP_DB.<id>.chumCastDistance`, snapped to the
  cell step); anchors stay in the editor. The drag controller tries its handles first; the geometry builder redraws it
  only when its revision changes (real values are re-read each frame while the editor is on).
- Annotation records gain `shape: "polygon"` (screen `points`), drawn by `PixiAnnotationRenderer` (`poly`) and the
  Canvas fallback.
- The castable list: "Показувати оверлеї гри", the game's show switches (hand chum shares the aiming switch),
  "Редагувати ручну прикормку / зону підведення / радіус ліски", the net and fish selects; "Оверлеї гри" is removed.
- Known limit: `chumCastDistance` is a session override; the zone file (spec 130) carries only zones.

## Revision 2 (owner, 2026-10-23, after v0.46.34)

Owner: "всі сектори залежать від довжини ліски правильно?" — verified: in the game the fight sector and the line radius
share one radius, the distance from the rod to the float (`FightAreaRenderFrameBuilder`: `limitRadiusPx` = |float −
rod| on the base plane; the line radius is the "full radial limit of the released line"). The landing zone does not
depend on the line (rod + reel landing distance).

- **R2-1 Line length.** An editor value "Довжина ліски, м" (default 10 m, session only): the released line for every
  line-dependent preview. The line radius is a half-circle of that length round the rod.
- **R2-2 Float anchor.** Because nothing can be cast while editing, a conditional float anchor sits at the sector's edge
  (straight ahead at the line length by default) and can be dragged within the line length over the water; the fight
  sector is drawn as the game draws it from that float (`PoleFightSectorGeometry` on the base plane: radius = rod →
  float, apex behind the shore, the configured half-angle). Its switch: "Рухати поплавок".
- **R2-3 Origin.** All rod-based previews start at the rod's real position (the game's rod screen X on the shore line).
  The base-anchor editing and the line-radius editing of v0.46.34 are removed (owner: not needed).
- **R2-4 Hand chum.** "Показати зону прицілювання" is renamed "Зона ручної прикормки"; the rod-cast aim band is no
  longer previewed. Its far line stays draggable ("Редагувати ручну прикормку", `chumCastDistance`).
- **R2-5 Test chum zones.** "Додати зону прикормки" adds an editor-only chum zone (session, per location) drawn by the
  game's own chum renderer (`world.chumZones`, full bonus), so it looks exactly like a thrown spot; like the other zones
  it has a number select and delete, its middle (30 %) moves it and its edge resizes it (snapped to the cell step).
  Item parameters are never changed.
- **R2-6 Own tab.** Every zone inside the castable area (hand chum, net, last dash, landing, fight sector, line radius,
  chum zones) moves from the castable list to its own section "Зони риболовлі" right after it.

### Revision 2 implementation (v0.46.35)

- `CastableDependentZones` now previews hand chum, net, last dash and landing (the rod-cast aim band is gone), and the
  line radius and the fight sector from the editor's line length (default 10 m) and a conditional float (an offset
  from the rod on the base plane, straight ahead at the line length by default, kept within it, "Рухати поплавок").
  The sector is `PoleFightSectorGeometry` with radius rod → float and the arc between its boundary intersections, as
  `FightAreaRenderFrameBuilder` draws it. Previews start at the rod's real position (the game's rod screen X); the
  base anchors and line editing of v0.46.34 are removed. Production now passes `getRodScreenX` instead of the rules
  and hook depth; `CastableZoneReadings` lost `rodCastPx` and `lineMeters`.
- `src/dev/location/chum_test_zones.js`: editor-only chum zones per location; `LocationDebugRenderFrameBuilder` adds
  them to `world.chumZones` (full bonus), so the game's chum renderer draws them; middle moves, rim resizes, both
  snapped to the cell step; the game's `showChumZones` hides them too.
- The section "Зони риболовлі" follows the category lists; the castable list no longer holds these rows.

### TK-068 (v0.46.36)

- A show switch did not redraw the preview (refresh compared only real values); the switches now take part. The rod
  port gives null while no cast moved the rod: that is the canvas middle, not `Number(null)` = 0.
- Parent dependencies use the spec 131 prerequisites (blocked switch, highlighted parent): the fight-area overlays (net,
  last dash, landing, sector, line radius) need `debugVisuals` as in the game, and their previews follow it; the
  editing switches need the editor and their zone shown.
- Owner: showing needs no editor. Previews and test chum zones draw with the editor off; hover and drags need it.

## Revision 3 (owner, 2026-10-23, after v0.46.38)

Owner: after a real cast the game drew the same zones in other colours with thick outlines ("мені це не подобається");
with "Брати значення зі спорядження" the zones must follow the real float, and in edit mode the anchor must sit on the
real float and move it within the cast's real limits.

- **R3-1 One look.** The game's fight-area overlays (landing, last dash, net, fight sector, line radius) take the
  editor's look: one colour table (`game/presentation/styles/fishing_zone_colors.js`, shared by the game and the DEV
  editor), fill alpha 0.15, outline alpha 0.6, 1 px, solid lines; the line radius is filled like the editor's half-circle.
  The sector's axis and dashes are dropped; a clamped sector keeps its own (brighter) outline. Production visuals only:
  no gameplay value changes.
- **R3-2 Real float.** While "Брати значення зі спорядження" is on and a cast is out (waiting, biting or fighting), the
  game draws these zones from the real float itself, so the editor does not draw its previews of them; the float anchor
  is drawn on the real float.
- **R3-3 Moving the real float.** With "Рухати поплавок" on (editor enabled) and the tackle waiting (no fish), dragging
  the anchor moves the real float: it is placed on the water within the equipped line's reach (the same
  `EquipmentRules.getMaxCastDistance` budget as `GameState.constrainTackleToLine`, on the base plane, the selected depth
  included), its velocity is cleared, and the waiting state's own constraints apply from the next frame. While a fish is
  on (biting, fighting) the anchor only shows the float.

### Revision 3 implementation (v0.46.39)

- `game/presentation/styles/fishing_zone_colors.js`: the shared colours and look; `FightAreaStyleResolver` builds the
  game's styles from it (`lineWidth` 1, no default dash); `PixiFightAreaRenderer` and `FightAreaRenderer` use the
  style's width, draw the net line solid, drop the sector axis and fill the line radius; `ui.catchZone`'s colour
  overrides are removed from the game config. `DEPENDENT_ZONES` take the same colours.
- `CastableDependentZones` reads the cast float (`getFloat`, `getGameStateName`: waiting, biting, playing). With the
  equipment's values and a cast out it draws only the anchor on the real float (the game draws the overlays); while
  waiting and "Рухати поплавок" is on, dragging moves the real float within `getMaxCastDistance` (selected depth) on the
  base plane and on the water (`checkWater`), velocity cleared. Production passes these ports to the DEV builder.
