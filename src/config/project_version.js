/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.23.28";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "touch-hold-threshold-preserved",
  updatedAt: "2026-07-06",
  notes: Object.freeze([
    "Preserved pullHoldMinMs for touch Rod Hold while keeping simultaneous lateral control support",
    "Added pointerHoldActive as the explicit InputManager source of truth for touch hold",
    "Prevented raw pointerDown from being interpreted as Rod Hold by fight input composition",
    "Added regression coverage for early touch input before the hold threshold",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
