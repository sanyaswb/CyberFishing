/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
export const CURRENT_PROJECT_VERSION = "0.36.0";

export const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "inventory-sections",
  updatedAt: "2026-10-15",
  notes: Object.freeze([
    "The inventory has Equipment, Backpack and Keepnet sections, a full-screen portrait layout and one sidebar container on wide screens",
    "An empty cell, craft socket or header circle picks from the backpack with highlighted items; a waiting bait or chum applies at the first header press",
    "Header bait and chum pills show every hook slot, manual and automatic counts, and a 100kg load scale",
    "Portrait backpack swipes between items and the backpack view with a 0/100 capacity scale; lists scroll by drag without selecting cards",
    "The bamboo rod has its first painted skin, with and without the equipped line",
  ]),
});

