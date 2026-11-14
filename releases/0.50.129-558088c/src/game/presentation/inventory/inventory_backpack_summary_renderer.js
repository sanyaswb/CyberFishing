// Backpack view (spec 075): one container with the backpack image and a separate stats container below it with the
// capacity scale (carried items over the presentation maximum). Wide layouts show it in the backpack section's left
// column; portrait shows a second instance as the backpack pager's right page.
export class InventoryBackpackSummaryRenderer {
  #dom;
  #sections;
  #scales;
  #capacities = new WeakMap();
  #full = new WeakMap();

  constructor({ domFactory, sections, scaleRenderer }) {
    this.#dom = domFactory;
    this.#sections = sections;
    this.#scales = scaleRenderer;
  }

  create() {
    const view = this.#dom.element("section", "inventory-backpack");
    const visual = this.#dom.element("div", "inventory-backpack__visual inventory-panel");
    const image = this.#dom.image(this.#sections.backpackAsset, "");
    image.className = "inventory-backpack__image";
    image.setAttribute("aria-hidden", "true");
    // Spec 164: a full backpack lays a translucent red over its skin: a layer masked by the same picture.
    const tint = this.#dom.element("span", "inventory-backpack__tint");
    tint.setAttribute("aria-hidden", "true");
    tint.style.setProperty("--inventory-backpack-mask", `url("${this.#dom.assetUrl(this.#sections.backpackAsset)}")`);
    visual.append(image, tint);
    const stats = this.#dom.element("div", "inventory-backpack__stats inventory-panel");
    const capacity = this.#scales.create({ iconAsset: this.#sections.backpackCapacityIconAsset, meterId: "backpack-capacity",
      className: "inventory-backpack__capacity" });
    stats.appendChild(capacity);
    view.append(visual, stats);
    this.#capacities.set(view, capacity);
    return view;
  }

  update(view, itemCount) {
    const { maxItems } = this.#sections.backpackCapacity;
    const full = itemCount >= maxItems;
    if (this.#full.get(view) !== full) {
      this.#full.set(view, full);
      view.classList.toggle("inventory-backpack--full", full);
    }
    const percent = (itemCount * 100) / maxItems;
    this.#scales.update(this.#capacities.get(view), {
      percent,
      remainingPercent: Math.max(0, 100 - percent),
      value: `${itemCount} / ${maxItems}`,
      label: this.#sections.labels.backpackItems(itemCount, maxItems),
    });
  }
}
