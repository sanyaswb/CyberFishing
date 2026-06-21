/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.22.5";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "fish-top-boundary-lateral-escape",
  updatedAt: "2026-06-21",
  notes: Object.freeze([
    "Added top-boundary lateral escape for fish stuck at the released-line radius",
    "Boosted weak tangent movement near the vertical-up boundary instead of preserving near-zero sideways drift",
    "Kept radial outward movement blocked while converting pressure into left/right motion",
    "Added balance config for top escape angle, tangent speed ratio, minimum speed and outward intent threshold",
    "Added regression coverage for weak top-boundary tangent escape",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
