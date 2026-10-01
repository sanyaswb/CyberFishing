/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.85";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "equipment-rules-loadout-planner-line-system-domain",
  updatedAt: "2026-10-01",
  notes: Object.freeze([
    "Migrate the slot visibility policy, manual rod change planner with its transition plan, fishing readiness policy, terminal-line slot resolver, loadout transition planner and line system",
    "Import thirteen slot catalog and completed-prefix collaborators and retire the LineSpoolState activation without classic readers",
    "Keep the per-frame line system representation-only and the game-cycle output equal",
    "Preserve one hundred forty-one project modules, one hundred thirty-one active activations and two hundred bridges",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
