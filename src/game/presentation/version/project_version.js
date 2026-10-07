/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
export const CURRENT_PROJECT_VERSION = "0.29.0";

export const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "stage-7-closed",
  updatedAt: "2026-10-08",
  notes: Object.freeze([
    "Split the inventory: PlayerInventory composed in bootstrap, UI state, player and gameplay commands, item removal",
    "Remove unwired EventLogger/backend, BuffManager and ExactItemSignaturePolicy; keep config validation and the reel retrieve diagnostic in DEV",
    "Drop the V2 marker from inventory names; the save key is unchanged",
  ]),
});

