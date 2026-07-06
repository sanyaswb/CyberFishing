/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.23.33";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "reel-hold-transition-probe",
  updatedAt: "2026-07-06",
  notes: Object.freeze([
    "Changed reel hold live diagnostics from interval polling to semantic transition logging",
    "Removed rodStrokeRatio drift from the live probe signature to prevent console spam",
    "Reset live probe signatures outside the playing state for clean fight sessions",
    "Kept reelHoldGate enabled for focused gameplay diagnostics",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
