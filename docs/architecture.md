# CyberFishing architecture

Native ES modules, no build step. `index.html` loads `src/entrypoints/game.entry.js`; `dev.html` loads
`src/entrypoints/dev.entry.js`. Each page has exactly one module script.

```text
ENTRYPOINT → BOOTSTRAP (composition) → ENGINE / GAME / PLATFORM
DEV → production layers (never the reverse)
```

## Layers

| Layer | Path | May import | Responsibility |
| --- | --- | --- | --- |
| engine | `src/engine/` | engine | Reusable mechanisms (math, events, rendering primitives, assets, DI); no CyberFishing or browser knowledge. |
| game/config/raw | `src/game/config/raw/` | nothing | Authored data without behavior. |
| game/config | `src/game/config/` | config, raw, domain, engine | Configuration factories and catalogs. |
| game/domain | `src/game/domain/` | domain, engine | Gameplay rules, entities, policies, value objects, save-format constants. |
| game/application | `src/game/application/` | application, domain, config, engine | Use cases and orchestration. |
| game/presentation | `src/game/presentation/` | presentation, application, domain, engine | Rendering, UI, HUD and read models. |
| platform | `src/platform/` | platform, engine | Browser implementations: DOM, Canvas, storage, audio, input, timers. |
| dev | `src/dev/` | dev and every production layer | Overlay, GodMode, Fixed Catch, diagnostics and balance tools. |
| bootstrap/production | `src/bootstrap/production/` | production layers | The only place that composes concrete production implementations. |
| bootstrap/development | `src/bootstrap/development/` | everything above | Extends production composition with DEV tools. |
| entrypoints | `src/entrypoints/` | its own bootstrap | Starts the page. |

Only `platform` and `dev` may reference browser/host globals (`window`, `document`, `localStorage`,
`console`, timers, …); every other layer uses ECMAScript built-ins only and receives host services by
injection. Runtime configuration has one frozen base and one override store, composed in bootstrap.
Production GodMode and Fixed Catch are off; DEV composition switches them on for balance testing.

Styles live in `src/ui/styles/`, DEV parameter descriptions in `src/config/metadata/`.

## Guard

`utils/architecture-check.js` (Quick and Architecture suites) parses every `src/**/*.js` module and fails on:

- an import not allowed by the table above, a non-relative or extensionless specifier, an unresolved
  import or a non-literal dynamic import;
- an import cycle;
- a production module (reachable from `game.entry.js`) in `dev` or `bootstrap/development`;
- a host global outside `platform`/`dev`;
- a page that does not load exactly its one module entry.

It reports the production and DEV graph sizes and runs its own negative fixtures first.

## Checks

```text
npm run check                 all checks (syntax, architecture guard, behavior tests)
npm run check:quick           fast subset
npm run check:gameplay        fishing and game-cycle systems
npm run check:inventory       inventory systems (also :inventory-v2, :items, :tools)
node utils/run-checks.js --check game-cycle
```

`game-cycle` is the end-to-end regression: its output must stay byte-identical for refactors that
preserve behavior.

## Migration history

The classic-script → ESM migration (Stages 1–7.1) and all of its records, evidence, Manifest and
tooling are archived at annotated Git tags; `develop` keeps only the game, its DEV tools and its tests.

- `migration-final-archive` — the complete migration apparatus at v0.27.2 + Stage 7.1 preparations
  (64-check catalog). Reproduce with `git worktree add <dir> migration-final-archive`, `npm ci`, `npm run check`.
- Earlier recovery tags: `stage3-evidence-archive`, `stage6-classic-runtime-archive`,
  `stage7-compat-tools-archive` and the other `*-archive` tags.
