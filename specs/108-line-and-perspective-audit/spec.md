# Line reach and water metric audit

Owner, 2026-10-18: tackle must never drift beyond the available line; audit casts, retrieval, fish motion, metres,
pixels and perspective. A fixed float at depth 1 m on 9 m of line has 8 m of horizontal reach. G-069.

## Boundaries and findings

- `WaterMetric` owns map <-> ground conversions and distance. `GroundPlaneScope` runs tackle movement on that plane;
  `BaitBoatGroundPlaneScope` does the same for boats (G-007, v0.41.4). No alternative perspective physics is added.
- `FloatTackleLineBudgetPolicy` owns fixed/sliding-float depth cost. `CastDistanceCalculator` supplies the same limit
  to casting, the depth preview and `FightSessionFactory`; fight `LineSystem` owns released/reserve line.
- Waiting/biting ran current, wind, bite motion and live-bait motion without a final line reach constraint. Clamp
  their final ground-plane position against the same depth-adjusted budget, removing only outward radial velocity.
  Preserve inward and tangential velocity, retrieve/tilt rules, bite timing, saves and the complete fight pipeline.
- `CastRodControl` preserves released slack for lateral rod motion; it must not promote an overlong distance caused
  by current into extra equipped line. The final constraint also covers rod motion and changing depth/line stats.
- Physical units and visual perspective are audited separately: gameplay uses metres on WaterMetric; editor grid,
  world sizes and regions must expose this same mapping. The rod remains in its established screen/Spine space.

## Verification

Focused regression first runs before the fix: real `FloatEntity`, `WaitingState` and `BitingState`, uniform and
profiled water, off-centre rods, 9 m fixed line / 1 m selected depth, sliding float, feeder/spinning, live input
disabled and enabled. At the limit current cannot lengthen the line; retrieval remains possible. Cover pure radial
velocity projection and allocation-free in-place updates. Run focused + Architecture + Quick + Full.

Owner checks `index.html`/`dev.html`, portrait and landscape: let current carry a fixed float to the line limit,
move the rod, retrieve and strike. Visual verification is the owner's. No tools become obsolete.

Implemented in v0.41.5. The regression first failed at `WaitingState fixed profiled=false: drift cannot exceed 8 m`.
Full 61 checks passes, including the unchanged game-cycle baseline. Waiting/biting now receive the selected depth
reference already owned by the session. Existing point transforms and render endpoints remain authoritative.
