# TK-006: bare-line rod speed

Owner authorization: `tasks.md`, TK-006, 2026-10-19. Status: implemented in v0.43.0; owner acceptance pending.

The canonical EquipmentReadModelFactory projects whether the equipped tackle/float root creates terminal load.
This includes nested tackle components, even an empty feeder, and excludes backpack stock and auxiliary gear.
Waiting/Biting pass that immutable reading to CastRodControl. A bare line uses its configured stationary speed
on both sides of the slack boundary; loaded equipment retains moving speed and same-frame time splitting.
Geometric tension, water/length limits, bite policy, fight motion and persistence stay unchanged.

Acceptance: failing-before 415px versus 405px bare-line scenario at 50ms; loaded transition, geometric pull,
existing cast-rod/line/side-tension/inventory checks and unchanged game-cycle baseline. Owner play/phone
acceptance in both orientations remains pending. No tools replaced or obsolete.

Validation: cast-rod-control, tackle-line-limit, rod-side-tension and inventory hydration/integration pass;
Architecture + Quick + Full (63 checks), with unchanged game-cycle baseline. See G-085 and tasks.md.
