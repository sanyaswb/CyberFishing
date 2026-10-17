/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
export const CURRENT_PROJECT_VERSION = "0.38.7";

export const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "inventory-artwork",
  updatedAt: "2026-10-17",
  notes: Object.freeze([
    "Portrait editor cells list compatible items inline; landscape and desktop highlight them in the item list beside the editor",
    "Landing-net miniatures and the toolbar net show the upper 40%, the editor shows the whole net; rod condition sits under the rod",
    "The backpack backdrop is restored and toolbar artwork stays inside its button",
    "The day float uses optimized WebP artwork in inventory cards, equipment, editor tabs and the DEV free shop",
    "The basic landing net uses optimized WebP artwork in the inventory, equipment, DEV free shop and HUD",
    "Perch artwork and fish thumbnails use WebP; backpack artwork is available as a catalog item in the DEV free shop",
    "Keepnet artwork follows occupied capacity in six preloaded stages without reloading unchanged images",
    "The open backpack is a faint background centred in the item panel in landscape and portrait",
    "Editor tabs show centred artwork without scales; a tap on a tab scrolls the editor down to the tabs",
    "On phones the item editor shows actions, a preview and one row of item and cell tabs joined to the active tab's parameters; swipes switch tabs",
    "A tap on a filled editor cell shows its parameters, a long press removes the item; only the editor's buttons leave it",
    "The keepnet is laid out like the backpack: the same filter rows, a fish capacity scale, Fish and Keepnet pages in portrait",
    "Card artwork is centred, equipment squares are larger, equipping flashes twice; only a fully equipped rod offers to be saved",
    "Portrait inventory swipes chain through Equipment, Items, Backpack and Keepnet",
  ]),
});

