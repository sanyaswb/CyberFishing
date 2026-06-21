/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.22.6";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "fish-line-radius-projection",
  updatedAt: "2026-06-21",
  notes: Object.freeze([
    "Replaced top-boundary lateral escape with projection-based line-radius movement",
    "Removed only forbidden radial-outward fish velocity at the locked released-line radius",
    "Preserved existing tangent and inward fish movement without artificial boost",
    "Removed fishBoundarySteering.topEscape balance config and metadata",
    "Added debug and regression coverage for raw versus allowed fish velocity",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
