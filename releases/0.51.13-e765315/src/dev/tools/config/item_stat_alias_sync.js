// Keeps an item's two descriptions of the same stat equal after a DevTools edit of ITEM_DB (spec 174 B2, moved from
// DevTools): ITEM_DB.<category>.<id>.displayStats.<field> and .gameplayStats.<key> name one value (level, power,
// distance; for rods also the first two display stats by position).
export class ItemStatAliasSync {
  #items;

  // items: ITEM_DB (the catalog edited in place).
  constructor({ items }) {
    this.#items = items;
  }

  afterEdit(path, value) {
    if (path[0] !== "ITEM_DB" || path.length < 5) return;
    const [, category, itemId, group, field] = path;
    const item = this.#items?.[category]?.[itemId];
    if (!item || typeof item !== "object") return;
    if (group === "displayStats") {
      const gameplayKey = ItemStatAliasSync.#gameplayKeyOf(item, category, field, value);
      if (!gameplayKey) return;
      item.gameplayStats = item.gameplayStats || {};
      item.gameplayStats[gameplayKey] = value;
      return;
    }
    if (group === "gameplayStats") {
      const displayKey = ItemStatAliasSync.#displayKeyOf(item, field);
      if (displayKey) item.displayStats[displayKey] = value;
    }
  }

  static #gameplayKeyOf(item, category, field, value) {
    const key = String(field).toLowerCase();
    if (key === "level") return "equipmentPowerLevel";
    if (key === "power" || key === "basepower" || key === "strength") return "basePower";
    if (key === "maxdistance" || key === "distance") return "maxDistance";
    if (category !== "rods") return null;
    const index = Object.keys(item.displayStats || {}).indexOf(field);
    if (index === 0 && Number.isFinite(Number(value))) return "equipmentPowerLevel";
    if (index === 1 && Number.isFinite(Number(value))) return "basePower";
    return null;
  }

  static #displayKeyOf(item, field) {
    const displayStats = item.displayStats;
    if (!displayStats || typeof displayStats !== "object") return null;
    for (const key of Object.keys(displayStats)) {
      if (ItemStatAliasSync.#gameplayKeyOf(item, "rods", key, displayStats[key]) === field) return key;
    }
    const has = (key) => Object.prototype.hasOwnProperty.call(displayStats, key);
    if (field === "equipmentPowerLevel" && has("level")) return "level";
    if (field === "basePower" && has("power")) return "power";
    if (field === "maxDistance" && has("distance")) return "distance";
    return null;
  }
}
