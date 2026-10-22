# Zones measured from the castable area, edited in the location editor

Owner request, 2026-10-23; revised the same day after the owner's answers. Status: specified; owner answers R-Q1–R-Q3
pending, not implemented. DEV editor work: no game value changes unless a drag writes one (R-Q1).

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
