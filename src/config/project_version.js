/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.62";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "inventory-reservation-policy-domain",
  updatedAt: "2026-09-26",
  notes: Object.freeze([
    "Migrate the inventory reservation policy as a named game-domain ESM export",
    "Move its reviewed globalThis exposure to the exact activation shim",
    "Import InventoryItemLocation from its completed ESM owner",
    "Preserve eighty-three project modules, ninety-three activations and one hundred forty-two bridges",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
