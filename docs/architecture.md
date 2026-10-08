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

Styles live in `src/game/presentation/styles/`; DEV metric/parameter descriptions in `src/dev/metadata/`.

## Inventory

`bootstrap/production/player_inventory_composition.js` composes the player's inventory once per page:

- `LegacyInventorySaveSource` reads the classic save keys (`player_inventory`, `player_equipment`), migrates and
  seeds them; the inventory uses the result only when its own save (`fishing_game_player_inventory_v2`, schema 4)
  does not exist yet.
- `InventoryCompositionRoot` builds the repository, assemblies, equipment state, loadouts, transactions and:
  `InventoryCommandService` (player actions from the UI), `InventoryUiState` (navigation state),
  `InventoryGameplayCommands` (consumption, line breaks, auto-refill), `InventoryItemRemovalService`,
  `InventoryGameplayBridge` (read models and readiness for gameplay) and `InventoryFacade` (view model + dispatch).
- `PlayerInventory` is what the game uses: lock while tackle is in the water, cached equipment with the rod's cast
  display stats (`RodCastDisplayStatsWriter`, labels from presentation), tackle load limit (`TackleLoadLimitPolicy`),
  change events, consumption and gameplay events.

## Guard

`utils/architecture-check.js` (Quick and Architecture suites) parses every `src/**/*.js` module and fails on:

- an import not allowed by the table above, a non-relative or extensionless specifier, an unresolved
  import or a non-literal dynamic import;
- an import cycle;
- a production module (reachable from `game.entry.js`) in `dev` or `bootstrap/development`;
- a host global outside `platform`/`dev`;
- a page that does not load exactly its one module entry;
- a module exporting more than one class, a module not named after its class (`snake_case(Class).js`), or a
  class named `*Manager`, `*Util(s)` or `*Helper(s)`;
- a Cyrillic string or template literal in `engine`, `game/domain`, `game/application`, `platform` or `bootstrap`,
  except arguments of `console.*`/logger calls (diagnostics) and the save-format names in
  `game/domain/loadouts/persisted_loadout_names.js`. Player-facing text lives in presentation catalogs
  (`INVENTORY_MESSAGES`, `FISHING_MESSAGES`, `HUD_LABELS`, …) injected through constructors by bootstrap.

It reports the production and DEV graph sizes and runs its own negative fixtures first.

## Presentation styles

Native HTML pages are the CSS composition roots. `index.html` loads 22 production stylesheets;
`dev.html` reuses the exact ordered prefix and appends three DEV stylesheets. Shared DOM tokens,
inventory theme, reusable BEM blocks and component rules have distinct owners. Responsive and
reduced-motion rules live beside the affected component. Static HUD and DEV appearance is CSS;
browser adapters supply dynamic values and presentation state classes. Domain/Application do not
know CSS, and Canvas configuration retains its existing injected owners.

[Presentation styles](styles.md) documents ownership, BEM conventions, validation and the decision
to keep native CSS until SCSS compilation is justified. The read-only page stylesheet reader checks
the actual HTML composition. The usage guard also enforces BEM, visible focus/font rules and absence
of static style injection, without weakening architecture or behavior checks.

## Checks

```text
npm run check                 all checks (syntax, architecture guard, behavior tests)
npm run check:quick           fast subset
npm run check:gameplay        fishing and game-cycle systems
npm run check:inventory       inventory systems (also :items, :tools)
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
