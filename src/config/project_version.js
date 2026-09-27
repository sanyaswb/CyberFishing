/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.66";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "assemblies-item-assembly-service-domain",
  updatedAt: "2026-09-27",
  notes: Object.freeze([
    "Migrate the item assembly service and its domain error",
    "Import the assembly reader and stacking policy from earlier batches of this continuation",
    "Keep the owner-created default collaborators as proven Domain compositions",
    "Preserve ninety-three project modules, ninety-eight activations and one hundred forty-one bridges",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
