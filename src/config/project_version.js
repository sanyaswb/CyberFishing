/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.45";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "line-spool-stroke-distance-and-reel-hold",
  updatedAt: "2026-09-07",
  notes: Object.freeze([
    "Migrate LineSpoolState, RodStrokeDistanceTracker and ReelHoldLoadPolicy to named ESM exports",
    "Preserve one cumulative graph with thirty-four project modules and thirty-five activations",
    "Complete frozen batch 008 with sixty exact classic-consumer bridge relationships",
    "Preserve fishing formulas, mutable state identity, activation timing and save semantics",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
