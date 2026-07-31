/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.23.40";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "build-aware-line-reconciliation",
  updatedAt: "2026-07-16",
  notes: Object.freeze([
    "Centralized equipment unequip lifecycle handling in InventoryManager",
    "Returned detached line segments after rod, reel, build-switch and compatibility cascades",
    "Added build-aware source spool and fallback matching",
    "Preserved real equipped-line losses during segment reconciliation",
    "Committed batch equipment operations with one save and one inventory event",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
