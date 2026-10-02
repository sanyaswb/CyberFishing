# Stage 5: Presentation and Bootstrap execution plan v1

This is the first Stage 5 deliverable required by `stage_4/stage5_handoff.md`.
The authoritative scope and cluster membership are in `graph_review_v1.json`.
It records source-byte hashes, actual classic consumers, constructor sites, resolved
dependency endpoints, syntactic writes, frame methods, save calls and exact bridge
holders. No production source, Manifest classification, guard policy, global baseline,
runtime contract or historical Stage 4 record changes in this checkpoint.

## Verified starting point

- `develop` and remote `origin/develop`: `52bddd12306a2546b299e3dee44b59bed2d7eff9`.
- Clean working tree before this review; annotated `stage4-closed`, release `0.25.2`.
- 91 authored classic Presentation/production-Bootstrap sources, plus the production
  slices of `src/app/bootstrap.js`, `src/app/game.js` and `src/app/script.js`: 94 sources.
- 28 frozen migration clusters, 128 in-scope symbol/phase dependency edges, no source SCC.
- 178 existing bridges have consumers in these 94 sources; 53 of 67 known debts have
  sources in this scope. These are current facts, not promised retirement counts.
- 177 active / 124 retired activations, 7 inert modules, 206 bridges, 852 global-provider
  baseline entries and 301 classic `src` tags remain unchanged.

The scope excludes migrated Engine, Domain, Application and Platform implementations
and their transport shims. Stage 4's 36 applied clusters are closed historical evidence.
DEV modules and their classic development composition remain Stage 6 work.

## Boundary and ownership decisions

Presentation owns render intent/frame storage, projection into render models, display
descriptors, style/layout caches, animation/line/rod visual state, UI read models and
UI content coordination. Domain repositories, equipment state, loadout entities,
inventory command services, world entities and the state machine remain gameplay
owners. A list of syntactic assignment roots in the graph is an audit aid, not a
claim that every constructor assignment is an independently mutable gameplay fact.

Canvas scene/HUD/screen renderers already receive surface, primitives and asset
instances. Keep their class bodies, drawing order and scratch objects intact and
import only the Engine/Presentation mechanisms they actually use. Do not move them
to Platform merely because their destination is a canvas. Generic existing Engine
render components/passes stay in Engine. No Engine extraction is required here.

Inventory renderers receive the existing DOM factory and input/render collaborators.
Move concrete default construction to Bootstrap before ESM migration. Tooltip viewport,
hover and warning scheduling need browser capabilities supplied from composition.
Do not import Platform implementations into Presentation to preserve defaults.
If a browser implementation genuinely cannot be isolated through the existing narrow
ports, review its destination in graph v2 before editing; do not add a policy exception.

`src/ui/ui.js` is a real mix: interface activation, draggable DOM controls, game
controls, depth/time/chum/hold widgets and legacy inventory UI. Its proposed per-class
browser destinations are listed in the graph. Keep declarations intact; isolate
game-dependent policy/composition through injection. Preserve `UI_EXCEPTIONS`, startup
listeners, fullscreen behavior, timers and the retained legacy InventoryUI API.
UIDraggableButton has two DEV construction consumers: DevTools and overlay DOM.
Its transport cannot retire with only its production consumers migrated.

Bootstrap composes the concrete config context, Platform capabilities, Presentation
objects, inventory roots, game services and application facade. `GameApplication`
and its existing three facades stay under preparation 015's reviewed Bootstrap
responsibility; this migration does not split their hot-loop bodies or redesign state.
The production slice of GameCompositionRoot receives DEV hooks from external development
composition. Production never imports DevTools, debug renderers, GodMode or overlay.

Production entry is `src/entrypoints/game.entry.js` and imports only production
Bootstrap. Browser pagehide registration and existing `window.game`/cleanup/report
aliases belong to browser/development composition. Preserve their existing objects
and async startup/cleanup order; do not introduce another global entry API.

