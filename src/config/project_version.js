/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.23.29";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "rod-stroke-source-cleanup",
  updatedAt: "2026-07-06",
  notes: Object.freeze([
    "Made reel hold depend only on factual rodStrokeRatio for full-stroke gating",
    "Removed legacy Y, pump credit and slack aliases from rod stroke gameplay/debug paths",
    "Removed old rod stroke capacity and charge config fallbacks",
    "Added regression coverage for rod stroke and reel hold source-of-truth rules",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
