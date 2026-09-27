/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.64";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "inventory-assembly-stacking-policy-domain",
  updatedAt: "2026-09-27",
  notes: Object.freeze([
    "Migrate the item assembly stacking policy",
    "Keep its private static ignored-key Set as a reviewed class-definition effect",
    "Import InventoryItemLocation from its completed ESM owner",
    "Preserve eighty-seven project modules, ninety-five activations and one hundred forty-three bridges",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
