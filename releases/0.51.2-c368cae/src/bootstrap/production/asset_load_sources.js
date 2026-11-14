import { HOUSE_CONFIG } from "../../game/config/raw/house/house_config.js";
import { inventorySlotIconAssets } from "../../game/presentation/inventory/inventory_slot_icons.js";
import { KEEPNET_ART_STAGES } from "../../game/presentation/keepnet/keepnet_art_config.js";
import { KeepnetFillImageResolver } from "../../game/presentation/keepnet/keepnet_fill_image_resolver.js";

const PHASES = Object.freeze(["day", "evening", "night"]);

// The named sources of the asset load plan (spec 157 R15): asset ids that depend on the game's state at startup.
// resolve(state) gives the ids for this start; candidates() every id the source can give (the plan counts them as
// placed). state: { locationId, phases, openedRoomLevel, keepnetPercent } (phases: the time-of-day phases the start needs,
// spec 157 R4; openedRoomLevel: RoomProgress.openedLevel, the first level when absent; keepnetPercent: the keepnet's fill
// when the first frame is drawn, empty when absent).
export function createAssetLoadSources({ locations, itemDb }) {
  const { backgroundAssets: roomLevels, initialLevel: firstRoomLevel } = HOUSE_CONFIG.room;
  const roomArtAbove = (level) => Object.entries(roomLevels).filter(([key]) => Number(key) > level)
    .flatMap(([, art]) => Object.values(art));
  const locationOf = (id) => locations?.map?.[id] || {};
  const backgrounds = (location) => (location.backgroundAssets
    ? PHASES.map((phase) => [phase, location.backgroundAssets[phase]])
    : location.backgroundAsset ? [["default", location.backgroundAsset]] : []);
  const everyLocation = () => Object.values(locations?.map || {});
  const depthIcons = () => [...new Set([...Object.values(itemDb.floats || {}), ...Object.values(itemDb.baits || {})]
    .filter((item) => item.icon && item.iconAsset).map((item) => item.iconAsset))];
  const keepnetArt = new KeepnetFillImageResolver({ stages: KEEPNET_ART_STAGES });
  const keepnetStages = () => KEEPNET_ART_STAGES.map((stage) => stage.imageAsset);
  const locationFiles = (location) => [...backgrounds(location).map(([, id]) => id), location.depthAsset].filter(Boolean);
  return Object.freeze({
    "location.elsewhere": {
      resolve: ({ locationId }) => Object.entries(locations?.map || {}).filter(([id]) => id !== locationId)
        .flatMap(([, location]) => locationFiles(location)),
      candidates: () => [],
    },
    // What game progress keeps closed (spec 159): room levels above the opened one; pressing upgrade opens the next
    // (owner, TK-216). Later the server will name the images to load.
    "progress.locked": {
      resolve: ({ openedRoomLevel = firstRoomLevel }) => roomArtAbove(openedRoomLevel),
      candidates: () => roomArtAbove(firstRoomLevel),
    },
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
    // The keepnet stage the player sees now (TK-219): a full keepnet after a cleared cache shows its own stage first.
    "keepnet.currentStage": { resolve: ({ keepnetPercent = 0 }) => [keepnetArt.resolve(keepnetPercent)], candidates: keepnetStages },
    "inventory.slotIcons": { resolve: () => inventorySlotIconAssets(), candidates: () => inventorySlotIconAssets() },
  });
}
