/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.30";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "effective-item-rarity-read-model",
  updatedAt: "2026-08-18",
  notes: Object.freeze([
    "Restore authored rarity at the item read-model boundary after snapshot loading",
    "Keep authored rarity out of canonical instance snapshots",
    "Use the effective rarity descriptor for Inventory V2 visuals, filters and sorting",
    "Sort inventory by rarity descending by default with stable ties",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
