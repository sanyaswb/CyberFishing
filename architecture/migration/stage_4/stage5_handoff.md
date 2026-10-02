# CyberFishing: Stage 5 execution specification

Continue the architecture migration with **Stage 5 — Presentation + Bootstrap**. Stage 4 is closed at
release **v0.25.2**, annotated tag **stage4-closed**. First verify the current checkout and remote develop;
do not assume an old chat's commit or uncommitted work is still current. Complete authorized work
autonomously, preserving player-visible behavior. Do not reopen completed Stage 4 clusters.

## Read before editing

1. `AGENTS.md` if present, the owner's development rules, and local `CLAUDE.md` / `CODEX.md`.
2. `refactor_Task.txt` current status and Stages 5–7; historical step paragraphs are evidence, not the next queue.
3. `architecture/module_architecture.json`, `architecture/migration/module_migration_manifest.json`,
   the guard registries and `architecture/migration/stage_4_closure.json`.
4. `architecture/migration/stage_4/graph_review_v6.json`, release records 001–003,
   and owner decisions `stage_4_owner_decision_config_source.json` / `stage_4_owner_decision_cluster_path.json`.
5. `utils/testing/CHECKS.md`, `architecture/archive/ARCHIVED_CHECKS.md`, and existing Stage 4 projector,
   retirement, ledger and tier-evidence implementations. Reuse mechanisms rather than another lifecycle framework.

## Accepted starting state

- 95 original Stage 4 scope modules: 92 migrated sources, 3 formally reassigned to Stage 5.
- 36 applied clusters, 96 recorded ESM targets, 19 preparations; cluster 009 is deferred. No pending cluster.
- 139 Domain modules remain clean: Domain/Engine imports only; no browser, DEV or transport globals.
- Runtime: 177 active activations, 124 retired, 7 inert. Bridges: 206, all assigned to Stage 5/6.
  There are no active Stage 4 retirement obligations. Baseline globals: 852; known debts: 67.
- Final classic `src` script tags: 301 (325 at Stage 4 start). Placeholder tags preserve historical load slots;
  their count can temporarily rise when an activation retires. Remove positions only through reviewed cutover.
- Check catalog: 64; Quick 24, Architecture 32. Final acceptance and browser evidence are in the closure record.
- Stage 4 tooling: approximately 1,832 lines, below its approximately 2,000-line budget. M2/closure utils remains
  below the 70,358-line M2 baseline. The unused history workspace reconstruction was removed; no live check removed.
- Annotated tags: v0.25.0, v0.25.1, v0.25.2, stage4-closed; tooling archive: stage4-m2-tools-archive.
  Historical Stage 3 replays stay at their archive tags; never restore them to the live catalog.

## First deliverable: a factual Stage 5 graph and plan

Inspect actual imports, classic consumers, constructor sites, mutable owners, render/update loops,
browser capabilities, DEV hooks and save readers/writers. Produce one versioned Stage 5 scope/graph review
and freeze dependency-safe clusters before migrating. Define narrow responsibilities and destination folders:
`src/game/presentation/`, `src/bootstrap/production/`, `src/platform/browser/`, `src/engine/` as appropriate.
Do not decide boundaries from filenames alone. Classify hot-loop/save work as tier A, stateful API work as B,
and stateless leaves as C. Prepare capability injection separately from ESM representation changes.

Explicit Stage 5 entrants carried from Stage 4:

- `src/config/config.js`: concrete config composition → `src/bootstrap/production/config_composition.js`
  (preparation 001). Preserve CONFIG, context, store, catalog and physics adapter identities and exposure order.
- `src/app/application.js`: GameApplication/facades compose concrete Platform/Presentation implementations
  → `src/bootstrap/production/game_application.js` (preparation 015).
- `src/config/project_version.js`: presentation version catalog →
  `src/game/presentation/version/project_version.js` (preparation 003 / deferred cluster 009).
  Coordinate the badge, release projector, package checks and version-copy tooling in one reviewed transition.
- `src/app/bootstrap.js` / GameCompositionRoot and inventory composition roots remain classic. Review all
  renderer/UI/HUD/screen construction and explicit lifecycle ownership before introducing `game.entry.js`.

The final closure reassigned five bridges and three activations to Stage 5 because their last consumers
are these Bootstrap sources. Exact before/after metadata and reasons are in `retirementUpdates`.
Retire each activation only when **every registered classic consumer** is migrated. Preserve the bridge
union from preparation 019: CONFIG and SLOT_CONFIG share the Bootstrap consumer bridge.

## Contracts to preserve

- ENTRYPOINT → BOOTSTRAP/COMPOSITION → ENGINE / GAME / PLATFORM; DEV may depend on production.
  Domain/Application never depend directly on DOM, Canvas, storage, Audio, browser globals, DEV or raw config globals.
