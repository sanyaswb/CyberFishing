import { ITEM_DB as itemDatabase } from "../raw/items/item_database.js";
import { LIVE_BAIT_CONFIG } from "../raw/live_bait/live_bait_config.js";

export const ITEM_DB = Object.assign(itemDatabase, {
  aquariumFeeds: Object.fromEntries(Object.values(LIVE_BAIT_CONFIG.aquariumFeeds).map((item) => [item.id, {
    ...item, name: `Прикормка для акваріума · ${item.name}`, icon: "🐟", iconUrl: item.imagePath, variant: "aquarium_feed",
    rarityProfile: { mode: "authored", tier: { simple: 1, good: 2, premium: 3 }[item.quality], maxTier: 5, isUnique: false },
    progressionProfile: { groupId: "aquarium.feed" },
    gameplayStats: {}, displayStats: {},
  }])),
});
