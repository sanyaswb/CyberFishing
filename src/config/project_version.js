/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.23.56";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "universal-item-rarity",
  updatedAt: "2026-08-06",
  notes: Object.freeze([
    "Add authored rarity profiles to every inventory item",
    "Resolve immutable rarity once when an inventory instance is created",
    "Share one visual palette between fish, items and Victory UI",
    "Keep rarity frames independent from inventory interaction states",
    "Validate item rarity during startup and production checks",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
