# Feature Specification: Production console carries no developer noise

**Created**: 2026-10-08 · **Status**: Implemented · **Kind**: diagnostics placement, gameplay unchanged

## Problem (verified)
- `ChumControls` writes `console.log("--- DEBUG 1: ChumControls клік! …")` on every chum button click in production.
- Production startup prints the localStorage usage report (`LocalStorageCache.printStorageUsage`) on every page load.
  The report is a developer diagnostic; DEV startup already prints it.

## Requirements
- **FR-001** Remove the click debug log from `ChumControls`; click handling is unchanged.
- **FR-002** Production startup no longer prints the storage report; Development startup keeps it.
- **FR-003** Warnings about failed storage reads/writes stay (they report real failures).

## Acceptance
All checks (the production startup check now expects no storage report); guard; game-cycle digest unchanged;
`index.html` console has no log lines after load and a chum click; `dev.html` still prints the report.
