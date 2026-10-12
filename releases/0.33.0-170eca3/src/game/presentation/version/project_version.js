/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
export const CURRENT_PROJECT_VERSION = "0.33.0";

export const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "live-bait-aquarium",
  updatedAt: "2026-10-11",
  notes: Object.freeze([
    "Small crucian catches can become individual live bait with a real-time lifetime and half-speed swim on one hook",
    "The separate keepnet shows catches and live bait; the fisherman's house offers an aquarium with species feed slots",
    "Aquarium, upgrades, feed and automatic feeder currently cost nothing and persist locally",
  ]),
});

