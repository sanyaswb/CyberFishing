/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.24.25";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "optional-item-metric-capabilities",
  updatedAt: "2026-08-15",
  notes: Object.freeze([
    "Resolve rating, quality, condition, capacity and freshness only when configured",
    "Remove global automatic progression levels and support optional ratingTier",
    "Keep upgradeLevel independent from rating segmentation",
    "Expose only gameplay-backed metric capabilities in production profiles",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
