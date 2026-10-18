/**
 * Single source of truth for the project version shown in UI, checks and tools.
 *
 * Patch rule:
 * - every delivered patch must update CURRENT_PROJECT_VERSION;
 * - keep this file and CHANGELOG.md in sync for every delivered patch.
 */
export const CURRENT_PROJECT_VERSION = "0.41.7";

export const PROJECT_VERSION_CONFIG = Object.freeze({
  id: "cyber-fishing",
  name: "CyberFishing",
  version: CURRENT_PROJECT_VERSION,
  label: `v${CURRENT_PROJECT_VERSION}`,
  channel: "prototype",
  codename: "metric-zone-editor",
  updatedAt: "2026-10-18",
  notes: Object.freeze([
    "DEV zone editor shows exact metre grid and all zone geometry, hides the background to black, edits runtime geometry and caches WebGL annotations",
    "World sizes and ground-plane areas follow the same water metric as movement; camera scale applies once, the rod stays screen-relative",
    "Idle tackle obeys the depth-adjusted line budget after current, bite and live-bait motion; inward retrieval remains available",
    "The bait boat keeps its speed in metres everywhere on the water: far away it moves fewer pixels per second, like the tackle",
    "A long-press re-cast aims like the first cast: the rod, line and tackle hide until the new cast lands",
    "The world is drawn on a WebGL scene (PixiJS): background, rippling water that drifts with the current, boats, fight areas, line, float and the Spine rod",
    "DEV starts without a saved game; obsolete debug builds are removed and startup failures are reported in the console",
    "Post-cast rod motion is x3 through slack and x1 once the line draws the tackle; visible line tightening starts at the same boundary",
    "Moving the rod toward the fish compensates tension in free alignment mode; pre-bite lateral motion tightens the line and tilts the float",
    "Cast rods move across configurable green-zone ranges; rod motion reacts to bite windows and moving floats reduce non-spinning bite chance",
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

