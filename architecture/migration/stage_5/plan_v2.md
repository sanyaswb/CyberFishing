# Current owner decision: native production now; native DEV in Stage 6

Stage 5 delivers full index.html -> game.entry.js -> Production Bootstrap, with
no DEV/compatibility runtime/legacy loader. dev.html retains exact classic/IIFE
startup until Stage 6 delivers dev.entry.js and retires its old transport.
Enabled Fixed Catch/GodMode effects remain injected production dependencies.
Diagnostic overlay/render/watchdog may be explicitly absent and must satisfy their
contracts when supplied. Graph v8 is authoritative for the revised 028 browser scope
and Fixed Catch prerequisite 030; prior graphs and completed evidence remain historical
provenance. All architecture/save/state gates remain unchanged. See
`native_production_owner_decision.md`.

# Stage 5 remaining execution plan v2

Date: 2026-10-04. Committed checkpoint: `ee0457a`, after prerequisite 030.
Cluster 028 is now in preparation; its native browser cutover is not yet complete.
This is the current task queue under the owner's reviewed v8 scope, not a Stage 5 closure.
The authoritative reviewed membership/order is now `graph_review_v8.json`.
Read `stage5_continuation_spec.md` for the English execution specification, verified
checkpoint, acceptance evidence and implementation constraints. `plan_v1.md` is the
historical initial plan; its starting counts and pending preparations are superseded.

## Completed

- [x] Clusters 001–027 and prerequisites 029/030: 29 applied clusters, 102 ESM targets.
- [x] Preparations 001–026, including loadout clock propagation (017), external DEV
  factories, injected Root config, portable inventory imports and browser lifecycle.
- [x] Presentation/render/UI/config-context/version declarations, Inventory composition,
  Inventory UI Bootstrap, GameApplication/facades and production GameCompositionRoot.
- [x] Game readiness/start/stop/dispose scenario added to the existing inventory lifecycle
  check; Quick 24/24, Architecture 32/32 and uncached Full 64/64 passed.
- [x] Saved visual-field audit: all current/previous/legacy item writers and readers,
  normalization, stacking and exact signatures verified; no save-schema transition
  needed. Existing regression scenarios cover all four fields under schemas 2/3/4.
  Quick 24/24, Architecture 32/32 and uncached Full 64/64 passed; see
  `saved_visual_fields_audit.md` and the archived acceptance report.

## Remaining execution, in order

1. **Completed: Game, cluster 027.** One immutable API capture, plan/apply/verify and
   real-class lifecycle scenario passed with identical members/traces and game-cycle.
   Quick 24/24, Architecture 32/32, uncached Full 64/64; browser: 27 export identities,
   nine config facts, one loop, zero warnings/errors, 52 button texts and three save
   strings identical after reload. Prerequisite 030 also completed: intact Fixed Catch
   moved to Application with identical API/game-cycle evidence, Quick 24/24,
   Architecture 32/32 and uncached Full 64/64. Its current classic DEV browser smoke
   preserved 64 visible button texts and three save strings after reload, with one loop
   and zero warnings/errors. These are separate checkpoints; owner play remains pending.
2. **Review and implement native production startup/canonical browser cutover.** Deliver
   `src/entrypoints/game.entry.js` importing only production Bootstrap. Audit current
   config/interface/version/badge activation phases and surviving classic DEV consumers.
   The owner chose complete native production now and native DEV in Stage 6; v8 records
   that decision. The earlier loader proposal/review are historical alternatives, not
   current implementation instructions. Preserve the existing classic/IIFE document in
   `dev.html`; replace the `index.html` script list with the single production module
   entry. No new legacy loader and no native/IIFE combination within one page realm.
   Prepare optional diagnostic ports and policy-selected legacy tooling before cutover.
   Keep enabled Fixed Catch mandatory and injected; inject the stateless GodMode reader
   over the sole production CONFIG. Validate diagnostic contracts when supplied, and
   explicitly allow absent overlay/render/watchdog. Exercise one native module graph:
   no duplicate writable CONFIG/catalog/context or class identities within production.
   Cluster 028's original `src/app/script.js` is explicitly deferred to Stage 6; this
   does not defer Stage 5's native startup obligation. Record any new reviewed design
   before changing evidence mechanisms; keep preparations/migrations separate.
   Execute 028 as the following bounded substeps, with a reviewable result and
   checkpoint for each:

   | Substep | Deliverable / completion condition | Status at this checkpoint |
   | --- | --- | --- |
   | 028.1 | Inject required gameplay dependencies: intact Fixed Catch and a stateless GodMode reader over the sole CONFIG, preserving enabled effects. | Fixed Catch 030 complete; GodMode reader preparation awaiting acceptance. |
   | 028.2 | Make diagnostic overlay/render/watchdog explicitly optional and validate every supplied contract; preserve DEV behavior. | Current preparation; acceptance pending. |
   | 028.3 | Select retained legacy order from policy for build/VM tooling, while production checks inspect native index/import closure. | Preparation in progress; acceptance pending. |
   | 028.4 | Atomic cutover: production Bootstrap and game.entry, index with one module script, current classic/IIFE page retained intact as dev.html. | Pending. |
   | 028.5 | Focused evidence, Architecture, Quick, uncached Full and both browser launches; verify gameplay, identity, one loop, saves/reload and cleanup. | Pending. |

   028.1 and 028.2 may share one cohesive capability-preparation commit, with separate
   deliverables recorded. Keep 028.4 coherent in one cutover: no partial mixed runtime
   or temporary loader. These substeps refine 028 rather than inventing new clusters.
3. **Verify the overall architecture goal.** Check dependency direction, mutable ownership,
   production independence from DEV/transport, injected live config and one game loop.
   Reconcile exact bridge/activation holders and assign all legitimate survivors to
   Stage 6/7. The saved visual-field audit is complete with the existing schema 4.
   Evaluate standard boundary tooling only after native game startup works.
4. **Prepare Stage 5 closure.** Complete focused/evidence/Quick/Architecture/uncached Full
   and browser acceptance; reconcile plans, reviewed scope, metrics, release projection
   and pending owner play. Meet the utils non-growth budget without weakening checks.
   Produce the reviewed release, closure record/tag and an English Stage 6 handoff.
5. **Perform the owner's separately authorized dead-code and final cleanup after Stage 5.**
   Prove actual unreachability before deleting code or obsolete tooling. Keep historical
   evidence and necessary Stage 6/7 bridges. Validate every cleanup change and finish
   with a clean pushed develop checkpoint and an updated remaining-work list.

## Current limits

Stage 5 remains incomplete. At committed checkpoint `ee0457a`, the default page still
starts through classic Development Bootstrap and the compatibility IIFE. Preparation
for 028 is in progress; it is not a completed native cutover. No Stage 5 release/closure/tag,
post-Stage-5 dead-code cleanup or owner manual play is claimed by this checkpoint.
Version remains 0.25.2; migration label is 5.29. Runtime: 28 active activations,
380 retired activations, 7 inert modules, 53 bridges, 852 historical global baseline
entries and 24 known debts. These are migration facts, not proof of native browser boot.
