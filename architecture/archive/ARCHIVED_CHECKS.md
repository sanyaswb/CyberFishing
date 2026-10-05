# Archived checks

Archived by owner decision 2026-10-01: history replay and every check that reconstructs or hashes historical
migration evidence moved out of `develop`. The checks still run unchanged at the annotated tag
`stage3-evidence-archive` (branch `migration-archive`); the final acceptance Full of that tree is
`stage3_final_acceptance.json` beside this file.

166 checks. Reason for each: archived by owner decision 2026-10-01.

| id | title | suites |
| --- | --- | --- |
| migration-observation-persistence-corpus | Migration observation persistence corpus sync | architecture |
| observation-graph-integrity-corpus | Observation graph integrity and reverse consumers | architecture |
| stage-1-closure | Stage 1 closure and evidence freeze | quick, architecture |
| stage-2-legacy-bridge-build | Stage 2 classic bridge build foundation | quick, architecture |
| stage-2-asset-contracts-check | Stage 2.1 engine asset contracts | quick, architecture |
| stage-2-dependency-contract-check | Stage 2.2 engine dependency contract | quick, architecture |
| stage-2-event-primitives-check | Stage 2.3 engine event primitives | quick, architecture |
| stage-2-rendering-primitives-check | Stage 2.4 engine rendering primitives | quick, architecture |
| stage-3-domain-topology-corpus | Stage 3.0.2.3 domain SCC and depth corpus | quick, architecture |
| stage-3-batch-006-audit-fixtures | Stage 3.6.1 dependency/state audit contract fixtures | history |
| stage-3-batch-006-audit-integration | Stage 3.6.1 dependency/state audit integration | history |
| stage-3-batch-006-execution-plan-fixtures | Stage 3.6.2 atomic execution-plan contract fixtures | history |
| stage-3-batch-006-execution-plan-integration | Stage 3.6.2 atomic execution-plan integration | history |
| stage-3-batch-006-test-matrix-fixtures | Stage 3.6.3 focused test-matrix contract fixtures | history |
| stage-3-batch-006-focused-test-matrix | Stage 3.6.3 executable focused behavior and compatibility matrix | gameplay, history |
| stage-3-batch-006-prebuild-fixtures | Stage 3.6.4 pre-build lifecycle contract fixtures | history |
| stage-3-batch-006-prebuild-integration | Stage 3.6.4 pre-build metadata and active-runtime separation | history |
| stage-3-batch-006-runtime | Stage 3.6.5/3.6.6 atomic ESM cutover and cumulative runtime | gameplay, history |
| stage-3-batch-006-observations | Stage 3.6.7 observation and Manifest reconciliation | history |
| stage-3-batch-006-release-acceptance | Stage 3.6.8 release acceptance and batch completion | history |
| stage-3-batch-007-audit-fixtures | Stage 3.7.0 dependency/state/performance audit contract fixtures | history |
| stage-3-batch-007-audit-integration | Stage 3.7.0 dependency/state/performance audit integration | history |
| stage-3-batch-tooling-generalization | Stage 3.8.0 explicit generic batch tooling and historical byte stability | quick, architecture |
| stage-3-batch-009-cutover-fixtures | Stage 3.9.5–3.9.6 exact transaction rollback and live failure fixtures | history |
| stage-3-batch-009-observation-fixtures | Stage 3.9.7 exact observation delta, immutable history and rollback fixtures | history |
| stage-3-batch-009-observation | Stage 3.9.7 full live observation and Manifest reconciliation | history |
| stage-3-batch-009-live-runtime | Stage 3.9.5–3.9.6 actual published runtime identity, timing and state | history |
| stage-3-batch-009-source-build-fixtures | Stage 3.9.3–3.9.4 isolated prebuild and candidate failure fixtures | history |
| stage-3-batch-009-source-build | Stage 3.9.3–3.9.4 exact live prebuild and deterministic isolated candidate build | history |
| stage-3-batch-009-planning-fixtures | Stage 3.9.0–3.9.2 audit, execution and focused contract negative fixtures | history |
| stage-3-batch-009-planning | Stage 3.9.0–3.9.2 live preflight and isolated ESM behavior/identity matrix | history |
| stage-3-batch-010-audit-fixtures | Stage 3.10.0 source, dependency and evidence negative fixtures | history |
| stage-3-batch-010-audit | Stage 3.10.0 deterministic live preflight audit replay | history |
| stage-3-batch-010-planning-fixtures | Stage 3.10.1–3.10.2 plan, matrix and parity negative fixtures | history |
| stage-3-batch-010-planning | Stage 3.10.1–3.10.2 exact execution plan and focused ESM parity | history |
| stage-3-batch-010-source-build-fixtures | Stage 3.10.4–3.10.5 source, output and atomic publication negative fixtures | history |
| stage-3-batch-010-source-build | Stage 3.10.4 deterministic candidate build and evaluation count | history |
| stage-3-batch-010-live-runtime | Stage 3.10.6 published runtime identity, timing and allocation parity | history |
| stage-3-batch-010-observations | Stage 3.10.7 live observation and Manifest reconciliation | history |
| stage-3-batch-010-release-fixtures | Stage 3.10.9 release transition and publication rollback fixtures | history |
| stage-3-batch-010-release | Stage 3.10.9 release closure, browser proof and completed prefix | history |
| stage-3-batch-011-audit-fixtures | Stage 3.11.0 source, state and evidence negative fixtures | history |
| stage-3-batch-011-audit | Stage 3.11.0 deterministic five-module preflight replay | history |
| stage-3-batch-011-planning | Stage 3.11.1–3.11.2 atomic plan and focused behavior matrix | history |
| stage-3-batch-011-source-build-fixtures | Stage 3.11.4 candidate failure isolation fixtures | history |
| stage-3-batch-011-source-build | Stage 3.11.4 deterministic candidate and evaluation count | history |
| stage-3-batch-011-cutover-fixtures | Stage 3.11.5 atomic cutover rollback boundaries | history |
| stage-3-batch-011-live-runtime | Stage 3.11.6 published runtime identity, timing and state parity | history |
| stage-3-batch-011-observations | Stage 3.11.7 live observation and Manifest reconciliation | history |
| stage-3-batch-012-audit | Stage 3.12.0 reviewed side effects and deterministic preflight | history |
| stage-3-batch-012-planning | Stage 3.12.1–3.12.2 exact plan and behavior matrix | history |
| stage-3-batch-012-focused-parity | Stage 3.12.2 classic and ESM behavior parity | history |
| stage-3-batch-012-source-build | Stage 3.12.4 reproducible candidate and evaluation count | history |
| stage-3-batch-012-cutover-fixtures | Stage 3.12.5 atomic cutover failure boundaries | history |
| stage-3-batch-012-live-runtime | Stage 3.12.6 identity, timing and state parity | history |
| stage-3-batch-012-observations | Stage 3.12.7 Manifest, graph and guard reconciliation | history |
| stage-3-batch-013-architecture | Stage 3.13.0–3.13.7 fishing domain migration and rollback gates | history |
| stage-3-batch-014-architecture | Stage 3.14.0–3.14.7 fishing stamina and tackle domain migration and rollback gates | history |
| stage-3-batch-015-architecture | Stage 3.15.0–3.15.7 fishing endurance and pressure domain migration and rollback gates | history |
| stage-3-batch-016-architecture | Stage 3.16.0–3.16.7 fishing pressure fatigue source domain migration and rollback gates | history |
| stage-3-batch-017-architecture | Stage 3.17.0–3.17.7 inventory item location domain migration and rollback gates | history |
| stage-3-batch-018-architecture | Stage 3.18.0–3.18.7 items bait freshness and metrics domain migration and rollback gates | history |
| stage-3-batch-019-architecture | Stage 3.19.0–3.19.7 items bait grade decay and quality domain migration and rollback gates | history |
| stage-3-batch-020-architecture | Stage 3.20.0–3.20.7 assemblies refill signature and state domain migration and rollback gates | history |
| stage-3-batch-021-architecture | Stage 3.21.0–3.21.7 equipment auto refill policy domain migration and rollback gates | history |
| stage-3-batch-022-architecture | Stage 3.23.0–3.23.7 assemblies item reader domain migration with reviewed prefix import and rollback gates | history |
| stage-3-batch-023-architecture | Stage 3.24.0–3.24.7 item metric strategies domain migration with reviewed imported superclass and rollback gates | history |
| stage-3-batch-024-architecture | Stage 3.25.0–3.25.7 inventory reservation policy domain migration with reviewed exposure, import and rollback gates | history |
| stage-3-batch-025-architecture | Stage 3.26.0–3.26.7 fishing sector pressure and retrieve domain migration with reviewed imports, activation retirement and rollback gates | history |
| stage-3-batch-026-architecture | Stage 3.27.0–3.27.7 inventory assembly stacking policy domain migration with reviewed private static set, import and rollback gates | history |
| stage-3-batch-027-architecture | Stage 3.28.0–3.28.7 items metric registry, quality modifiers and authored rarity domain migration with imports, retirements and rollback gates | history |
| stage-3-batch-028-architecture | Stage 3.29.0–3.29.7 assemblies item assembly service domain migration with earlier-batch imports and rollback gates | history |
| stage-3-batch-029-architecture | Stage 3.30.0–3.30.7 fishing sector angle and stamina phase domain migration with earlier-batch imports, retirements and rollback gates | history |
| stage-3-batch-030-architecture | Stage 3.31.0–3.31.7 items hook power and rarity resolver domain migration with earlier-batch imports, retirement and rollback gates | history |
| stage-3-batch-031-architecture | Stage 3.32.0–3.32.7 fishing stamina balance frame domain migration with earlier-batch import, retirements and rollback gates | history |
| stage-3-batch-032-architecture | Stage 3.33.0–3.33.7 items effective rarity resolver domain migration with earlier-batch import and rollback gates | history |
| stage-3-batch-033-architecture | Stage 3.34.0–3.34.7 assemblies assembly state repository domain migration with freeze-extension adoption, retirements and rollback gates | history |
| stage-3-batch-034-architecture | Stage 3.35.0–3.35.7 fishing hot-loop cluster domain migration with recorded hot-loop evidence, trace equivalence, retirements and rollback gates | history |
| stage-3-batch-035-architecture | Stage 3.36.0–3.36.7 items condition resolver domain migration with Stage 3.36 prefix adoption, imported superclass and rollback gates | history |
| stage-3-batch-036-architecture | Stage 3.37.0–3.37.7 items effective stats domain migration with reviewed exposures and rollback gates | history |
| stage-3-batch-037-architecture | Stage 3.38.0–3.38.7 items bait, freshness and progression resolvers domain migration with imports, retirements and rollback gates | history |
| stage-3-batch-038-architecture | Stage 3.39.0–3.39.7 assemblies profile registry domain migration with collection identities and rollback gates | history |
| stage-3-batch-039-architecture | Stage 3.40.0–3.40.7 inventory capacity and stamina domain migration with split-slot activation, identity and rollback gates | history |
| stage-3-batch-040-architecture | Stage 3.41.0–3.41.7 casting, items, line and gameplay-rules domain migration with foundation imports, split-slot retirement and rollback gates | history |
| stage-3-batch-041-architecture | Stage 3.42.0–3.42.7 landing policy domain migration with a reviewed top-level function export, local default compositions and rollback gates | quick, architecture, history |
| stage-3-34-review-queue-freeze | Stage 3.34.0 review-queue evidence (collection identity, hot-loop equivalence) and freeze extension replay | quick, architecture |
| stage-3-34-review-queue-freeze-fixtures | Stage 3.34.0 review-queue freeze rejects tampered evidence, sources, decisions and extensions | quick, architecture |
| stage-3-36-graph-review | Stage 3.36.0 repeated post-freeze graph review replays byte-identically and chains its approved prefix | quick, architecture |
| stage-3-40-graph-review | Stage 3.40.0 repeated post-freeze graph review (after the six decompositions and Vector2 Engine ownership) replays byte-identically and chains its approved prefix | quick, architecture |
| stage-3-41-graph-review | Stage 3.41.0 replacement graph review after batch 039 and normalizeDistance Engine ownership replays byte-identically and replaces only the incomplete suffix | quick, architecture |
| stage-3-41-replacement-plan-fixtures | Stage 3.41.0 replacement approved-plan link rejects incomplete, reordered, stale and empty suffix replacements | quick, architecture |
| stage-3-42-graph-review | Stage 3.42.0 replacement graph review after batch 040 and the duplicate-helper removal replays byte-identically and replaces only the incomplete suffix | quick, architecture |
| stage-3-prerequisite-001 | Stage 3 prerequisite 001: AssemblyProfileRegistry config injection replays byte-identically with parity, resolved debt and clean guards | quick, architecture, history |
| stage-3-prerequisite-002 | Stage 3 prerequisite 002: ItemStatOverridePolicy config injection replays byte-identically with parity, resolved debts and clean guards | quick, architecture, history |
| stage-3-prerequisite-003 | Stage 3 prerequisite 003: item condition descriptor boundary replays byte-identically with parity, resolved debt and clean guards | quick, architecture, history |
| stage-3-prerequisite-004 | Stage 3 prerequisite 004: item freshness descriptor boundary replays byte-identically with parity, resolved debt and clean guards | quick, architecture, history |
| stage-3-prerequisite-005 | Stage 3 prerequisite 005: bait effectiveness descriptor boundary replays byte-identically with parity, resolved debt and clean guards | quick, architecture, history |
| stage-3-prerequisite-006 | Stage 3 prerequisite 006: Vector2 classic extraction with split legacy slot 41 replays byte-identically with parity, resolved debts and clean guards | quick, architecture, history |
| stage-3-prerequisite-007 | Stage 3 prerequisite 007: equipment presentation text boundary with split legacy slot 30 replays byte-identically with parity, reviewed Manifest updates, exact baseline additions and clean guards | quick, architecture, history |
| stage-3-prerequisite-008 | Stage 3 prerequisite 008: terminal-line label split with split legacy slot 159 and reclassification of the equipment slot rules replays byte-identically with parity, resolved debts, derived waves and clean guards | quick, architecture, history |
| stage-3-prerequisite-009 | Stage 3 prerequisite 009: inventory capacity and line allocation text boundary replays byte-identically with parity, reviewed Manifest updates and clean guards | quick, architecture, history |
| stage-3-prerequisite-010 | Stage 3 prerequisite 010: loadout transition text boundary replays byte-identically with parity, a reviewed Manifest update and clean guards | quick, architecture, history |
| stage-3-prerequisite-011 | Stage 3 prerequisite 011: item capacity label text boundary replays byte-identically with parity, a reviewed Manifest update and clean guards | quick, architecture, history |
| stage-3-prerequisite-012 | Stage 3 prerequisite 012: inventory evidence-backed blocker removal without edit replays byte-identically with pinned sources and clean guards | quick, architecture, history |
| stage-3-prerequisite-013 | Stage 3 prerequisite 013: loadout evidence-backed blocker removal without edit replays byte-identically with a pinned source and clean guards | quick, architecture, history |
| stage-3-prerequisite-014 | Stage 3 prerequisite 014: injected platform warning logger with split legacy slot 79 and evidence-backed metric reviews replay byte-identically with parity, resolved debt and clean guards | quick, architecture, history |
| stage-3-prerequisite-015 | Stage 3 prerequisite 015: FightPhysicsConfigAdapter fallback removal from fishing Domain sources replays byte-identically with parity, resolved debts and clean guards | quick, architecture, history |
| stage-3-prerequisite-016 | Stage 3 prerequisite 016: BuffManager split with legacy slot 207 and cohesive hot-loop rule reviews replay byte-identically with parity and clean guards | quick, architecture, history |
| stage-3-prerequisite-017 | Stage 3 prerequisite 017: DistanceUnitConverter split with legacy slot 89 and fishing-system reviews replay byte-identically with parity and clean guards | quick, architecture, history |
| stage-3-prerequisite-018 | Stage 3 prerequisite 018: GodMode bite-sequence override through the injected DevFlagsProvider replays byte-identically with parity, resolved DEV debts and clean guards | quick, architecture, history |
| stage-3-prerequisite-019 | Stage 3 prerequisite 019: EquipmentRules config injection replays byte-identically with parity, resolved debt and clean guards | quick, architecture, history |
| stage-3-prerequisite-020 | Stage 3 prerequisite 020: tackle.js live runtime-config provider with recorded global getter removals replays byte-identically with hot-loop parity, resolved debts and clean guards | quick, architecture, history |
| stage-3-prerequisite-021 | Stage 3 prerequisite 021: ConsoleLogger replacing ConsoleWarningLogger (deleted file, exact replacement pair, split slot 79) replays byte-identically with parity and clean guards | quick, architecture, history |
| stage-3-prerequisite-022 | Stage 3 prerequisite 022: fish.js diagnostics through the injected ConsoleLogger replay byte-identically with parity and clean guards | quick, architecture, history |
| stage-3-prerequisite-023 | Stage 3 prerequisite 023: rod kind names from the rodKinds section of the injected rule messages replay byte-identically with parity and clean guards | quick, architecture, history |
| stage-3-prerequisite-024 | Stage 3 prerequisite 024: gameplay rules without self-composition (defaults removed, rules.js reclassified cohesive) replay byte-identically with parity and clean guards | quick, architecture, history |
| stage-3-prerequisite-025 | Stage 3 prerequisite 025: fish.js and tackle.js reviewed without edit (cohesive, hot loops not split) replay byte-identically with pinned sources and clean guards | quick, architecture, history |
| stage-3-prerequisite-026 | Stage 3 prerequisite 026: ViewportProjector moved byte-for-byte out of world.js (split slot 204, provider moved) replays byte-identically with parity and clean guards | quick, architecture, history |
| stage-3-prerequisite-027 | Stage 3 prerequisite 027: Vector2 Engine ESM ownership with a standard activation after the runtime tag (rebuilt runtime, one bridge per consumer) replays byte-identically with parity and clean guards | quick, architecture, history |
| stage-3-prerequisite-028 | Stage 3 prerequisite 028: normalizeDistance moves byte-identically out of app/utils.js at split slot 390 and replays with behavior parity and clean guards | quick, architecture, history |
| stage-3-prerequisite-029 | Stage 3 prerequisite 029: normalizeDistance Engine ESM ownership, standard activation and exact consumer bridge replay with identity parity and clean guards | quick, architecture, history |
| stage-3-prerequisite-030 | Stage 3 prerequisite 030: duplicate resolveFightPhysicsConfig removed from retrieve_policy.js with one recorded provider removal, one Domain edge and retrieve/landing parity | quick, architecture, history |
| stage-3-prerequisite-031 | Stage 3 prerequisite 031: cumulative runtime tag moved before the earliest Domain slot 30 with the same logical order and a runtime free of classic globals | quick, architecture, history |
| stage-3-shared-batch-tooling-negative | Shared Stage 3 batch tooling rejects wrong or incomplete batch definitions and preflight inputs | quick, architecture |
| stage-3-shared-batch-tooling-equivalence | Shared Stage 3 batch tooling reproduces every accepted batch-025 artifact byte-for-byte | architecture, history |
| stage-3-22-post-freeze-review | Stage 3.22 post-freeze graph review, next-prefix plan and freeze replay | quick, architecture |
| stage-3-batch-008-audit-fixtures | Stage 3.8.0 batch-008 dependency/state preflight fixtures | history |
| stage-3-batch-008-audit-integration | Stage 3.8.0 batch-008 dependency/state preflight integration | history |
| stage-3-batch-008-execution-plan-fixtures | Stage 3.8.1 atomic execution-plan contract fixtures | history |
| stage-3-batch-008-execution-plan-integration | Stage 3.8.1 SCM-backed atomic execution plan | history |
| stage-3-batch-008-test-matrix-fixtures | Stage 3.8.2 focused test-matrix contract fixtures | history |
| stage-3-batch-008-focused-test-matrix | Stage 3.8.2 classic and temporary-ESM behavior/state matrix | gameplay, history |
| stage-3-batch-008-prebuild-fixtures | Stage 3.8.3 exact prebuild contract fixtures | history |
| stage-3-batch-008-prebuild-transaction-fixtures | Stage 3.8.3 atomic metadata-open rollback fixtures | history |
| stage-3-batch-008-prebuild-integration | Stage 3.8.3 prebuild-open state and frozen runtime topology | history |
| stage-3-batch-008-source-build-fixtures | Stage 3.8.4 source/build negative and failure-recovery fixtures | history |
| stage-3-batch-008-source-build-integration | Stage 3.8.4 actual candidate build, identity and pending Manifest | gameplay, history |
| stage-3-batch-008-cutover-fixtures | Stage 3.8.5 full transaction rollback boundaries | history |
| stage-3-batch-008-runtime-cutover | Stage 3.8.5 actual cutover topology and cumulative regressions | gameplay, history |
| stage-3-batch-008-live-runtime-fixtures | Stage 3.8.6 evaluation, timing, state and allocation negative fixtures | history |
| stage-3-batch-008-live-runtime-integration | Stage 3.8.6 actual live runtime and immutable evidence replay | gameplay, history |
| stage-3-batch-008-observation-fixtures | Stage 3.8.7 exact facts, metadata boundaries and transactional rollback | history |
| stage-3-batch-008-observation-integration | Stage 3.8.7 current observation persistence and historical evidence | gameplay, history |
| stage-3-batch-007-execution-plan-fixtures | Stage 3.7.1 atomic execution-plan contract fixtures | history |
| stage-3-batch-007-execution-plan-integration | Stage 3.7.1 SCM-backed atomic execution plan | history |
| stage-3-batch-007-test-matrix-fixtures | Stage 3.7.2 focused test-matrix contract fixtures | history |
| stage-3-batch-007-focused-test-matrix | Stage 3.7.2 classic and temporary-ESM behavior/compatibility matrix | gameplay, history |
| stage-3-batch-prebuild-tooling-generalization | Stage 3.7.3 reusable prebuild tooling and batch-006 byte stability | quick, architecture |
| stage-3-batch-007-prebuild-fixtures | Stage 3.7.3 exact prebuild contract fixtures | history |
| stage-3-batch-007-prebuild-transaction-fixtures | Stage 3.7.3 transactional metadata replacement fixtures | history |
| stage-3-batch-007-prebuild-integration | Stage 3.7.3 prebuild-open state and frozen runtime topology | history |
| stage-3-batch-007-source-build-fixtures | Stage 3.7.4 representation target and candidate-build fixtures | history |
| stage-3-batch-007-source-build-integration | Stage 3.7.4 target source and isolated candidate build validation | gameplay, history |
| stage-3-batch-007-cutover-fixtures | Stage 3.7.5 atomic runtime cutover fixtures | history |
| stage-3-batch-007-runtime-cutover | Stage 3.7.5 atomic runtime cutover | history |
| stage-3-batch-007-live-runtime-fixtures | Stage 3.7.6 live identity/state/performance fixtures | history |
| stage-3-batch-007-live-runtime-integration | Stage 3.7.6 live identity/state/performance integration | history |
| stage-3-batch-007-observation-fixtures | Stage 3.7.7 observation reconciliation and semantic-gate fixtures | history |
| stage-3-batch-007-observation-integration | Stage 3.7.7 mechanical reconciliation (not release approval) | history |
| stage-3-fishing-foundation-prebuild | Stage 3.5 fishing-foundation pre-build contract | quick, architecture, gameplay |
| stage-3-batch-007-reel-retrieve-browser-probe | Stage 3.7.8 reel/retrieve browser probe contract | tools, gameplay, history |
| stage-3-batch-007-acceptance | Stage 3.7.8 superseding acceptance | history |
| stage-3-batch-007-release-acceptance | Stage 3.7.9 release closure | history |
| stage-3-batch-008-release-acceptance | Stage 3.8.9 exact release closure and browser proof | history |
| stage-3-batch-008-release-fixtures | Stage 3.8.9 release transition and strict browser proof fixtures | history |
| stage-3-batch-009-release-acceptance | Stage 3.9.9 exact release transition, browser proof and completed prefix | history |

