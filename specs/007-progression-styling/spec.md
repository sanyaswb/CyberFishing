# Feature Specification: Remove write-only progression styling

**Branch**: `develop` · **Created**: 2026-10-08 · **Kind**: dead-code removal, same visible behavior

## Verified consumers
The six progression CSS properties (`--item-rating-percent/color`, `--item-capacity-percent/color`,
`--item-quality-color/sections`) and `has-item-progression` occur only in the adapter's writes/removals.
Neither production nor DEV styles/scripts read them. `--item-condition-percent` belongs to the separate
condition adapter and is outside this change. The only reader of the progression capacity color is this
write-only path; line capacity itself remains in the domain descriptor and inventory resource meter.

## Requirements
- Remove progression property/class writes and removals and the unused capacity visual calculation.
- Remove its now-unused degradation color dependency from this resolver's composition and tests.
- Keep rating/quality colors, rating-tier support, resource meter, formulas and save schema unchanged.
- Adjust assertions that pin the retired capacity visual; keep degradation resolver coverage and meter coverage.

## Acceptance
Focused item/UI/color checks, Architecture, Quick, Full, unchanged game-cycle SHA256 and both browser entries.

Implemented: Architecture 2/2, Quick 12/12, Full 37/37; game-cycle SHA256 equals the handoff value.
Chrome smoke: both inventories open and cards/resource meters render; console errors 0/0.
