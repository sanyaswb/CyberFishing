/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.23.30";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "rod-stroke-reel-hold-separation",
  updatedAt: "2026-07-06",
  notes: Object.freeze([
    "Separated reel hold engagement from recoverable-line availability",
    "Kept auto rod stroke recovery speed independent from tension after the load gate passes",
    "Added stroke_line_desync diagnostics when rod stroke credit exists without recoverable line",
    "Added regression coverage for reel hold engagement and auto recovery source rules",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