## Stage 3 history freeze at closure (2026-10-02)

Owner decision 2026-09-29 (Stage 4 process, D6) applied after the Stage 3 closure: the checks that replay or pin
specific Stage 3 batches against the live runtime contract, bridge registry and index (they cannot survive the
Stage 4 bridge removal or Domain cleanups) left the develop catalog. They pass unchanged at the annotated tag
`stage3-closed` (final acceptance Full 91/91 at f9a41ee). The live Domain boundary gates continue as the check
`domain-boundary` (no pinned counts); the pinned closure facts stay in `architecture/migration/stage_3_closure.json`.

15 checks.

| id | title | suites |
| --- | --- | --- |
| stage-3-batch-051-architecture | Stage 3.52.0–3.52.7 fish force system domain migration with composition identities, six retired activations, a per-frame representation-only target and rollback gates | quick, architecture |
| stage-3-50-graph-review | Stage 3.50.0 repeated graph review byte-identical replay | architecture |
| stage-3-50-review-queue-freeze | Stage 3.50.1 review-queue hot-loop evidence and freeze extension byte-identical replay | architecture |
| stage-3-closure | Stage 3 closure gates: Domain migrated, Domain/Engine dependencies only, no browser/DEV/transport globals, removal paths | quick, architecture |
| stage-3-compatibility-runtime-integration | Stage 3.0.4 cumulative compatibility runtime integration | quick, architecture |
| stage-3-candidate-batch-integration | Stage 3.0.5 candidate batch corpus and coverage | quick, architecture |
| stage-3-approved-prefix-integration | Stage 3.0.6 approved-prefix freeze integration | quick, architecture |
| stage-3-inventory-equip-target-batch | Stage 3.1 inventory equip-target domain batch | quick, architecture, inventory |
| stage-3-reel-auto-recovery-prebuild | Stage 3.2 reel auto-recovery pre-build contract | quick, architecture |
| stage-3-reel-auto-recovery-runtime | Stage 3.2 reel auto-recovery post-build runtime | quick, architecture, gameplay |
| stage-3-line-tension-prebuild | Stage 3.3 line-tension pre-build contract | quick, architecture |
| stage-3-line-tension-runtime | Stage 3.3 line-tension post-build runtime | quick, architecture, gameplay |
| stage-3-rod-capability-prebuild | Stage 3.4 rod-capability pre-build contract | quick, architecture, inventory-v2 |
| stage-3-rod-capability-runtime | Stage 3.4 rod-capability post-build runtime | quick, architecture, inventory-v2 |
| stage-3-fishing-foundation-runtime | Stage 3.5 fishing-foundation post-build runtime | quick, architecture, gameplay |

