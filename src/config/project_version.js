/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.19.22";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "player-pull-motion-smoothing",
  updatedAt: "2026-06-04",
  notes: Object.freeze([
    "Player-applied fish movement now eases in and out through one smoothing layer",
    "Added configurable inertia for Rod Hold and Rod Control fish movement",
    "Rod Control lateral tension now follows the actually applied smoothed movement",
    "Added player pull motion debug metrics and focused regression checks",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
