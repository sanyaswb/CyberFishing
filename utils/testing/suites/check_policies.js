"use strict";

const { DATA } = require("../core/history_base");

// Reviewed cache and isolation contracts, applied to the manifest definitions by the runner.
// A check absent from these lists keeps the defaults: cache policy "never" (always executes) and
// "exclusive" isolation (runs alone). Entries are added only after the check's traced dependency
// record was reviewed; the runner re-verifies both contracts on every execution.

// History replays of batches up to the history base read the reconstructed release (its data trees)
// plus code and installed dependencies, which the tracer fingerprints file by file.
const HISTORY_BASE_REPLAY = Object.freeze({ policy: "snapshot", inputPaths: Object.freeze([...DATA]),
  environmentKeys: Object.freeze([]) });

const SNAPSHOT_CONTRACTS = Object.freeze([
  // Every history replay of the base except the one that rebuilds dist inside the base (its writes make
  // it non-cacheable). Reviewed from the traced survey of 2026-09-28; the two 007 observation replays
  // build their historical runtime in a temporary workspace since 2026-09-29 (traced and sealed).
  Object.freeze({ contract: "history-base-replay", cache: HISTORY_BASE_REPLAY, ids: Object.freeze([
  ]) }),
]);

// Checks reviewed to make no persistent project writes and to start no process the tracer cannot
// follow; they may run in parallel with each other. Reviewed from the traced survey of 2026-09-28:
// every check except the seven that rebuild dist (live or in the history base) and the cache
// regression check (it runs nested check runners).
const WRITERS = Object.freeze([
  "stage-3-compatibility-runtime-integration",
  "stage-3-fishing-foundation-runtime",
  "stage-3-line-tension-runtime",
  "stage-3-reel-auto-recovery-runtime",
  "stage-3-rod-capability-runtime",
]);
const READ_ONLY_CHECKS = Object.freeze([
  "syntax",
  "architecture-policy",
  "architecture-documentation",
  "migration-manifest-integrity",
  "migration-manifest-reconciler",
  "migration-manifest-schema-migration",
  "migration-manifest-validator",
  "legacy-symbol-provider-fixtures",
  "legacy-symbol-provider-corpus",
  "legacy-external-consumer-fixtures",
  "legacy-external-consumer-corpus",
  "provider-resolution-contract",
  "provider-resolution-fixtures",
  "provider-resolution-corpus",
  "migration-observation-persistence-fixtures",
  "observation-graph-integrity-fixtures",
  "classification-evidence-fixtures",
  "classification-evidence-corpus",
  "stage-1-6-migration-batch-plan",
  "approved-stage-2-batch-freeze",
  "architecture-guard-fixtures",
  "architecture-guard-corpus",
  "root-package-contract",
  "native-esm-fixture",
  "vite-fixture-build",
  "stage-3-domain-audit-fixtures",
  "stage-3-domain-audit-schema-migration",
  "stage-3-domain-audit-corpus",
  "stage-3-induced-domain-graph-fixtures",
  "stage-3-induced-domain-graph-corpus",
  "stage-3-domain-topology-fixtures",
  "stage-3-domain-observation-fixtures",
  "stage-3-dependency-audit-persistence-fixtures",
  "stage-3-dependency-audit-integration",
  "stage-3-semantic-observation-fixtures",
  "stage-3-semantic-persistence-fixtures",
  "stage-3-semantic-audit-integration",
  "stage-3-compatibility-runtime-fixtures",
  "stage-3-candidate-batch-fixtures",
  "stage-3-candidate-batch-integration",
  "stage-3-approved-prefix-fixtures",
  "stage-3-approved-prefix-integration",
  "stage-3-batch-049-architecture",
  "stage-3-batch-reviewed-shapes-fixtures",
  "stage-3-prerequisite-transition-fixtures",
  "legacy-slot-split",
  "stage-3-runtime-load-order",
  "stage-3-activation-retirement-fixtures",
  "stage-3-changelog-trim-fixtures",
  "stage-3-state-identity-replacement-fixtures",
  "stage-3-inventory-equip-target-batch",
  "stage-3-reel-auto-recovery-prebuild",
  "stage-3-line-tension-prebuild",
  "stage-3-rod-capability-prebuild",
  "line-allocation",
  "float-depth",
  "inventory-lifecycle",
  "assembly-domain",
  "inventory-v2-equipment",
  "inventory-v2-equipment-hydration",
  "inventory-v2-transaction",
  "inventory-v2-migration",
  "inventory-v2-cast-lure",
  "inventory-v2-line-allocation",
  "consumable-event-identity",
  "inventory-v2-integration",
  "inventory-v2-ui",
  "bait-effectiveness",
  "item-freshness-gameplay",
  "hook-domain-semantics",
  "item-stat-contract",
  "fish-rarity",
  "item-rarity",
  "item-rarity-roundtrip",
  "item-progression",
  "item-condition",
  "item-state-hardening",
  "degradation-colors",
  "rarity-production",
  "victory-input",
  "game-cycle",
  "devtools-links",
]);

function applyCheckPolicies(definitions) {
  const ids = new Set(definitions.map((definition) => definition.id));
  const cacheById = new Map();
  for (const { contract, cache, ids: members } of SNAPSHOT_CONTRACTS) {
    for (const id of members) {
      if (!ids.has(id)) throw new Error(`Cache contract ${contract} names an unknown check: ${id}`);
      if (cacheById.has(id)) throw new Error(`Check has two cache contracts: ${id}`);
      cacheById.set(id, cache);
    }
  }
  const readOnly = new Set(READ_ONLY_CHECKS);
  for (const id of readOnly) {
    if (!ids.has(id)) throw new Error(`Read-only isolation names an unknown check: ${id}`);
  }
  return definitions.map((definition) => ({
    ...definition,
    ...(cacheById.has(definition.id) ? { cache: cacheById.get(definition.id) } : {}),
    ...(readOnly.has(definition.id) ? { isolation: "read-only" } : {}),
  }));
}

module.exports = { applyCheckPolicies, HISTORY_BASE_REPLAY, READ_ONLY_CHECKS, SNAPSHOT_CONTRACTS, WRITERS };
