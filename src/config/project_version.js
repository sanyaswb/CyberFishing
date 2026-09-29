/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.77";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "inventory-capacity-and-stamina-domain",
  updatedAt: "2026-09-29",
  notes: Object.freeze([
    "Migrate the inventory capacity policies",
    "Migrate the fight stamina controller",
    "Open the Stage 3.40.0 approved prefix",
    "Preserve one hundred sixteen project modules, one hundred five activations and one hundred sixty-eight bridges",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
