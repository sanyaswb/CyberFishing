/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.88";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "fish-tackle-inventory-repository-world-domain",
  updatedAt: "2026-10-01",
  notes: Object.freeze([
    "Adopt the Stage 3.50.1 freeze extension with its hot-loop equivalence evidence",
    "Migrate the fish entities, tackle entities, flat inventory repository, buff manager, rod pull system and location world",
    "Keep every per-frame target representation-only and the game-cycle output equal",
    "Preserve one hundred forty-eight project modules, one hundred thirty-six active activations and one hundred ninety-nine bridges",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
