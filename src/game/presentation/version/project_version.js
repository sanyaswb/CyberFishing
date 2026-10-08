/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
export const CURRENT_PROJECT_VERSION = "0.30.0";

export const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "clear-responsibilities",
  updatedAt: "2026-10-08",
  notes: Object.freeze([
    "Line capacity in item views follows the current equipment",
    "One class per module, named after its responsibility; inventory styles in one file",
    "Player-facing texts come from presentation catalogs; the architecture guard keeps them there",
  ]),
});

