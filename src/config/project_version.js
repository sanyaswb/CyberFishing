/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.22.3";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "rod-control-anchor-mode",
  updatedAt: "2026-06-21",
  notes: Object.freeze([
    "Added Rod Control targetAnchorMode for current-base versus cast-base gameplay testing",
    "Captured an immutable cast-base rod anchor when a fight starts",
    "Resolved the Rod Control target anchor once in the fight physics pipeline",
    "Kept RodLateralControlSystem dependent only on an injected target point",
    "Added Rod Control UX regressions for cast-base and current-base anchors",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
