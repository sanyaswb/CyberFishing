# Feature Specification: Sliding float

**Created**: 2026-10-11 · **Status**: Implemented · **Kind**: gameplay mechanic (backlog G-002)

## Owner decisions (2026-10-11)
- Maximum float depth stays the free line: line length − rod length. The line runs along the whole rod and hangs
  down from the tip by the same amount.
- Cast distance keeps the subtraction: line − selected depth, never below the rod length. With this maximum depth, the
  proportional variant gives the same numbers, so no DEV switch is added.
- A sliding float is a new item. With it the selected depth costs no cast distance. It exists only in the item
  catalog: not in the starting inventory, no save change.

## Verified state before the change
- `FloatTackleLineBudgetPolicy` applied to float/pole rods with a float: max depth = line − rod, max cast =
  max(rod, line − depth), surface depth (0.1 m) costs nothing.
- The catalog had one float, `float_day`. Floats had no mount type.
- Line length: without a reel = rod × 2 (`noReelRodLengthMultiplier`), with a reel = min(line, reel capacity).

## Change
- Floats get the gameplay stat `mount`: `"fixed" | "sliding"`. Absent means fixed. `float_day` is now explicitly
  `mount: "fixed"` (same behavior).
- `float_sliding` "Ковзний поплавок" (🪶): the same stats as `float_day` with `mount: "sliding"`, progression group
  `float.day`. The display label "Кріплення" maps the values to Глухий/Ковзний.
- `FloatTackleLineBudgetPolicy`: a sliding float costs no depth line. Max depth and the depth selector are unchanged.
  The cast limit and the fight's active line length (both read `maxCastDistanceMeters`) stay at the full line.
- `item-progression` check: the catalog has 22 gameplay items (was 21).

## Evidence
- `float-depth-cast` check: a test-first scenario failed before the change (sliding float at 3 m: expected 10 m,
  received 7 m). It passes now: sliding float at 0.1/3/5 m on a 5 m pole with 10 m line casts 10 m; max depth stays
  5 m; a reel rod at max depth keeps the full cast; an explicit fixed float keeps the 7 m.
- Catalog assertions: `float_day` is fixed, `float_sliding` is sliding.
- Game-cycle report unchanged (`7b9baea3…ed5b6`, baseline file unchanged).
- Architecture 2/2, Quick 13/13, Full 39/39.
- Browser (Claude, built-in browser, dev.html): the day float card shows the new "Кріплення" row.
  - The value shows as `fixed`, not «Глухий»: an existing display issue, the same as "Огрузка light" (backlog G-003).
  - The sliding float cannot be obtained in game until the DEV item grant (next spec).
