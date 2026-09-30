/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.78";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "casting-items-line-rules-domain",
  updatedAt: "2026-09-30",
  notes: Object.freeze([
    "Adopt the Stage 3.41.0 replacement prefix",
    "Migrate gameplay rules, distance conversion, item metric composition, capacity and rating, and line allocation",
    "Use the Engine normalizeDistance owner and completed-prefix ItemMetricStrategy through reviewed imports",
    "Preserve one hundred twenty-three project modules, one hundred sixteen active activations and one hundred seventy-six bridges",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
