/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.23.36";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "player-reel-fatigue-session-latch",
  updatedAt: "2026-07-07",
  notes: Object.freeze([
    "Added Player Reel Fatigue Session as a latch separate from reel hold pull capability",
    "Changed fatigue source mode to reel_hold_session so temporary blockers do not restart grace",
    "Added session and reel hold can-pull debug fields",
    "Added regression coverage for stroke, drag, load blocker and release behavior",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
