/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.23.1";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "landing-shoreline-offset-removal",
  updatedAt: "2026-06-24",
  notes: Object.freeze([
    "Removed the obsolete landing shoreline offset configuration and runtime plumbing",
    "Made shore landing distance use bounds.bottom directly as the shoreline",
    "Updated landing area rendering and empty tackle landing checks to use the same shoreline",
    "Removed stale test and diagnostic context fields for catch-line offset",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