- One authoritative mutable owner; temporary bridges transport existing exports and own no logic/state/config.
- RuntimeConfig is composed once as a **live facade over CONFIG**. Its getters, including fightPhysicsConfig,
  read per call. InventoryRuntimeConfigProvider receives that same live port. BASE_CONFIG + overrides become
  the source only in Stage 6. Never cache the live adapter or make a second writable config owner.
- InventoryManager's injected options cover slot config, view-factory creation, inventory composition, action
  constants, UUID generation and clock. Bootstrap creates callbacks once. InventoryEventBridge receives
  the BrowserEventTargetAdapter emit port; its listener Map and dispatch semantics are unchanged.
- FightPhysics diagnostics use the injected logger. Do not reintroduce console/global reads in Application.
- Preserve formulas, APIs, constructor compatibility, state identity, save shape, timing, deltaTime, allocation
  sites and hot-loop behavior. No rebalancing, broad renaming or gameplay optimization during migration.
- Named exports, explicit `.js` imports, no cycles or mass barrels. Use small contracts and composition;
  avoid catch-all managers and abstractions without a concrete ownership/lifecycle/substitution problem.

## Carry-over work: separate transitions

Stage 5: inject EquipmentLoadout's default clock through all create/restore composition paths while preserving
stored createdAt; plan an explicit save migration before removing ratingColor/ratingGradient/powerColor/powerGradient
from persisted items. These are not silently bundled into ESM migration.

Stage 6: split DEV hooks/templates/overlay/GodMode and compose DevFlagsProvider from dev.entry.js; move live
RuntimeConfig sourcing to BASE_CONFIG plus CONFIG_OVERRIDE_STORE; retire DEV-held bridges/classic positions.

Stage 7: remove optional FlatInventoryItemRepository id fallback only after checking every caller (production
already injects id factory and clock); review unread fish helpers and other dead code; separately review
ViewportProjector's world-perspective/camera split and LocationMap's per-frame diagnostic string allocation.
Do not change these APIs or hot-loop traces opportunistically.

Infrastructure prerequisite before CI/another machine: working-tree evidence hashes mixed CRLF/LF bytes, whereas
Git normalizes blobs. Owner chose this Windows workspace until a separate `.gitattributes`/renormalization/fresh-clone
transition proves the entire evidence chain. Do not run git stash or normalize existing sources. Keep package.json
unchanged except reviewed release-version fields. Its archived architecture:closure script and struct decision are
known deferred package-contract cleanup, not failing live acceptance gates.

## Execution and verification

- Confirm `git status` and preserve user changes. One cohesive preparation or migration per commit; push develop
  under existing authorization. Release/tag only at the reviewed milestone; do not force-push or rewrite evidence.
- Reuse plan/apply/verify, canonical bridge identities, activation retirement and boundary checking. Adapt the
  Stage 5 ledger/closure projection with a written reason before new fields or tools. No per-cluster checks,
  duplicated catalogs or another large framework. Stage 4 release pins must remain valid historical facts when
  Stage 5 introduces its release source; update the current-version projection in a separate reviewed transition.
- Relevant focused tests + Quick + Architecture. Tier A needs static allocation/body review and identical traced
  hot-loop/save scenarios; tier B public-API parity; tier C guards and identical game-cycle.
- Stable checkpoint: `node utils/run-checks.js --acceptance --report <absolute-path>`; all 64 current checks
  executed, 0 cached/failures/isolation violations, source unchanged. Extend meaningful scenarios if required.
  Do not edit project files during this run. Stop dev server and close game/DevTools before rebuilds on Windows.
- Built-in browser smoke: no errors/warnings, correct export/object identities, game start, inventory opening
  and reload/save restoration. The owner authorized game-cycle plus automated browser as a substitute for visual
  acceptance. Record the actual performer, never claim the owner played. The owner's manual list remains pending:
  Stage 3 batches 046–051 and Stage 4 cast/hook/fight/land/line-break/chum, equipment/refill/loadouts,
  rarity/progression, long press, input transitions, pause/resume and reload.
- Once the game boots from `game.entry.js`, evaluate dependency-cruiser or eslint-plugin-boundaries as agreed.
  Replacement guards must enforce equivalent or stricter boundaries before removing current guards.
- Update refactor_Task, current graph/release/closure records and local resume documents at each checkpoint.
  CODEX.md and CLAUDE.md remain local, excluded, never committed/pushed.

## Stage 5 completion

All approved Presentation/Bootstrap modules migrated or explicitly assigned a justified later stage; native
production entrypoint composes concrete implementations; no new globals, forbidden edges or debts; redundant
bridges removed with exact identities and all survivors assigned to Stage 6/7; gameplay/save/hot-loop evidence
unchanged; gates and browser smoke pass; milestone metrics, release metadata, closure tag and current plans agree.
Provide an English Stage 6 handoff with exact remaining work and pending owner play evidence.
