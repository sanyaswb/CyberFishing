# Specs

Each folder records one decision: the verified problem, the change and its evidence. A completed spec describes the
code **as it was when the spec was done** and is not updated afterwards; current structure lives in
[docs/architecture.md](../docs/architecture.md) and open work in
[docs/refactoring_remaining.md](../docs/refactoring_remaining.md). Specs 029 and later are numbered after the owner's
spec-kit work (029); Claude's specs start at 030.

## Active

| Spec | Decision | Status | Release |
| --- | --- | --- | --- |
| [020](020-production-console-noise/spec.md) | Production console carries no developer logs | Done | v0.31.0 |
| [021](021-shared-number-normalization/spec.md) | 81 private numeric helpers → shared `engine/math` functions | Done | v0.31.0 |
| [022](022-reuse-duplicates/spec.md) | Reuse instead of copied blocks (GodMode, equipment, gradients, …) | Done | v0.31.0 |
| [023](023-fight-frame/spec.md) | Production fight frame instead of the DEV diagnostics snapshot | Done | v0.31.0 |
| [024](024-fish-physics-normalization/spec.md) | Fish runtime physics normalized once per fish | Done | v0.31.0 |
| [025](025-fixed-catch-dev-only/spec.md) | Fixed Catch exists only in DEV | Done | v0.31.0 |
| [026](026-config-composed-once/spec.md) | Configuration collaborators composed once in bootstrap | Done | v0.31.0 |
| [027](027-physics-config-cache/spec.md) | Normalized physics settings cached per config revision | Done | v0.31.0 |
| [028](028-session-out-of-bootstrap/spec.md) | Game session moved from bootstrap to the application layer | Done | v0.31.0 |
| [029](029-backend-foundation/spec.md) | Accounts and cloud progress: [plan](029-backend-foundation/plan.md), [follow-up decisions](029-backend-foundation/follow-up-decisions.md) | Plan only (owner) | — |
| [030](030-storage-cache-instance/spec.md) | `LocalStorageCache` is an instance over injected storage | Done | v0.32.0 |
| [031](031-composition-root-split/spec.md) | `GameCompositionRoot` split into named composition steps | Done | v0.32.0 |
| [032](032-direct-calls/spec.md) | Direct calls on always-present collaborators (orchestrator, session) | Done | v0.32.0 |
| [033](033-platform-singletons/spec.md) | Page loop guard, per-instance id counter, injected logger | Done | v0.32.0 |
| [034](034-inactive-dev-flags/spec.md) | Production composes inactive DEV flags; GodMode off in production | Done | v0.32.0 |
| [035](035-inactive-diagnostics/spec.md) | Session diagnostics and debug events behind injected ports | Done | v0.32.0 |
| [036](036-listener-counter/spec.md) | Listener counts through an injected DEV counter | Done | v0.32.0 |
| [037](037-starting-inventory/spec.md) | New player's inventory without the legacy conversion | Done | v0.32.0 |
| [038](038-pages-release/spec.md) | Immutable GitHub Pages release directories (`npm run release:pages`) | Done | v0.32.0 |
| [039](039-version-copy-path/spec.md) | Version-copy folder from `CYBER_FISHING_VERSIONS_DIR` | Done | v0.32.0 |
| [040](040-shared-clamp/spec.md) | Private clamp copies use the shared functions | Done | v0.32.0 |
| [041](041-direct-calls-inventory/spec.md) | Direct calls on inventory collaborators | Done | v0.32.0 |
| [042](042-src-module-type/spec.md) | `src/package.json` declares the module type | Done | v0.32.0 |
| [043](043-fight-diagnostics-builder/spec.md) | DEV fight snapshot builder out of the orchestrator | Done | v0.32.0 |
| [044](044-fight-stages-pressure-landing-stamina/spec.md) | Pressure, landing/tension and stamina fight stages | Done | v0.32.0 |
| [045](045-fight-stages-motion-line/spec.md) | Fish motion, rod movement and line fight stages | Done | v0.32.0 |
| [046](046-fight-direct-calls/spec.md) | Direct calls in fight systems; typeof guards on composed receivers | Done | v0.32.0 |

## Archived

Specs 001–019 (Stage 7 inventory decomposition, the v0.30.x cleanup, the CSS restructure and post-closure dead code)
are completed and were removed from `develop`. They stay readable at the
[`specs-archive-001-019`](https://github.com/sanyaswb/CyberFishing/tree/specs-archive-001-019/specs) tag.

| Spec | Decision | Release |
| --- | --- | --- |
| 001 | Inventory decomposition (Stage 7 final step) | v0.29.0 |
| 002 | Line capacity follows the current equipment | v0.30.0 |
| 003 | Names follow responsibilities; files follow classes | v0.30.0 |
| 004 | Dead CSS removed, inventory styles in one place | v0.30.0 |
| 005 | Player-facing texts live in presentation | v0.30.0 |
| 006 | Unreachable item progression UI removed | v0.30.1 |
| 007 | Write-only progression styling removed | v0.30.1 |
| 008 | Test-only capacity policy moved out of Domain | v0.30.1 |
| 009 | Historical editing notes retired from production comments | v0.30.1 |
| 010 | Optional rating tiers kept; card metadata visibility respected | v0.30.1 |
| 011 | Unused bite/chum readiness APIs retired | v0.30.1 |
| 013 | World perspective separated from camera projection | v0.30.1 |
| 014 | Project tree generated only from Git-tracked files | v0.30.1 |
| 015 | Release 0.30.1 cleanup closure | v0.30.1 |
| 016 | Owner's image converter moved into `utils` | v0.31.0 |
| 017 | Force and tackle snapshots named diagnostics | v0.30.1 |
| 018 | Presentation CSS restructure (ownership, load order, visual parity) | v0.31.0 |
| 019 | Post-closure dead code removed | v0.31.0 |
