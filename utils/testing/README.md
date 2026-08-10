# Test checks

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
npm run check                  run every registered check
npm run check:quick            syntax and production configuration
npm run check:inventory        legacy adapter and Inventory V2
npm run check:inventory-v2     Inventory V2 only
npm run check:items            item and rarity systems
npm run check:gameplay         fishing and game-cycle systems
npm run check:tools            developer tools
npm run check:list             list check identifiers
node utils/run-checks.js --check <id>
```

## Adding a check

Keep the scenario in a domain-named `utils/*-check.js` file. Reuse
`CheckAssertion` and `SourceRuntime` when the check evaluates browser scripts in
a Node VM. Add one descriptor to `check_manifest.js`; suite membership belongs
only in that descriptor.

Do not add another aggregate runner or duplicate a domain scenario in a suite
file. A focused unit check and a broader integration check may both stay when
they protect different contracts.
