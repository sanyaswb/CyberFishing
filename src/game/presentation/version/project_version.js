/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
export const CURRENT_PROJECT_VERSION = "0.34.1";

export const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "live-bait-aquarium",
  updatedAt: "2026-10-12",
  notes: Object.freeze([
    "All species up to 100 g can become individual live bait with a real-time lifetime and half-speed swim on one hook",
    "The separate keepnet shows catches and live bait; the fisherman's house offers an aquarium with shared quality-based feed and persistent random starvation deadlines",
    "Aquarium, upgrades, feed and automatic feeder currently cost nothing and persist locally",
  ]),
});

