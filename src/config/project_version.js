/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.23.37";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "player-reel-fatigue-debug-alignment",
  updatedAt: "2026-07-07",
  notes: Object.freeze([
    "Aligned Player Reel Fatigue HUD and debug fallback mode with reel_hold_session",
    "Added explicit ReelHold capability debug aliases",
    "Separated Player Reel Fatigue Session from ReelHold Pull Capability in overlays",
    "Added regression coverage for debug aliases and source consistency",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
