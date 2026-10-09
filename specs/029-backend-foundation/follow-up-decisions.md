# Follow-up Decisions: Releases, Legacy Saves and DEV Isolation

**Date**: 2026-10-09

**Feature**: [Accounts and Cloud Progress Foundation](spec.md)

**Status**: Recorded architecture direction; implementation pending.

This records the English version of the recommendations accepted for documentation by the owner.
It complements [plan.md](plan.md); it does not claim these changes have been implemented.

## 1. Module Caching: Immutable Release Directories

Publish each client release under releases/<version>-<commit>/, including JavaScript, CSS and
resources. The root index.html references that release's entrypoint. Keep the entire resource
graph within the release, or use independently immutable resource URLs, and never overwrite an
already published release directory. Retain previous directories for older tabs and cached HTML.

Cached HTML may therefore load an older release, but its modules remain a consistent set instead
of mixing old and new files. This is a client deployment task and can be completed before the
backend exists. An import map or service worker is not required for this initial solution.

References: [current entrypoint reference](../../index.html),
[URL versioning and cache busting](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching#cache_busting).

## 2. Legacy Saves: Keep Compatibility through Account Adoption

Retain legacy save support throughout development and the transition to accounts. The client
converts old saves to the current format before upload; the API accepts cloud formatVersion 1
with inventory schemaVersion 4. Preserve the original local data for recovery.

Remove automatic legacy migration from normal startup only after import has been verified,
the end of support for old formats has been announced, and a separate converter is available.
There is no fixed removal date yet; introducing the backend alone is not the removal criterion.

An important existing dependency must be separated first: the legacy path also creates a new
player's starting inventory. Removing InventoryLegacyMigration, LegacyItemStateMigration or
LegacyInventorySaveSource without checking their consumers would break more than old-save import.
Provide a direct current-format initialization path before retiring that legacy startup path.

References: [cloud compatibility contract](contracts/progress-format.md#compatibility),
[legacy source and starting-item seeding](../../src/game/application/inventory/persistence/legacy_inventory_save_source.js),
[current initialization and migration composition](../../src/bootstrap/production/inventory_composition_root.js).

## 3. GodMode: Preserve D4's API and Isolate Implementations

The flag provider is already injected. Keep the existing calling API while defining a small
contract without dependencies on DEV implementations. Production composition supplies an inactive
implementation that always disables gameplay overrides regardless of configuration; development
composition supplies the active implementation.

Isolate GameDebugFacade through a diagnostics port with an inactive production implementation.
Separate lifecycle events required by ordinary gameplay from DEV-only hooks before disabling or
moving them. Bootstrap remains the only place that composes concrete implementations.

References: [current injected provider](../../src/dev/runtime/dev_flags_provider.js),
[production composition](../../src/bootstrap/production/game_startup.js),
[current debug facade](../../src/dev/runtime/game_debug_facade.js).

Disabling GodMode is not anti-cheat protection. In this first backend stage, gameplay stays on
the client and uploaded progress is not certified as legitimately earned. This boundary is
already required by [FR-009](spec.md#functional-requirements).

## Follow-up Work

- [ ] Implement and verify immutable client release deployment.
- [ ] Separate current-format starting inventory creation from legacy conversion.
- [ ] Verify legacy-to-current-to-cloud import and recovery before defining the support cutoff.
- [ ] Supply inactive production override/diagnostics implementations through bootstrap.
- [ ] Verify unchanged gameplay, DEV behavior and lifecycle handling with focused checks,
  Architecture + Quick + Full and relevant browser smoke checks.

Keep these as bounded implementation changes. Do not combine them with gameplay redesign or weaken
architecture guards, compatibility checks or baselines to make validation pass.