## Frozen order and evidence

The graph contains exact source membership and prerequisites for each cluster.
Numbers identify clusters; execution follows `executionOrder` after each preparation
has passed. Preparations and ESM representation changes are separate commits.

| Clusters | Responsibility | Tier |
| --- | --- | --- |
| 001–002 | Existing visual/inventory catalogs and rule messages | C |
| 003 | Item/fish descriptors and presentation validation | B |
| 004 | Live visual/style/layout/animation/rod-offset resolvers | A |
| 005–007 | Inventory parameter/read-model resolvers and UI contracts | B |
| 008–011 | Inventory item/panel renderers and tooltip | B |
| 012–013 | Inventory UI refresh/lifecycle and legacy UI separation | A |
| 014 | Config context and catalog/physics composition | B |
| 015–016 | Version catalog and coordinated badge mounting | C / B |
| 017 | Reusable render frame/list/intent storage and order | A |
| 018–021 | Canvas leaves, scene/pass delegation, builders and coordinator | A |
| 022–023 | Chum interaction and inventory/save composition | A |
| 024 | Inventory UI concrete composition | B |
| 025–026 | GameApplication and production GameCompositionRoot | A |
| 027–028 | Awaited game facade and native entry cutover | B |

Tier A requires static body/allocation comparison and identical exercised traces;
save-related composition also requires old/current/previous-schema save round trips.
Tier B requires public API parity; tier C requires guards plus identical game-cycle.
Promoting a group to tier A is conservative: it does not allow unexercised classes to
pass. Before capture, extend existing game-area scenarios for every relevant class.
The current game-cycle check covers gameplay but does not exercise the whole rendering
pipeline, so its digest alone cannot certify clusters 004 and 017–021. Reuse the existing
member-review/class-trace machinery and existing area checks rather than per-cluster tests.

All steps require focused checks, Quick and Architecture; stable checkpoints require
uncached acceptance of all 64 live checks, no isolation/source-drift violations, and
browser smoke with actual performer attribution. Close game tabs/DevTools and stop
the server before Windows rebuilds. Never edit project files while acceptance runs.

## Preparations before migration

The graph names ten bounded preparation groups. Their records must pin actual edited
bytes, all affected constructors/property readers, exact debts removed and behavior
parity before migration. They do not authorize arbitrary source changes.

1. Adapt the existing small cluster/ledger mechanism for Stage 5. Stage 4 defaults,
   releases and closure validators remain historical; cumulative runtime/guard/package
   projections also consume applied Stage 5 records. Keep exact canonical bridge and
   activation identities. Extend the existing data-driven records gate with negative
   fixtures; no second framework, catalog or per-cluster check.
2. Inventory capabilities: audit every implicit `new` and `globalThis.X` lookup,
   including DEV override/property reads, before replacing it with an import or injected
   instance. Compose DOM factory, long press, scroll, tooltip, renderer and parameter
   instances once. Preserve existing action-catalog identity and options compatibility.
3. Render diagnostics: inject the existing diagnostics method ports into frame/list,
   pipeline and victory-layout construction. Keep optional debug frame builders/renderers
   externally supplied and trace both enabled and disabled behavior. Do not split classes
   in a hot loop or move their allocation sites.
4. Outcome asset id: inject the existing `ImageAssetProvider.assetIdForSource` function
   used at outcome builder line 140. It cannot become a Presentation → Platform import.
5. Legacy UI capabilities: separate the actual declarations/activation responsibility
   and inject game policies and narrow DEV lifecycle hooks into browser widgets.
6. Config exposures: preserve assignment/adapter/context creation order and the
   conditional differently named `CYBER_FISHING_CONFIG_RUNTIME` alias. Prepare explicit
   composition/activation instead of broadening the declaration-only ESM projector.
