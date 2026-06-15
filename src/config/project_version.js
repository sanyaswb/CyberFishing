/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.19.52";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "radial-sector-geometry",
  updatedAt: "2026-06-15",
  notes: Object.freeze([
    "Unified pole fight physics and rendering around one radial sector geometry frame",
    "Bound the red allowed sector and yellow unrestricted arc to the real line radius",
    "Applied the same angle-plus-radius area to fish AI, Rod Hold and Rod Control",
    "Added independent live visibility for the full fight line radius",
    "Added intersection, gradual recovery, 6 m pole and render-alignment regressions",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
