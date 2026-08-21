# CyberFishing Root Package Contract

Stages 1.8.1–1.8.2 make the repository package definition reproducible and add isolated ESM/Vite infrastructure without changing the classic browser runtime.

## Sources of truth

- `package.json` defines the private package identity, compatible Node/npm ranges, direct dependency ranges, scripts, and the exact package manager.
- `package-lock.json` defines the exact dependency graph and integrity hashes used by `npm ci`.
- `architecture/build/package_contract.json` defines the executable architecture contract for package and lockfile validation.
- `src/config/project_version.js` remains the authoritative project-version source; `package.json` and the lockfile must match it.

## Runtime boundary

- Root `package.json` intentionally has no `type` field, so existing CommonJS tooling under `utils/` remains unchanged.
- `index.html` remains the production source entrypoint.
- Exact Vite `8.2.1` is a development-only dependency used exclusively by the synthetic fixture build.
- Production/game/development ESM entrypoints are not introduced by Stage 1.8.
- `src/`, asset loading, and the classic-script bootstrap are not changed.

## Verification

```text
npm run architecture:package-contract
npm run architecture:verify-install
npm run architecture:esm-fixture
npm run architecture:vite-fixture
```

The first command validates package/lockfile synchronization read-only. The second creates an isolated temporary workspace, runs `npm ci`, verifies that the lockfile is byte-stable, runs Architecture, Quick, and Full suites using the fresh dependency installation, and then removes the validated temporary workspace. The final two commands independently verify native ESM semantics and the synthetic Vite build boundary.