7. Version source: coordinate exports, differently named alias, badge timing, release
   projector, package checks and version-copy tooling. Current-version projection follows
   the new source; historical releases 001–003 retain exact historical hashes. This is
   separate from a milestone version bump. Keep package.json untouched in preparation.
8. Application diagnostics and production DEV hook boundary: inject logger, flag/tool/
   debug-render capabilities while preserving composition order and cleanup ownership.
9. Entry lifecycle: preserve prior cleanup, awaited start, watchdog start, pagehide
   registration and storage-usage output through the reviewed composition.
10. Raw catalog inputs: the current policy allows Bootstrap to import game-config but
    excludes game-config-raw. Assemble original ITEM_DB/assembly-profile references
    through a narrow configuration factory for the two composition consumers; inject
    those inputs without another mutable catalog or a widened guard allowance.

The tooling adaptation must have a written reason before implementation and negative
fixtures for stage-qualified identities, cumulative retirements and immutable Stage 4
closure/release pins. The graph records that reason and planned reuse. Add a field to an
execution transition only if existing fields cannot represent an actual required fact;
follow the owner's decision rule rather than treating graph metadata as a new lifecycle.

## Retirement and live identities

Each of 206 existing bridges and each of 177 activations has an exact identity and
holder list in the graph. Retire only when every registered classic consumer migrates,
including DEV. Re-evaluate holder lists after provider relocation in each preparation.
Keep the preparation 019 CONFIG/SLOT_CONFIG union on `bridge-a7c58008c63c` intact.
Transport still needed by DEV survives to Stage 6; reviewed script-position removal
waits for native cutover rather than being inferred from raw tag counts.

One current Stage 5-labelled bridge lies outside the production scope: the Vector2
consumer `src/app/rendering/location_debug_render_frame_builder.js`. Record its exact
metadata reassignment to Stage 6 in a separate retirement transition; do not migrate
DEV code just to eliminate the Stage 5 label. This review changes no registry metadata.

RuntimeConfig is composed once as a live facade over CONFIG. Include nonenumerable
fightPhysicsConfig and preserve per-call reads and shared identity in ConfigProvider
and InventoryRuntimeConfigProvider. CONFIG context/base/store/catalog/adapter identities
and exposure order are acceptance facts. BASE_CONFIG plus override-store sourcing
remains Stage 6. Bootstrap creates InventoryManager callbacks once and preserves its
injected slot config, view factory, inventory composition, actions, UUID and clock.

## Separate follow-ups and checkpoint limits

EquipmentLoadout clock injection is a separate Stage 5 transition after composition is
explicit. Verified paths include the entity's `createdAt || new Date().toISOString()`,
repository add/restore, command-service reconstruction, legacy migration repository and
inventory composition. Check every factory/test/transaction path before removing a
default; preserve saved createdAt/updatedAt, truthiness and fallback call timing.

The saved visual-fields task needs a factual writer/read audit before a schema decision.
InventoryItemFactory already strips derived visual fields, and the V2 snapshot mapper
already writes an allowlist. The historical deferred task is not evidence that every
current save writer still persists these fields. Inspect legacy storage/CacheManager,
V2 snapshot/state stores and old/current/previous-schema migrations. Design any necessary
backward-compatible save migration separately; no saved-field removal in ESM clusters.

No release/version bump, Stage 5 closure or Stage 6 handoff is claimed at this first
checkpoint. Standard guard replacement is evaluated after the native game entry boots,
and must prove equivalent or stricter enforcement before removing current guards.
Portability/renormalization, public API cleanup, ViewportProjector's camera split,
LocationMap per-frame diagnostic allocation and unused code remain Stage 7 work.

Owner manual play remains pending for Stage 3 batches 046–051 and the Stage 4 lists.
Automated game-cycle and built-in browser smoke use the existing owner authorization;
record Codex as performer, never the owner. The checkpoint's actual verification is
recorded in `graph_review_v1.json`; future graph versions preserve this basis.
