import { inventorySlotIconAssets } from "../../game/presentation/inventory/inventory_slot_icons.js";

const PHASES = Object.freeze(["day", "evening", "night"]);

// The named sources of the asset load plan (spec 157 R15): asset ids that depend on the game's state at startup.
// resolve(state) gives the ids for this start; candidates() every id the source can give (the plan counts them as
// placed). state: { locationId, phases } (phases: the time-of-day phases the start needs, spec 157 R4).
export function createAssetLoadSources({ locations, itemDb }) {
  const locationOf = (id) => locations?.map?.[id] || {};
  const backgrounds = (location) => (location.backgroundAssets
    ? PHASES.map((phase) => [phase, location.backgroundAssets[phase]])
    : location.backgroundAsset ? [["default", location.backgroundAsset]] : []);
  const everyLocation = () => Object.values(locations?.map || {});
  const depthIcons = () => [...new Set([...Object.values(itemDb.floats || {}), ...Object.values(itemDb.baits || {})]
    .filter((item) => item.icon && item.iconAsset).map((item) => item.iconAsset))];
  return Object.freeze({
    "location.background.current": {
      resolve: ({ locationId, phases = null }) => backgrounds(locationOf(locationId))
        .filter(([phase]) => phases === null || phase === "default" || phases.includes(phase)).map(([, id]) => id),
      candidates: () => everyLocation().flatMap((location) => backgrounds(location).map(([, id]) => id)),
    },
    "location.background.others": {
      resolve: ({ locationId, phases = null }) => (phases === null ? [] : backgrounds(locationOf(locationId))
        .filter(([phase]) => phase !== "default" && !phases.includes(phase)).map(([, id]) => id)),
      candidates: () => everyLocation().flatMap((location) => backgrounds(location).map(([, id]) => id)),
    },
    "location.depthMap": {
      resolve: ({ locationId }) => [locationOf(locationId).depthAsset].filter(Boolean),
      candidates: () => everyLocation().map((location) => location.depthAsset).filter(Boolean),
    },
    "hud.depthIcons": { resolve: depthIcons, candidates: depthIcons },
    "inventory.slotIcons": { resolve: () => inventorySlotIconAssets(), candidates: () => inventorySlotIconAssets() },
  });
}
