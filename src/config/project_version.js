/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - use `node utils/set-project-version.js <version> [label]` to update this file.
 */
const CURRENT_PROJECT_VERSION = "0.23.18";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "phase-recovery",
  updatedAt: "2026-07-01",
  notes: Object.freeze([
    "Added EXHAUSTION to STAMINA rollback on slack line or sustained low effective pressure",
    "Added smooth ENDURANCE recovery in STAMINA phase after full stamina recovery",
    "Preserved current ENDURANCE when returning from phase 2 back to phase 1",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
