/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.68";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "items-hook-power-rarity-resolver-domain",
  updatedAt: "2026-09-27",
  notes: Object.freeze([
    "Migrate the hook power policy and the item rarity resolver",
    "Import the hook quality modifier and the authored rarity strategy from batch 027",
    "Move the reviewed global exposure of HookPowerPolicy to the exact activation shim",
    "Retire the hook quality modifier activation as an inert classic placeholder",
    "Preserve ninety-seven project modules, ninety-seven activations and one hundred forty bridges",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
