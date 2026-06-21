/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.22.7";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "line-radius-projection-integration",
  updatedAt: "2026-06-21",
  notes: Object.freeze([
    "Fixed LineRadialMovementSplitter reading projected velocityX and velocityY frames",
    "Preserved resolver-projected tangent movement through the full fish movement pipeline",
    "Added regression coverage for resolver to radial-splitter integration",
    "Kept projection behavior unchanged for pure outward, lateral and inward movement",
    "Closed the P0 integration gap from the v0.22.6 projection patch",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
