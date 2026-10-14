// Backpack section summary (spec 067): the backpack illustration fills the large cell of the shared unit-scaled
// container, with the number of carried items (view model sections.backpackItemCount). The item list stays in the
// right-hand inventory host.
export class InventoryBackpackSummaryRenderer {
  #dom;
  #sections;
  #counts = new WeakMap();

  constructor({ domFactory, sections }) {
    this.#dom = domFactory;
    this.#sections = sections;
  }

  create() {
    const shell = this.#dom.element("section", "inventory-loadout-shell");
    const panel = this.#dom.element("div", "inventory-loadout-panel inventory-panel");
    const primary = this.#dom.element("div", "inventory-loadout-panel__primary inventory-loadout-panel__primary--single");
    const cell = this.#dom.element("div", "inventory-backpack-summary");
    const image = this.#dom.image(this.#sections.backpackImage, "");
    image.className = "inventory-backpack-summary__image";
    image.setAttribute("aria-hidden", "true");
    const count = this.#dom.element("span", "inventory-backpack-summary__count");
    count.setAttribute("role", "status");
    cell.append(image, count);
    this.#counts.set(shell, count);
    primary.appendChild(cell);
    panel.appendChild(primary);
    shell.appendChild(panel);
    return shell;
  }

  update(shell, itemCount) {
    const count = this.#counts.get(shell);
    const text = this.#sections.labels.backpackItems(itemCount);
    if (count.textContent !== text) count.textContent = text;
  }
}
