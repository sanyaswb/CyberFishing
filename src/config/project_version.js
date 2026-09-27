/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.71";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "assemblies-assembly-state-repository-domain",
  updatedAt: "2026-09-27",
  notes: Object.freeze([
    "Adopt the Stage 3.34.0 review-queue freeze extension (batches 033 and 034)",
    "Migrate the assembly state repository",
    "Prove the authoritative #states Map with the atomic local replacement rule",
    "Import AssemblyState and AssemblyPreparationStatus from the completed prefix",
    "Retire the AssemblyState and AssemblyPreparationStatus activations as inert classic placeholders",
    "Preserve one hundred project modules, ninety-five activations and one hundred forty bridges",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
