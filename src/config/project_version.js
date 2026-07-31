/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.23.45";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "inventory-one-click-equip",
  updatedAt: "2026-07-31",
  notes: Object.freeze([
    "Equipped items with one valid target slot on the first inventory click",
    "Kept two-click and explicit slot selection for items with multiple targets",
    "Highlighted only valid equipment targets",
    "Removed rejected item and slot highlighting from the inventory UI",
    "Allowed selected items to replace equipment in occupied valid slots",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
