# Feature Specification: Move the test-only capacity policy out of Domain

**Branch**: `develop` · **Created**: 2026-10-08 · **Kind**: test isolation, same behavior

## Verified consumers and boundary
`DelegatingInventoryCapacityPolicy` has no import in `src/` and is unreachable from both entries.
Only inventory equipment, integration and save round-trip checks load it. Move it to
`utils/testing/doubles/`; keep its body and production capacity contract unchanged. The synchronous
test ESM loader may load that explicit test-double directory; production imports remain unaffected.

## Acceptance
The three consumer checks, Architecture, Quick, Full and unchanged handoff game-cycle digest;
production and DEV graphs stay unchanged while the source-module count drops by one.

Implemented: all three consumers pass in Full 37/37; Architecture 2/2, Quick 12/12; unchanged digest.
Source graph 571 modules, production 462/653 and DEV 568/838 unchanged. Prior Chrome smoke still applies:
the moved module is reachable from neither browser entry.
