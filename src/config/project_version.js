/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.19.35";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "radial-fish-fight-movement",
  updatedAt: "2026-06-10",
  notes: Object.freeze([
    "Fish behavior now produces radial and lateral line-space movement intent",
    "Fight direction is resolved into a world-space 2D vector",
    "Drag affects only outward radial movement",
    "Tangent, inward, and slack-line movement remain unrestricted by drag",
    "Fish direction and radial drag diagnostics are available in the overlay",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
