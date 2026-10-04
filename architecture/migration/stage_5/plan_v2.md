# Stage 5 remaining execution plan v2

Date: 2026-10-04. Implementation resumed with cluster 027 in the new session.
This is the current task queue, not a new scope/cluster review or a Stage 5 closure.
The authoritative reviewed membership/order remains `graph_review_v7.json`.
Read `stage5_continuation_spec.md` for the English execution specification, verified
checkpoint, acceptance evidence and implementation constraints. `plan_v1.md` is the
historical initial plan; its starting counts and pending preparations are superseded.

## Completed

- [x] Clusters 001–027 and Engine prerequisite 029: 28 applied clusters, 101 ESM targets.
- [x] Preparations 001–025, including loadout clock propagation (017), external DEV
  factories, injected Root config, portable inventory imports and browser lifecycle.
- [x] Presentation/render/UI/config-context/version declarations, Inventory composition,
  Inventory UI Bootstrap, GameApplication/facades and production GameCompositionRoot.
- [x] Game readiness/start/stop/dispose scenario added to the existing inventory lifecycle
  check; Quick 24/24, Architecture 32/32 and uncached Full 64/64 passed.

## Next session, in order

1. **Completed: Game, cluster 027.** One immutable API capture, plan/apply/verify and
   real-class lifecycle scenario passed with identical members/traces and game-cycle.
   Quick 24/24, Architecture 32/32, uncached Full 64/64; browser: 27 export identities,
   nine config facts, one loop, zero warnings/errors, 52 button texts and three save
   strings identical after reload. Separate migration checkpoint; owner play pending.
2. **Review and implement native production startup/canonical browser cutover.** Deliver
   `src/entrypoints/game.entry.js` importing only production Bootstrap. Audit current
   config/interface/version/badge activation phases and surviving classic DEV consumers
   before choosing the smallest compliant cutover. Exercise one native module graph:
   no duplicate writable CONFIG/catalog/context or class identities from native + IIFE.
   Cluster 028's original `src/app/script.js` is explicitly deferred to Stage 6; this
   does not defer Stage 5's native startup obligation. Record any new reviewed design
   before changing topology or evidence mechanisms; keep preparations/migrations separate.
3. **Verify the overall architecture goal.** Check dependency direction, mutable ownership,
   production independence from DEV/transport, injected live config and one game loop.
   Reconcile exact bridge/activation holders and assign all legitimate survivors to
   Stage 6/7. Finish the saved visual-field writer/reader audit without changing save
   schema. Evaluate standard boundary tooling only after native game startup works.
4. **Prepare Stage 5 closure.** Complete focused/evidence/Quick/Architecture/uncached Full
   and browser acceptance; reconcile plans, reviewed scope, metrics, release projection
   and pending owner play. Meet the utils non-growth budget without weakening checks.
   Produce the reviewed release, closure record/tag and an English Stage 6 handoff.
5. **Perform the owner's separately authorized dead-code and final cleanup after Stage 5.**
   Prove actual unreachability before deleting code or obsolete tooling. Keep historical
   evidence and necessary Stage 6/7 bridges. Validate every cleanup change and finish
   with a clean pushed develop checkpoint and an updated remaining-work list.

## Current limits

Stage 5 remains incomplete. Production still starts through classic Development
Bootstrap and the compatibility IIFE. No native cutover, Stage 5 release/closure/tag,
post-Stage-5 dead-code cleanup or owner manual play is claimed by this checkpoint.
Version remains 0.25.2; migration label is 5.28. Runtime: 27 active activations,
380 retired activations, 7 inert modules, 52 bridges, 852 historical global baseline
entries and 24 known debts. These are migration facts, not proof of native browser boot.