## Stage 4 tooling cleanup (2026-10-02)

Owner request 2026-10-02 (keep the project lean, remove code that is no longer used) and the Stage 4 brief
("move Stage-3-only tooling to the archive like the history archive; utils/ must shrink"): the checks that guard
only the Stage 3 batch-planning machinery (domain audit pipeline, candidate/approved-prefix planning, reviewed
shapes, prerequisite transitions, state-identity replacement) left the develop catalog together with every utils
file no live entry point reaches (216 files, 30,393 lines: stage-3-batch lifecycle, post-freeze review, domain
audit, per-batch fixture checks, generated probes). Stage 4 uses the cluster path instead. They pass unchanged at
the annotated tag `stage3-closed`; the live Domain gate stays `domain-boundary`.

17 checks.

| id | title | suites |
| --- | --- | --- |
| stage-3-domain-audit-fixtures | Stage 3 domain audit contract fixtures | architecture |
| stage-3-domain-audit-schema-migration | Stage 3.0.2.1 dependency audit schema migration | architecture |
| stage-3-domain-audit-corpus | Stage 3.0.1 conservative domain inventory | quick, architecture |
| stage-3-induced-domain-graph-fixtures | Stage 3.0.2.2 induced domain graph fixtures | architecture |
| stage-3-induced-domain-graph-corpus | Stage 3.0.2.2 induced domain graph corpus | quick, architecture |
| stage-3-domain-topology-fixtures | Stage 3.0.2.3 domain SCC and depth fixtures | architecture |
| stage-3-domain-observation-fixtures | Stage 3.0.2.4 capability, availability and effect fixtures | architecture |
| stage-3-dependency-audit-persistence-fixtures | Stage 3.0.2.5 dependency audit persistence fixtures | architecture |
| stage-3-dependency-audit-integration | Stage 3.0.2.6 dependency audit integration | quick, architecture |
| stage-3-semantic-observation-fixtures | Stage 3.0.3 state, config and performance fixtures | architecture |
| stage-3-semantic-persistence-fixtures | Stage 3.0.3 semantic persistence fixtures | architecture |
| stage-3-semantic-audit-integration | Stage 3.0.3 semantic audit integration | quick, architecture |
| stage-3-candidate-batch-fixtures | Stage 3.0.5 candidate batch policy and contract fixtures | architecture |
| stage-3-approved-prefix-fixtures | Stage 3.0.6 approved-prefix contract fixtures | architecture |
| stage-3-batch-reviewed-shapes-fixtures | Stage 3 batch reviewed top-level functions and local compositions accept only exact reviewed facts | quick, architecture |
| stage-3-prerequisite-transition-fixtures | Stage 3 prerequisite Manifest-update and global-provider-addition negative fixtures | quick, architecture |
| stage-3-state-identity-replacement-fixtures | Stage 3 state-identity transactional swap, rebuilt index and size read fixtures | quick, architecture |

