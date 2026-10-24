# Feature Specification: Drawing new zones on the grid

**Created**: 2026-10-24
**Status**: Implemented in v0.47.20; owner visual acceptance pending
**Input**: Owner 2026-10-24: «Додати зону» copies the previous zone or makes x 0, y 0, 1 x 1, which is inconvenient. A new
zone should be drawn on the grid: LMB on a cell creates it, dragging paints a rectangle along both axes, RMB removes cells,
and «Застосувати» saves the zones. While drawing, the area where a zone cannot be added is dimmed, as in the mask mesh.

## User Scenarios & Testing

### User Story 1 — Draw a zone with one press (P1)
The owner presses «Додати зону» in a category. The editor enters the drawing mode: the area where a zone of this category
cannot be added is dimmed (as the mesh dims outside its host zone), the coordinate rows are empty until a zone is drawn.
A LMB click on a cell creates a one-cell zone; a press and drag paints every cell between the press cell and the pointer
along both axes (5 left and 5 down = 25 cells), shrinking while the pointer goes back (5 up again = 5 cells), all snapped to
the current grid (CONFIG.locations.cellSize). Releasing LMB makes that rectangle zone N.
Acceptance: the rectangle always spans the press cell and the current cell, inclusive; a drag never paints into the dimmed
area (it stops at its edge); the zone's x/y/w/h are in design cells like every authored zone.

### User Story 2 — Several zones in one session, all listed (P1)
Every further LMB press creates another zone with the next number. «Номер зони» is «Всі» by default in this mode and the
coordinate list shows every new zone's coordinates. New zones are moved by their middle and resized by their edges exactly
as in ordinary editing (TK-056/058, snap, window limits).
Acceptance: the list shows zone k: x, y, w, h for every new zone; moving/resizing a new zone updates its row.

### User Story 3 — Remove cells with RMB (P1)
A RMB press and drag marks a rectangle the same way and removes those cells from the new zones on release: a new zone
inside it is removed, a zone partly covered loses the covered part (D2).

### User Story 4 — Apply (P1)
«Застосувати» ends the mode: the dimming goes, the new zones are appended to the category (session config, then export as
usual) and every zone can be chosen by number again, with its mask mesh. «Скасувати» ends the mode without adding anything.
Acceptance: while drawing, no mask controls («Маска увімкнена», «Видалити маску», «Меш маски») are offered and existing zones
of the category are not taken by the drag tool; after «Застосувати» the new zones behave like any authored zone.

## Requirements
- FR-001: Drawing mode per category, entered by «Додати зону», left by «Застосувати» or «Скасувати»; it needs the same
  prerequisites as editing the category (editor on, the location on screen, the category's physics and editing on).
- FR-002: LMB press/drag/release creates one rectangle zone per press; RMB press/drag/release removes cells (D2).
- FR-003: The forbidden area (D1) is dimmed and never painted; the draft is drawn with the category colour.
- FR-004: «Номер зони» shows «Всі» by default in the mode; the rows list every new zone's coordinates; new zones move and
  resize like ordinary zones; existing zones stay as they are and are not taken.
- FR-005: New zones are written to the session config as they are drawn (validated config path, export unchanged), so
  they draw, list and move like any zone. «Застосувати» ends the mode keeping them; «Скасувати» writes the category back
  as it was. The editor, the category's editing or the location going away ends the mode and keeps what was drawn.
- FR-006: Moving zones keep their own «Додати зону» (D3).
- FR-007: DEV only; production, gameplay, formulas and the game-cycle digest are unchanged.

## Owner decisions (2026-10-24)
- D1: the castable area is drawn over the whole map; obstacles and snags only inside the castable bounds; the rest is dimmed.
- D2: a RMB rectangle cuts its cells out: a new zone it partly covers splits into the rectangles left (up to four, new
  numbers); a covered zone is removed; zones that were there before the mode are never cut.
- D3: moving zones are not drawn; their «Додати зону» stays as it was.

## Assumptions
The grid is the current map grid; one click = one cell. New zones are plain rectangles (no shape, no mask) until applied.
Owner checks visuals in dev.html; the agent performs functional checks only.

## Implementation
`src/dev/location/zone_drawing.js` (ZoneDrawing: session mode, whole grid cells inside the allowed area, LMB rectangle,
RMB cut via subtractRect, apply/cancel, sync ends the mode when its prerequisites go), composed in the DEV startup and
shared by the drag tool (only new zones are taken; a press off them draws, RMB cuts; context menu suppressed), the
geometry builder (the viewport outside the allowed area dimmed like the mesh; the RMB rectangle drawn) and the section
(«Додати зону» turns on the editor and the category's editing, then draws; the list shows «Застосувати», «Скасувати» and a
«Зона N» tree per new zone; no number list, mask or delete while drawing; «Застосувати» returns to «Всі»). Check
`zone-drawing` (tools) on the real LocationMap and config edits.

## Revision 2 (owner 2026-10-24)

Owner: (1) a RMB cut that takes a few cells of a zone splits it into two zones lying against each other: a zone must not
be split needlessly; zones of one type that overlap or touch side by side after a move merge into one (not the fishing
zones); (2) while zones are drawn, controls that do not concern that zone are inactive; (3) «Редагувати все» is a
switch: on makes everything editable, off puts everything back as it was.
Decisions: after a cut the zone keeps its shape (a square with a corner cut is one L-shaped zone); only pieces that fall
apart become separate zones. Merging happens on release, while drawing and in ordinary editing. Moving zones are not
touched (owner will specify them separately).

- R2-1: `src/dev/location/zone_cell_shapes.js`: zones as cells on a common unit (the map step, or a finer mask cell);
  `cutZones` rebuilds each new zone from its remaining side-connected pieces (a full rectangle stays plain, any other
  piece is its bounding rectangle with an automatic mask, so an L or a ring stays one zone); `mergeTouchingZones` joins
  zones whose cells overlap or share a side (corners alone do not join) into one zone with the kept zone's other fields.
  Adaptive-width zones, disabled masks and zones off the unit grid are left as they are. The automatic mask is the
  zone's shape; the mesh is still not offered while drawing.
- R2-2: merging on release: a new zone drawn or moved in drawing mode merges with the other new zones; «Застосувати»
  merges the category as a whole; in ordinary editing a moved or resized castable/obstacle/snag zone merges with the
  zones of its category it overlaps or touches (a click that changes nothing merges nothing). The merged zone stays the
  shown one. Moving zones and the castable area's fishing zones are not merged.
- R2-3: while drawing, the editor section gets `zone-editor--drawing` and the drawn category's list
  `zone-editor__drawing-list`: every other row and section title is dimmed and takes no pointer input (dev-tools.css).
- R2-4: «Редагувати все» is a switch; on records each value it changes (editor, category editing, physics, the game
  show switches, hand chum, chum zones, float) and off writes exactly those back; what was on before stays on.
- Checks: zone-drawing (cuts: L, ring, two halves, edge strip, missed/covered/below base; merges: side, overlap with the
  kept fields, corners, base, adaptive, masked; drawing ring and join; ordinary drag merge and plain click; lock
  classes), zone-editor (switch on/off restore).
