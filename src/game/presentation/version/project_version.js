/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
export const CURRENT_PROJECT_VERSION = "0.32.1";

export const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "inventory-equipment-ux",
  updatedAt: "2026-10-11",
  notes: Object.freeze([
    "Inventory cards keep square equipment compartments, equal spacing and minimal resource meters inside their bounds",
    "Rod replacement opens a preview; removing an unsaved equipped rod offers saving or disassembling its components",
    "Saved loadout members share a color, return intact when unequipped and disassemble only through a long press",
  ]),
});

