// Backpack view (spec 075): one container with the backpack image and a separate stats container below it with the
// capacity scale (carried items over the presentation maximum). Wide layouts show it in the backpack section's left
// column; portrait shows a second instance as the backpack pager's right page.
export class InventoryBackpackSummaryRenderer {
  #dom;
  #sections;
  #scales;
  #capacities = new WeakMap();

  constructor({ domFactory, sections, scaleRenderer }) {
    this.#dom = domFactory;
    this.#sections = sections;
    this.#scales = scaleRenderer;
  }

  create() {
    const view = this.#dom.element("section", "inventory-backpack");
    const visual = this.#dom.element("div", "inventory-backpack__visual inventory-panel");
    const image = this.#dom.image(this.#sections.backpackImage, "");
    image.className = "inventory-backpack__image";
    image.setAttribute("aria-hidden", "true");
    visual.appendChild(image);
    const stats = this.#dom.element("div", "inventory-backpack__stats inventory-panel");
    const capacity = this.#scales.create({ iconPath: this.#sections.backpackImage, meterId: "backpack-capacity",
      className: "inventory-backpack__capacity" });
    stats.appendChild(capacity);
    view.append(visual, stats);
    this.#capacities.set(view, capacity);
    return view;
  }

  update(view, itemCount) {
    const { maxItems } = this.#sections.backpackCapacity;
    this.#scales.update(this.#capacities.get(view), {
      percent: itemCount * 100 / maxItems,
      value: `${itemCount} / ${maxItems}`,
      label: this.#sections.labels.backpackItems(itemCount, maxItems),
    });
  }
}
