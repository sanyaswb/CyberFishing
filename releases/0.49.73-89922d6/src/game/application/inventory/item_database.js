import { DisplayStatsResolver } from "./display_stats_resolver.js";

export class ItemDatabase {
  #db;
  #categoryMap;

  constructor(db) {
    this.#db = db;
    this.#categoryMap = new Map();
    this.#buildCategoryMap();
  }

  #buildCategoryMap() {
    this.#categoryMap.clear();
    for (const [category, items] of Object.entries(this.#db)) {
      if (category === "builds") continue;
      for (const itemId of Object.keys(items)) {
        this.#categoryMap.set(itemId, category);
      }
    }
  }

  refresh() {
    this.#buildCategoryMap();
  }

  getItemData(itemId) {
    if (!itemId) return null;
    const category = this.#categoryMap.get(itemId);
    if (!category) return null;

    const item = this.#db[category][itemId];
    if (!item) return null;

    const { gameplayStats = {}, displayStats = {}, ...metadata } = item;
    return {
      ...metadata,
      variant: item.variant || null,
      displayStats: DisplayStatsResolver.resolve(item),
      displayStatsSchema: displayStats,
      gameplayStats: { ...gameplayStats },
    };
  }
}
