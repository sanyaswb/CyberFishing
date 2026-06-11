/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.19.43";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "player-force-budget",
  updatedAt: "2026-06-11",
  notes: Object.freeze([
    "Added a shared PlayerForceBudgetAllocator for Rod Hold and Rod Control",
    "Rod Hold receives a resolved holdBudgetKg instead of owning the whole player reserve",
    "Rod Control receives a resolved controlBudgetKg and cannot exceed its player budget",
    "Combined tension ceiling is configurable and capped by maxCombinedMultiplier",
    "Hold+control and 0.05 kg full game-cycle scenarios remain catchable",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
