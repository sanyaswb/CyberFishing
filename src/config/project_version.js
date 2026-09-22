/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.46";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "fish-rarity-and-anomaly-domain",
  updatedAt: "2026-09-22",
  notes: Object.freeze([
    "Migrate FishRarityResolver and FishAnomalyVariantResolver to named game-domain ESM exports",
    "Preserve one cumulative graph with thirty-six project modules and thirty-seven activations",
    "Complete frozen batch 009 with sixty-two exact classic-consumer bridge relationships",
    "Preserve fish rarity and anomaly behavior, identity, timing and save semantics",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
