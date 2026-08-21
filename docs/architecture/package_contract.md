# CyberFishing Root Package Contract

Stages 1.8.1–1.8.2 made the package definition reproducible. Stage 2.0 extends that infrastructure with an exact, approved classic-IIFE bridge build while leaving the CyberFishing runtime unchanged.

## Sources of truth

- `package.json` defines the private package identity, compatible Node/npm ranges, direct dependency ranges, scripts, and the exact package manager.
- `package-lock.json` defines the exact dependency graph and integrity hashes used by `npm ci`.
- `architecture/build/package_contract.json` defines the executable architecture contract for package and lockfile validation.
- `src/config/project_version.js` remains the authoritative project-version source; `package.json` and the lockfile must match it.

## Runtime boundary

- Root `package.json` intentionally has no `type` field, so existing CommonJS tooling under `utils/` remains unchanged.
- `index.html` remains the production source entrypoint.
- Exact Vite `8.2.1` is a development-only dependency used by synthetic fixtures and approved active bridge wrappers only.
- `index.html` is never a Vite input; production/game/development ESM entrypoints are not introduced by Stage 2.0.
- `src/`, asset loading, and the classic-script bootstrap are not changed.
- The empty Stage 2.0 bridge registry produces no artifact and does not import Vite.

## Classic bridge build boundary

- `architecture/migration/stage_2_execution_state.json` is the lifecycle source of truth. Derived values such as the next batch are never persisted.
- `architecture/migration/stage_2_approved_batches.json` defines exact wrappers, targets, consumers, global providers and output paths.
- `architecture/guards/migration_bridge_registry.json` activates one canonical record per approved legacy consumer; it remains empty at the Stage 2.0 closure.
- `npm run build:legacy-bridges` validates the wrapper AST and full recursive ESM graph before producing deterministic, unminified ES2020 IIFEs under ignored `dist/legacy-bridges/`.
- A validated staging directory replaces the previous output only after the complete build passes. A failed build preserves the previous validated output.
- The static development server runs this build first and does not call `listen()` when validation or build fails.

## Verification

```text
npm run architecture:package-contract
npm run architecture:verify-install
npm run architecture:esm-fixture
npm run architecture:vite-fixture
npm run build:legacy-bridges
node utils/architecture/stage-2-legacy-bridge-build-check.js
```

The package checks validate package/lock synchronization and reproducibility. Native and Vite fixtures verify isolated ESM semantics. The final two commands verify the empty-registry production state and the complete bridge contract, including canonical registry identity, recursive closure, reproducible IIFE bytes, atomic output and fail-before-listen behavior.
