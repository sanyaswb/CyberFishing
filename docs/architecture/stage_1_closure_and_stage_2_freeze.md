# Stage 1 Closure and Stage 2 Batch Freeze

Stage 1 closes at `v0.24.31`. It creates an executable architecture baseline without converting the CyberFishing runtime to ESM. The browser still starts from `index.html`, loads 424 classic scripts and executes the same gameplay code.

## Artifact structure

```text
architecture/
├── stage_1_closure.json
├── guards/
│   ├── global_provider_baseline.json
│   ├── known_debt_registry.json
│   └── migration_bridge_registry.json
└── migration/
    ├── module_migration_manifest.json
    ├── stage_1_6_initial_batches.json
    └── stage_2_approved_batches.json

utils/architecture/
├── stage-1-closure-check.js
├── approved-stage-2-batch-freeze-check.js
└── classification/
    └── approved_stage_two_batch_validator.js
```

- `stage_1_closure.json` freezes the evidence and acceptance anchors used to close Stage 1.
- `stage_2_approved_batches.json` is the authoritative execution order for the beginning of Stage 2.
- `ApprovedStageTwoBatchValidator` proves that the approved module set, target paths, providers and legacy consumers still match the Stage 1.6 candidates and the live manifest.
- The two checks are deterministic and read-only. They never update source, policy, registries or the migration manifest.

## Why a build prerequisite is required

The candidate modules are dependency-free leaves, but their consumers do not all use the globals at the same execution phase. Most references are deferred. Five render-pipeline classes consume `RenderPass` eagerly in `extends RenderPass` declarations.

A native `<script type="module">` executes after classic parsing and cannot guarantee that `RenderPass` exists before those class declarations. Stage 2 therefore starts with `stage-2.0-classic-bridge-build-foundation`:

```text
approved ESM target
        ↓ named import
small ESM bridge wrapper
        ↓ Vite library build
synchronous classic IIFE
        ↓ same legacyLoadOrder position
exact globalThis provider
```

The authored wrapper may only import a target and expose exact registered globals. It cannot contain business logic. The generated IIFE is ignored under `dist/legacy-bridges/`; Vite still does not own `index.html`.

Each migrated source receives its own wrapper and output. Replacing the original script one-for-one preserves the provider's `program-init` availability and makes rollback local to one module batch.

## Frozen Stage 2 order

| Order | Batch | Modules | Bridge removal |
|---:|---|---:|---|
| 0 | `stage-2.0-classic-bridge-build-foundation` | tooling prerequisite | after the last registered bridge |
| 1 | `stage-2.1-engine-asset-contracts` | 2 | Stage 4 |
| 2 | `stage-2.2-engine-dependency-contract` | 1 | Stage 5 |
| 3 | `stage-2.3-engine-event-primitives` | 2 | Stage 5 |
| 4 | `stage-2.4-engine-rendering-primitives` | 4 | Stage 5 |

The batches are intentionally serial. A later batch starts only after the previous batch has passed its focused tests, architecture guards, Quick, full regression suite and browser smoke test.

## Batch invariants

Every approved batch freezes:

- exact current and target paths;
- exact provider symbols and legacy consumers;
- module and batch dependency order;
- one synchronous compatibility wrapper per migrated module;
- exact global mechanism and `program-init` availability;
- bridge owner and removal stage;
- focused tests and architecture gates;
- an atomic rollback boundary;
- acceptance criteria that forbid opportunistic gameplay or API refactoring.

The bridge registry remains empty in Stage 1. Exact bridge records are added only in the same Stage 2 commit that creates the target module, wrapper and manifest transition.

## Closure quality checklist

- All current modules are represented and classified in the manifest.
- Only confirmed observations form the 771-edge source graph.
- The 855-global exact baseline cannot grow silently.
- The 203 existing violations are exact reviewed debt, not broad exceptions.
- New boundary, cycle, browser, dev-leakage, global or ESM violations fail.
- Vite can build isolated ESM but does not process the game runtime or assets in Stage 1.
- Stage 2 begins from a reviewed batch specification rather than a new architecture-design pass.
