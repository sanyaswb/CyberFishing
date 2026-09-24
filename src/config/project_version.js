/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.49";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "assemblies-domain",
  updatedAt: "2026-09-24",
  notes: Object.freeze([
    "Migrate two Assemblies classes to named game-domain ESM exports",
    "Preserve one cumulative graph with forty-four project modules and forty-five activations",
    "Complete frozen batch 012 with seventy-six exact classic-consumer bridge relationships",
    "Preserve attachment target and assembly completion behavior and class identity",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
