/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.19.33";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "drag-aware-rod-control-tension",
  updatedAt: "2026-06-06",
  notes: Object.freeze([
    "Rod Control X now respects remaining drag tension reserve",
    "Lateral tension multipliers are included in the drag-aware force limit",
    "Successful drag slip uses visible tension as the tackle stress source",
    "Locked drag and hard line limits still allow overload stress",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
