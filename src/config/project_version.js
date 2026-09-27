/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.65";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "items-metric-registry-quality-rarity-domain",
  updatedAt: "2026-09-27",
  notes: Object.freeze([
    "Migrate the item metric strategy registry, the environmental, hook and net quality modifiers and the authored rarity strategy",
    "Import the grade policy, rarity descriptor and rarity strategy from their completed ESM owners",
    "Move three reviewed global exposures to the exact activation shims",
    "Retire the grade policy, rarity descriptor and rarity strategy activations as inert classic placeholders",
    "Preserve ninety-two project modules, ninety-seven activations and one hundred forty-four bridges",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
