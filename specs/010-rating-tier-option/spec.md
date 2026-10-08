# Feature Specification: Keep optional rating tiers; respect card metadata visibility

**Branch**: `develop` · **Created**: 2026-10-08 · **Kind**: delegated capability decision and UI fix

## Decision (handoff steps 2–3)
Keep `ratingTier` for balance experiments: the resolver, config validation, sort criterion and parameter row
form one already-tested capability. It remains absent from production config. Removing it would discard
the existing override use case without simplifying any live gameplay rule.

## Requirements
The card renderer must pass `renderRatingTierBadge: showMetadata` to the adapter. With an enabled tier,
normal cards show one badge and metadata-free cards show none. No other config, gameplay or save change.

## Acceptance
Inventory UI checks cover both states; item progression/config checks preserve the optional capability.
Architecture, Quick, Full and the handoff game-cycle SHA256 pass; Chrome inventory smoke on both entries.

Implemented: real adapter + card renderer tested with visible/hidden metadata; Architecture 2/2, Quick 12/12,
Full 37/37, unchanged digest; Chrome inventories 20 cards each, 0/0 console errors.
