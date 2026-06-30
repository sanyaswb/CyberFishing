/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.23.21";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "combined-pressure-gain",
  updatedAt: "2026-07-01",
  notes: Object.freeze([
    "Added Combined Rod Hold + Rod Control pressure gain before fatigue",
    "Kept Rod Control from reducing Rod Hold budget in the default player force allocation",
    "Exposed input combo gain in fight debug data and Fight Summary overlay",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
