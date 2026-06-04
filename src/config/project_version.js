/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.19.23";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "tackle-stress-failure-system",
  updatedAt: "2026-06-04",
  notes: Object.freeze([
    "Reworked tackle overload into a stress-based failure system",
    "Stress tension now accumulates after main tension overload",
    "Added failure rolls every 500ms based on stress percentage",
    "Added weakest-component failure selection with leader, line, rod tie priority",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
