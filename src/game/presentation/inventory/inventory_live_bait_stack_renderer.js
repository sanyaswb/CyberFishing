// Spec 163 stage 2 (D4, D6): the left panel of a backpack live bait stack: every fish of the species as its thumbnail
// with a life scale without numbers (the shared resource meter, remaining-resource colours), «Назад» and «В садок».
// The numbers stay in the keepnet. The inventory's dynamic tick patches the scales in place.
export class InventoryLiveBaitStackRenderer {
  #dom;
  #meters;
  #labels;

  // resourceMeterRenderer: InventoryResourceMeterRenderer; labels: INVENTORY_LIVE_BAIT_STACK_LABELS.
  constructor({ domFactory, resourceMeterRenderer, labels }) {
    if (typeof resourceMeterRenderer?.create !== "function") {
      throw new TypeError("InventoryLiveBaitStackRenderer requires resourceMeterRenderer");
    }
    this.#dom = domFactory;
    this.#meters = resourceMeterRenderer;
    this.#labels = labels;
  }

  render(model, { onBack = null, onReturnToKeepnet = null } = {}) {
    const panel = this.#dom.element("section", "inventory-live-bait-stack inventory-panel inventory-panel--full-height");
    const heading = this.#dom.element("div", "inventory-live-bait-stack__heading");
    heading.append(
      this.#dom.element("h3", "inventory-live-bait-stack__title", model.name),
      this.#dom.element("p", "inventory-live-bait-stack__hint", this.#labels.count(model.count)),
    );
    const list = this.#dom.element("ul", "inventory-live-bait-stack__fish-list");
    for (const fish of model.fish) list.appendChild(this.#renderFish(fish));
    const actions = this.#dom.element("div", "inventory-live-bait-stack__actions");
    actions.append(
      this.#button(this.#labels.returnToKeepnet, "inventory-action--primary", () => onReturnToKeepnet?.(model.speciesId)),
      this.#button(this.#labels.back, "inventory-action--muted", () => onBack?.()),
    );
    panel.append(heading, list, actions);
    return panel;
  }

  // The 250 ms tick: only the scales change; a different set of fish is a full redraw (the signature).
  updateDynamicVisuals(host, model) {
    if (!model) return;
    const rows = new Map();
    this.#collectRows(host, rows);
    for (const fish of model.fish) {
      const meter = rows.get(fish.id);
      if (meter) this.#meters.updateReading(meter, this.#meterModel(fish));
    }
  }

  #renderFish(fish) {
    const row = this.#dom.element("li", "inventory-live-bait-stack__fish");
    row.dataset.fishId = fish.id;
    const thumbnail = this.#dom.element("span", "inventory-live-bait-stack__thumbnail");
    const image = this.#dom.image(fish.iconAsset, "");
    if (image) {
      image.className = "inventory-live-bait-stack__image";
      image.setAttribute("aria-hidden", "true");
      thumbnail.appendChild(image);
    }
    const meter = this.#meters.create(this.#meterModel(fish), { variant: "parameter", showIcon: false });
    meter.classList.add("inventory-live-bait-stack__meter");
    row.append(thumbnail, meter);
    return row;
  }

  #meterModel(fish) {
    const percent = Math.round(fish.lifeShare * 100);
    return { id: "life", percent, remainingPercent: percent, label: this.#labels.life(fish.name) };
  }

  #collectRows(node, rows) {
    for (const child of node?.children || []) {
      if (child.classList?.contains("inventory-live-bait-stack__fish")) {
        const meter = [...(child.children || [])].find((part) => part.classList?.contains("inventory-live-bait-stack__meter"));
        if (meter) rows.set(String(child.dataset.fishId || ""), meter);
      } else this.#collectRows(child, rows);
    }
  }

  #button(label, modifier, action) {
    const button = this.#dom.button(`inventory-live-bait-stack__button inventory-action ${modifier}`, label);
    button.addEventListener("click", action);
    return button;
  }
}

export const INVENTORY_LIVE_BAIT_STACK_LABELS = Object.freeze({
  back: "Назад",
  returnToKeepnet: "В садок",
  count: (count) => `Живців: ${count}`,
  // The meter's accessible name: the remaining life without a number on screen (the keepnet shows the time).
  life: (name) => `${name}: залишок життя`,
});
