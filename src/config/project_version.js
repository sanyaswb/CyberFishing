/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.81";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "casting-fishing-inventory-domain",
  updatedAt: "2026-10-01",
  notes: Object.freeze([
    "Migrate the cast distance calculator, fight direction resolver, rod pull calculator, player force and tackle stress systems and the inventory stacking policy",
    "Import eight completed-prefix collaborators and retire five activations without classic readers",
    "Keep the per-frame targets representation-only and the game-cycle output equal",
    "Preserve one hundred thirty-one project modules, one hundred twenty-four active activations and one hundred ninety-seven bridges",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
