/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.22.0";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "render-architecture-p2-contracts-diagnostics",
  updatedAt: "2026-06-18",
  notes: Object.freeze([
    "Added render layer dependency direction checks with cross-platform path normalization",
    "Strengthened hot-path allocation checks and runtime allocation diagnostics",
    "Validated required render and presentation contracts during composition",
    "Expanded asset lifecycle checks for location, fish sprite and Victory preload gates",
    "Strengthened reusable collection encapsulation and visual characterization gates",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
