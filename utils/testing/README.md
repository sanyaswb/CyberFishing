# Test checks

The live catalog contains 64 checks at Stage 4 closure: Quick 24, Architecture 32,
gameplay 12, inventory 14, inventory-v2 16, items 12 and tools 1. Membership overlaps.
The test infrastructure is split from domain scenarios:

```text
utils/
  run-checks.js                 command-line entry point
  *-check.js                    domain and integration scenarios
  testing/
    core/                       reusable runner, assertions and source runtime
    suites/check_manifest.js    single registry of checks and suites
```

## Commands

```text
npm run check                  complete live catalog
npm run check:quick            day-to-day invariants: syntax, policy, manifest, guards,
                               package contract, cumulative runtime, Domain boundary,
                               Stage 4 records and closure
npm run check:architecture     quick invariants plus architecture tooling fixtures/corpora
npm run check:inventory        legacy adapter and Inventory V2
npm run check:inventory-v2     Inventory V2 only
npm run check:items            item and rarity systems
npm run check:gameplay         fishing and game-cycle systems
npm run check:tools            developer tools
npm run check:list             list check identifiers
node utils/run-checks.js --check <id>
node utils/run-checks.js --acceptance --report <absolute-path>
```

## Adding a check

Keep the scenario in a domain-named `utils/*-check.js` file. Reuse
`CheckAssertion` and `SourceRuntime` when the check evaluates browser scripts in
a Node VM. Add one descriptor to `check_manifest.js`; suite membership belongs
only in that descriptor.

## Archived history and acceptance

Historical Stage 3 replay/planning checks run at the annotated tags listed in
`architecture/archive/ARCHIVED_CHECKS.md`. The live catalog has no history suite.
The obsolete HistoryBase reconstruction left the runner at Stage 4 M2 closure;
old scope identities still invalidate seals. Retained historical helpers remain
where current fixtures/builders consume them. Never restore archived checks to develop.

Stable acceptance executes every live check with no cached PASS and unchanged
source. Do not edit project files during acceptance. Focused checks, Quick and
Architecture serve intermediate changes. See `CHECKS.md` for cache tracing and
parallel isolation. Static assertions use SourceRuntime.readAuthoredSource to
resolve migrated classic files to canonical ESM. Reuse the data-driven records
gate for migration records and scope closure, not a check per cluster.

Do not add another aggregate runner or duplicate a domain scenario in a suite
file. A focused unit check and a broader integration check may both stay when
they protect different contracts.
