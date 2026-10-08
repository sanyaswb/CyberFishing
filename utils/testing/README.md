# Test checks

```text
utils/
  run-checks.js                 runner: --list | --check ID | --suite NAME, --jobs N (default 4)
  *-check.js                    one scenario file per domain contract
  architecture-check.js         layer/import/global guard (see docs/architecture.md)
  testing/
    doubles/                    test-only implementations of production contracts
    core/                       CheckAssertion and SourceRuntime (Node VM over native ESM sources)
    runtime/                    native ESM test loader and test compositions
    suites/check_manifest.js    single registry of checks and suite membership
```

Every check runs in its own Node process; output is printed in catalog order. The runner refuses a
`utils/*-check.js` file that is missing from the manifest.

## Adding a check

Keep the scenario in a domain-named `utils/*-check.js` file and add one descriptor to
`check_manifest.js`; suite membership belongs only there. Reuse `CheckAssertion`, `SourceRuntime` and
the compositions in `runtime/`. Inject test doubles through constructors (`constructor_defaults.js`)
instead of globals. A check must not write project files.

Do not duplicate a scenario across files; a focused unit check and a broader integration check may
both stay when they protect different contracts.
