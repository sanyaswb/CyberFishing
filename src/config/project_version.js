/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.22.9";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "pole-sector-angle-constraint-cleanup",
  updatedAt: "2026-06-21",
  notes: Object.freeze([
    "Added a dedicated PoleFightSectorAngleConstraint for autonomous fish movement",
    "Kept PoleFightSectorConstraint as the radius-aware sector constraint for existing callers",
    "Moved fish movement integration to the named angle-only sector path",
    "Loaded the new angle constraint in runtime and VM regression harnesses",
    "Added architecture checks preventing inline generic radius-policy toggles in fish movement",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
