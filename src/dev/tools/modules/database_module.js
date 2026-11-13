import { ConfigTreeRenderer } from "../config/config_tree_renderer.js";

// «БАЗА ДАНИХ» (spec 174 B3, moved from DevTools): the location, fish and item catalogs, edited in place.
export class DatabaseModule {
  #catalogs;

  // catalogs: { maps: MAP_DB, fishes: FISH_DB, items: ITEM_DB }
  constructor({ catalogs }) {
    this.#catalogs = catalogs;
  }

  mount(host, { createSection, tree }) {
    const database = createSection("БАЗА ДАНИХ", host, ["DATABASE"], { icon: "database" });
    const { maps, fishes, items } = this.#catalogs;
    const mapContent = createSection("БАЗА ЛОКАЦІЙ (MAP_DB)", database, ["MAP_DB"], { icon: "map" });
    for (const key of Object.keys(maps)) {
      const location = maps[key];
      tree.render(location, createSection(location?.id || location?.name || key, mapContent, ["MAP_DB", key]),
        ["MAP_DB", key]);
    }
    const fishContent = createSection("БАЗА РИБИ (FISH_DB)", database, ["FISH_DB"], { icon: "fish" });
    fishes.forEach((fish, index) => {
      tree.render(fish, createSection(fish?.id || fish?.name || `Fish [${index}]`, fishContent, ["FISH_DB", index]),
        ["FISH_DB", index]);
    });
    const itemContent = createSection("БАЗА ПРЕДМЕТІВ (ITEM_DB)", database, ["ITEM_DB"], { icon: "box" });
    for (const key of Object.keys(items)) {
      if (ConfigTreeRenderer.isExcludedKey(key)) continue;
      tree.render(items[key], createSection(key, itemContent, ["ITEM_DB", key]), ["ITEM_DB", key]);
    }
  }
}
