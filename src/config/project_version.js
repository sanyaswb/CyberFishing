/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.23.34";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "reel-hold-post-stroke-state",
  updatedAt: "2026-07-06",
  notes: Object.freeze([
    "Moved rod stroke distance recording before reel hold recovery checks",
    "Made reel hold use the post-stroke rod state from the current frame",
    "Added a small strokeRatioTolerance precision guard for reel hold gating",
    "Added debug fields and regression coverage for reel hold input-vs-final stroke ratios",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
