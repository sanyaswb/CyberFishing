/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.58";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "equipment-auto-refill-policy-domain",
  updatedAt: "2026-09-26",
  notes: Object.freeze([
    "Migrate two Equipment modules with six named game-domain ESM exports",
    "Preserve one cumulative graph with seventy-eight project modules and eighty-seven activations",
    "Complete the last frozen batch 021 with one hundred thirty-nine exact classic-consumer bridge relationships",
    "Preserve auto-refill triggers, scopes, settings, memory, policy and exact item signatures",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
