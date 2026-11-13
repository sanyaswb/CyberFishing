import { ConfigTreeRenderer } from "../config/config_tree_renderer.js";

const CATEGORY_LABELS = Object.freeze({
  rods: "🎣 Вудки",
  reels: "🧵 Котушки",
  lines: "🧶 Ліски",
  hooks: "🪝 Гачки",
  leaders: "🪢 Поводки",
  floats: "🥢 Поплавки",
  nets: "🕸️ Підсаки",
  misc: "☣️ Інше",
  baits: "🪱 Наживки та снасті",
  chums: "🍞 Прикормки для риболовлі",
  aquariumFeeds: "🐟 Прикормки для акваріума",
  deliveryMethods: "🚤 Доставка",
  batteries: "🔋 Живлення",
  devices: "📻 Пристрої",
  builds: "📦 Комплекти",
});

// «БЕЗКОШТОВНИЙ МАГАЗИН» (spec 174 B3, moved from DevTools): one button per catalog item adds it to the player's
// inventory, so catalog-only items can be tested in game.
export class ItemShopModule {
  #items;
  #grantCatalogItem;
  #assets;

  // items: ITEM_DB; grantCatalogItem(itemId, quantity) -> { success }; assets: the AssetRegistry (item art by id).
  constructor({ items, grantCatalogItem, assets = null }) {
    this.#items = items;
    this.#grantCatalogItem = grantCatalogItem;
    this.#assets = assets;
  }

  mount(host, { ui, createSection }) {
    const content = createSection("🎁 БЕЗКОШТОВНИЙ МАГАЗИН", host, ["ITEM_SHOP"], { buttonTitle: true });
    for (const category of Object.keys(this.#items)) {
      if (ConfigTreeRenderer.isExcludedKey(category)) continue;
      const section = createSection(CATEGORY_LABELS[category] || category, content);
      for (const [itemId, item] of Object.entries(this.#items[category] || {})) {
        if (!item?.itemType || item.devExclude) continue;
        const iconAsset = item.iconAsset || item.skin?.thumbnail?.asset || "";
        const iconUrl = iconAsset && this.#assets ? this.#assets.pathOf(iconAsset) : "";
        const label = `${item.name || itemId} · Безкоштовно`;
        let granted = 0;
        ui.createButtonRow(label, section, (event) => {
          const quantity = Math.max(1, Number(item.defaultQuantity || item.packSize) || 1);
          const result = this.#grantCatalogItem(itemId, quantity);
          if (result?.success) granted += 1;
          const labelNode = iconUrl ? event.currentTarget.querySelector(".devtools__action-label") : event.currentTarget;
          labelNode.innerText = result?.success ? `${label} ✓×${granted}` : `${label} ✗`;
        }, false, iconUrl);
      }
    }
  }
}
