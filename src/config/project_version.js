/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.41";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "reel-auto-recovery-esm",
  updatedAt: "2026-08-23",
  notes: Object.freeze([
    "Migrate ReelAutoRecoveryCalculator to a named game-domain ESM export",
    "Extend the single cumulative runtime from ten to eleven project modules",
    "Preserve exact logical-position-113 exposure and ReelSystem integration",
    "Keep recovery formulas, epsilon gates, clamps and result semantics unchanged",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
