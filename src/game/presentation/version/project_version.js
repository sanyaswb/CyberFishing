/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
export const CURRENT_PROJECT_VERSION = "0.37.1";

export const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "screens-and-preloader",
  updatedAt: "2026-10-15",
  notes: Object.freeze([
    "Portrait inventory swipes chain through Equipment, Items, Backpack and Keepnet; the items panel continues the tabs' frame",
    "Hints have their own region at the top of their container and push the content down; every hint has a close button",
    "Equipment and Keepnet sections fill the phone screen again",
    "The House is a screen of the game page and its clock shows every game minute",
    "Raster art is WebP (49.9 MB to 5.9 MB) and the smart preloader foundation with an optional Spine runtime is in place",
  ]),
});

