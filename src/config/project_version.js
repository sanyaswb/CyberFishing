/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.44";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "fishing-domain-state-and-motion",
  updatedAt: "2026-09-04",
  notes: Object.freeze([
    "Migrate six fishing state, motion and force primitives to named game-domain ESM exports",
    "Extend the single cumulative runtime from twenty-five to thirty-one project modules",
    "Preserve six exact activation positions and nine classic consumer relationships",
    "Normalize assembled equipment children before gameplay without changing fishing formulas",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
