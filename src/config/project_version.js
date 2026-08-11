/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.15";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "inventory-v2-stable-sorting",
  updatedAt: "2026-08-11",
  notes: Object.freeze([
    "Keep a placement source stationary while compatible cells remain empty",
    "Sort inventory by type, rarity, level or power in either direction",
    "Filter inventory by one or more rarity tiers",
    "Reuse rarity colours and configured gameplay parameter paths",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
