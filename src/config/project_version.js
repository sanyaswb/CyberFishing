/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
const CURRENT_PROJECT_VERSION = "0.23.48";

const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "rarity-domain-hardening",
  updatedAt: "2026-07-31",
  notes: Object.freeze([
    "Restricted unique fish state to explicit 12/12 rarity profiles",
    "Moved anomaly rules out of visual configuration",
    "Centralized rarity colors and normalized level gradients",
    "Removed inaccurate Victory-side rarity recalculation",
    "Added rarity schema and integration regression coverage",
  ]),
});

if (typeof window !== "undefined") {
  window.CYBER_FISHING_PROJECT_VERSION = PROJECT_VERSION_CONFIG;
}
