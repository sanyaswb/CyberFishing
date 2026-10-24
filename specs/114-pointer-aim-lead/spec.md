# TK-002: pointer aiming lead

Owner authorization: `tasks.md`, TK-002, 2026-10-19. Initial implementation: v0.43.0.
Owner amendment: viewport-centred lead, 2026-10-19, v0.44.0; owner acceptance pending.
Owner amendment: enable that lead only at the corresponding location camera edge, v0.45.0.

## Initial implementation (v0.43.0, historical)

Pointer aiming starts at the contact, then adds a symmetric smoothstep lead relative to its initial horizontal
coordinate. `casting.pointerAim.maxLeadPx` and `rampDistancePx` default to 100 logical viewport pixels each.
The same clamped coordinate drives preview, edge pan and release for casting, recasting and hand chum.
Keyboard speed, vertical power, accuracy, flight delay and water/distance validation retain their owners and rules.
`CastPowerAim` owns transient aiming state; bootstrap supplies configuration. No scene-only offset or extra loop.

Acceptance: centre/half/full ramp, both directions, return through origin, edge clamp, release without move,
reset and live disabling in `task-interactions`; existing recast/water-metric/game-cycle checks. Owner checks
index/dev in portrait/landscape and split inventory. Visual and phone performance acceptance remains with owner.

Tools replaced or obsolete: none.

Validation: focused task-interactions, water-metric and recast checks; Architecture + Quick + Full (63 checks).
Game-cycle baseline is unchanged. See G-084 and the completed-work block in tasks.md.

## Owner amendment: recenter at the viewport midpoint (G-088)

This revision supersedes the initial-contact anchor and 100px maximum above. The pointer's current horizontal
position relative to the current logical game viewport midpoint determines the lead from the first aiming update:
`dx = pointerX - viewportWidth / 2`, `q = min(1, abs(dx) / rampDistancePx)`,
`aimX = clamp(pointerX + sign(dx) * maxLeadPx * q * q * (3 - 2 * q), 0, viewportWidth)`.
The default maximum is **80 logical viewport pixels**; the existing **100px ramp** remains configurable.
The lead is positional, not directional: reversing motion preserves its side until crossing the viewport centre.
At the centre the lead is zero regardless of the original contact or gesture history. An off-centre pointerdown
uses the same mapping immediately; there is no contact-dependent zero lead. A resize uses the new viewport width.
Split layout uses the injected game canvas width and canvas-local input, not the whole browser window.

At width 400, starts at 40, 200 or 360 all map current X values 100/150/200/250/300 to 20/110/200/290/380.
At X=80/320 the line reaches the left/right edge. The clamped lead never exceeds 80px with the default config.
Preview, edge pan, release and target resolution continue sharing the calculated coordinate. The start point
remains release metadata and the vertical power anchor; keyboard aiming, power and cast validation retain their rules.

Reproduction before the fix: with an 80px configured maximum, start X=40, move to 300 and return to 200;
`task-interactions` fails with actual X=280 instead of 200. Regression coverage includes both off-centre starts,
reversals, clamp, release without a final move, preview/target identity, edge pan, resize, default/live config and keyboard.
Validation: focused task-interactions/water-metric/recast/game-cycle passed, Architecture 4/4, Quick 37/37 and Full 63/63.
Save round-trip remains byte-identical and the game-cycle baseline is unchanged; no guards or baselines weakened.
Tools replaced or obsolete by the amendment: none. Owner verifies index/dev in portrait, landscape and split layout.

## Owner amendment: lead only at the corresponding camera edge (G-090)

The viewport-centred 80px/100px curve remains, but its lead is now conditional. With the pointer left of centre,
apply negative lead only if the camera is clamped at the location's left horizontal pan limit. With the pointer
right of centre, apply positive lead only at the right limit. If there is still pan room on that side, `aimX`
equals the clamped raw pointer X. Being at the opposite edge never enables lead. At the centre it is always zero.

`ViewportProjector` owns the camera position and scroll limits, so expose a read-only directional edge query
there and reuse the already injected projector in `CastPowerAim`. Do not derive camera limits from castable water
bounds, UI screen edges or whether a pan callback happened to run. No cached mutable edge flags or browser reads.
If no edge query is supplied, use raw pointer X; do not assume the camera is at an edge.
If the whole location fits horizontally, both edges are reached and the curve works on both halves.

Edge pan continues using the current aim coordinate. After a nonzero pan step, recalculate the pointer mapping
against the actual clamped camera so reaching/leaving a limit is reflected in the same update. Release rechecks
the current edge even without a final pointermove; preview and target retain the same coordinate owner.
Keyboard aiming, vertical power, accuracy, cast readiness, saves and scene rendering stay unchanged.

Regression before the change: a free camera and pointer X=250 in a 400px viewport produce X=290 instead of 250.
Cover free pan, each directional limit, wrong-side exclusion, centre/reversal, release after leaving a limit,
same-update arrival/departure, whole-location view and resize/narrow split width with the real projector.
Validate focused checks, Architecture + Quick + Full and unchanged game-cycle/save baselines. No obsolete tools.

Validation v0.45.0: focused task-interactions / viewport / recast-aim, Architecture 4/4, Quick 37/37, Full 63/63.
Game-cycle baseline and inventory save round-trip remain unchanged. No tools, fixtures or dependencies replaced;
owner phone/desktop visual acceptance is pending in tasks.md.

## Owner amendment: no jump when the camera stops at a limit (TK-091, v0.47.22)

Owner 2026-10-24: when the screen stops at the map edge during aiming, the finger is no longer at the centre, so the
line jumps. Cause: the edge pan only runs while the pointer is in the outer edge strip (35% of the width each side),
so when the camera reaches a limit the G-090 curve, measured from the viewport centre, is already near its maximum
and appears in one update (400 px viewport, pointer X=100: line 100 -> 20).

The curve and its configuration stay; only its origin changes. When the aim's own edge pan brings the camera to a
limit, `CastPowerAim` keeps the pointer X of that update as the origin on that side (never past the centre), and the
lead there is `leadFor(|pointerX - origin|)` for the pointer beyond the origin, zero inside it. At arrival the line
stays under the pointer and then leads smoothly; it still reaches the screen edge before the pointer. The origin
returns to the centre when the camera leaves that limit, on a new gesture, `reset` or a viewport width change. A
camera already at a limit when the gesture starts (or a whole-location view) keeps the centred curve unchanged.
Preview, edge pan, release and target keep one coordinate; keyboard aiming is unchanged.

Reproduction before the change: `task-interactions`, real `ViewportProjector`, the aim's pan reaching the right
limit at pointer X=350 gave 400 instead of 350. Coverage adds growth from the stop point on both sides, reaching the
screen edge, no lead inside the stop point and the width reset. Tools replaced or obsolete: none.
