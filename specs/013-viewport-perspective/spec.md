# Feature Specification: Separate world perspective from camera projection

**Branch**: `develop` · **Created**: 2026-10-08 · **Kind**: structural, same behavior

## Consumers, ownership and target
Only bootstrap and game-cycle construct `ViewportProjector`. Its camera coordinates, scale, offsets,
pan/follow and screen/virtual conversion stay together in application/viewport. The perspective formula
reads only injected location config and a virtual Y coordinate; move its exact body to
`game/domain/locations/world_perspective.js` (`WorldPerspective`). Both owners read the same live config.

Bootstrap binds the perspective query once and injects it into the projector's existing `getPerspective`
surface. The projector stores that exact function: no per-frame wrapper, new lookup, allocation or
extra source-level call. All existing consumers retain their API. Production does not import test tooling.

## Acceptance
Compare old/new camera and perspective outputs and Math call traces across 1,200 frames with varying
deltaTime, resize, pan, focus, output-vector reuse and live nested config replacements. Perspective method
body must match byte-for-byte; allocation sites stay the same. Add a focused permanent contract check for
perspective boundaries, camera independence, live config and function/output identity. Architecture,
Quick, Full, unchanged game-cycle digest and Chrome smoke on both entries.

Implemented: 1,200 differential frames match camera/perspective outputs and Math call traces exactly;
the method body is byte-identical and the injected function/output-vector identities are preserved.
Architecture 2/2, Quick 13/13, Full 38/38 (new viewport contract), unchanged digest. Chrome world renders
and both entries have 0 console errors. Production graph 463/654; DEV 569/839.
