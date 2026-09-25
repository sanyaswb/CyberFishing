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
npm run check                  run every registered check (suite "all", includes history)
npm run check:quick            day-to-day invariants: syntax, policy, manifest, guards,
                               package contract, Stage 1 closure, cumulative runtime,
                               latest released batch guard
npm run check:architecture     quick invariants plus architecture tooling fixtures/corpora
npm run check -- --suite history
                               historical replay of released Stage 3 batches
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

## History suite and check policy

Checks of released Stage 3 batches (`stage-3-batch-0NN-*`) replay their accepted
evidence by peeling every later batch in a temporary copy, so they dominate the
run time. They belong to the `history` suite, not to `quick`/`architecture`.
Moving a check between suites never deletes it: `npm run check` (suite `all`)
runs every check, including `history`.

- The architecture check of the latest released batch stays in `quick` and
  `architecture` as well as `history`: it is the first replay to break when the
  next batch changes state or shared tooling. When the next batch is released,
  its check takes over that role and the previous one keeps only `history`.
- The active batch's checks stay in `quick`/`architecture` until its release.
- After each batch sub-stage: focused checks, the batch check and `check:quick`.
- When shared tooling changes (`utils/architecture/domain_batches` shared
  modules, closure validators, test loaders/harness, this manifest): run
  `npm run check -- --suite history` or the full suite immediately.
- Batch acceptance (3.x.8) and release closure (3.x.9): the full suite.

Do not add another aggregate runner or duplicate a domain scenario in a suite
file. A focused unit check and a broader integration check may both stay when
they protect different contracts.
