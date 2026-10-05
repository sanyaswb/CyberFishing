/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
export const CURRENT_PROJECT_VERSION = "0.26.1";

export const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "stage-5-unused-code-cleanup",
  updatedAt: "2026-10-05",
  notes: Object.freeze([
    "Remove unused InventoryUI and fish profile helpers after closure",
    "Preserve native and classic DEV gameplay, inventory and save behavior",
  ]),
});