## M1 utils closure (2026-10-02, before release 0.25.0)

Working rule 6 (utils must not grow across a milestone; baseline 72,035 tracked utils .js/.json lines at 893301c):
the archived check `stage-1-closure` (table above) failed on develop since Stage 4.1 (its validator pins the Stage 3
package contract label) and only the package script `architecture:closure` still named it. Its source and the files
only it reached left develop: `utils/architecture/stage-1-closure-check.js`, `closure/stage_one_closure_validator.js`
and `domain_batches/stage_three_batch_008_{behavior_cases,candidate_build,cutover,source_build}.js` (6 files, 2,369
lines; require/string closure of the catalog, package scripts and Stage 4 CLIs). They run unchanged at
`stage3-evidence-archive` / `stage3-closed`. The package script stays (package.json is pinned except its version);
removing it is deferred together with the `struct` script decision. The release delta of the Stage 4 release command
keeps the Stage 1 package pin's intent: a release may change only the version fields.

## M2 utils closure (2026-10-02)

Archived at `stage4-m2-tools-archive` before removal: the unused history reconstruction
`utils/testing/core/history_base.js`, `utils/architecture/post_freeze/post_freeze_review_profile.js`
and `utils/architecture/review_queue/review_queue_paths.js` (3 files, 357 lines). A conservative
literal require/path closure of all 64 live checks, package commands and Stage 4 CLIs proves
these files unreachable after removing history reconstruction from the runner and its seal policy.
The remaining historical helpers are retained where live fixtures and planners still consume them.
No live check was removed. Cache regression still proves obsolete scopes and tooling drift invalidate
seals; current checks execute directly in the workspace.

## Stage 5 historical tooling archival (2026-10-05)

The unused three-line hydration import disconnected 262 historical replay/planning utilities
(25,470 lines); every one was removed after the current 64-check/package/CLI/native-fixture/evidence
closure proved zero incoming live edges. No catalog check or historical evidence source was removed.
Current utility size: 216 JS/JSON files / 46,324 newline-counted lines. See
`architecture/migration/stage_5/tooling_archive_applied.json` for current verification status.

Native commit `aac62f615e1e709460680e7eab71b861871d9c1b` preserves all normalized Git blobs;
`stage3-evidence-archive` preserves 257 matching current blobs and earlier forms of five later variants.
Annotated tag `stage5-tools-archive` points to `fcade4bebef24116bc910b5c2e36dba125e23cea` and preserves all
262 exact working-byte blobs, rechecked against the audit SHA256 values. For byte-identical recovery,
read `git cat-file blob stage5-tools-archive:<path>` with a binary subprocess and write stdout bytes
directly. A filtered Git checkout or PowerShell text redirection does not establish byte identity.
