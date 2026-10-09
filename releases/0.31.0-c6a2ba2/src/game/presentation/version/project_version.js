/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
export const CURRENT_PROJECT_VERSION = "0.31.0";

export const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "lean-fight-frame",
  updatedAt: "2026-10-08",
  notes: Object.freeze([
    "Production fights build a reused fight frame instead of the DEV diagnostics snapshot; physics settings are normalized once per config revision",
    "Shared numeric normalization and other reused code replace 81 helper copies and several duplicated blocks",
    "Fixed Catch and the fight diagnostics are composed only in DEV; the game session moved from bootstrap to the application layer",
  ]),
});

