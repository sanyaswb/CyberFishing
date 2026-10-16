/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
export const CURRENT_PROJECT_VERSION = "0.38.0";

export const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "phone-item-editor",
  updatedAt: "2026-10-16",
  notes: Object.freeze([
    "On phones the item editor shows actions, a preview and one row of item and cell tabs joined to the active tab's parameters; swipes switch tabs",
    "A tap on a filled editor cell shows its parameters, a long press removes the item; only the editor's buttons leave it",
    "The keepnet is laid out like the backpack: the same filter rows, a fish capacity scale, Fish and Keepnet pages in portrait",
    "Card artwork is centred, equipment squares are larger, equipping flashes twice; only a fully equipped rod offers to be saved",
    "Portrait inventory swipes chain through Equipment, Items, Backpack and Keepnet",
  ]),
});

