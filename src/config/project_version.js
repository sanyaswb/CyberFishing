/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.22.2";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "rod-control-direction-single-source",
  updatedAt: "2026-06-21",
  notes: Object.freeze([
    "Removed legacy same-side Rod Control direction math from physics config",
    "Removed fish-driven Rod Control visual aim fields and debug bridge",
    "Split broad aligned threshold from exact centered-start threshold",
    "Exposed centered and center-start state from the Rod Control physics frame",
    "Added regressions that block near-center same-side control",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
