/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.57";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "assemblies-refill-signature-state-domain",
  updatedAt: "2026-09-25",
  notes: Object.freeze([
    "Migrate three Assemblies modules with four named game-domain ESM exports",
    "Preserve one cumulative graph with seventy-six project modules and eighty-one activations",
    "Complete frozen batch 020 with one hundred thirty-five exact classic-consumer bridge relationships",
    "Preserve refill signatures, assembly preparation state and refill signature memory",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
