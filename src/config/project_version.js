/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.70";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "items-effective-rarity-resolver-domain",
  updatedAt: "2026-09-27",
  notes: Object.freeze([
    "Migrate the effective item rarity resolver",
    "Import the item rarity resolver from batch 030",
    "Move the reviewed global exposure of EffectiveItemRarityResolver to the exact activation shim",
    "Complete the Stage 3.22 approved continuation prefix",
    "Preserve ninety-nine project modules, ninety-six activations and one hundred thirty-nine bridges",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
