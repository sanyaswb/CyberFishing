/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.18.1";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "overlay-devtools-links",
  updatedAt: "2026-05-25",
  notes: Object.freeze([
    "Modular fish database categories",
    "Reusable fish physics profile presets",
    "Runtime config override store for DevTools",
    "Immutable base CONFIG snapshot",
    "Overlay rows can jump to related DevTools parameters",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
