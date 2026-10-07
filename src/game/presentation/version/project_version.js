/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
export const CURRENT_PROJECT_VERSION = "0.27.2";

export const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "pre-stage-7-fixes",
  updatedAt: "2026-10-07",
  notes: Object.freeze([
    "Remove the per-frame LocationMap flag string while preserving recalculations and revisions",
    "Keep natural lure catches when Fixed Catch has no compatible sequence; disable production balance overrides",
    "Cancel every pending depth-selector frame on disposal",
  ]),
});

