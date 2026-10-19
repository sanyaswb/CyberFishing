# TK-002: pointer aiming lead

Owner authorization: `tasks.md`, TK-002, 2026-10-19. Status: implemented in v0.43.0; owner acceptance pending.

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
