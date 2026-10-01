/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.83";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "equipment-state-loadout-domain",
  updatedAt: "2026-10-01",
  notes: Object.freeze([
    "Migrate the equipment root state and the equipment loadout with its persisted default name",
    "Import the main and auxiliary slot ids from the equipment slot catalog and retire the auxiliary activation from the shared catalog shim",
    "Preserve one hundred thirty-four project modules, one hundred twenty-six active activations and two hundred one bridges",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
