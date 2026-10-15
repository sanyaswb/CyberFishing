// Keepnet view (spec 088), the counterpart of the backpack view (spec 075): an image container with the help button,
// then a separate stats container with the capacity scale (fish icon, meter, occupancy centred on it) and the status
// line. Wide layouts show it in the keepnet section's left column; portrait shows a second instance as the keepnet
// pager's right page.
export class KeepnetOverviewRenderer {
  #dom;
  #labels;
  #scales;
  #imagePath;
  #capacityIcon;
  #bindings = new WeakMap();

  constructor({ domFactory, labels, scaleRenderer, imagePath, capacityIcon }) {
    this.#dom = domFactory;
    this.#labels = labels;
    this.#scales = scaleRenderer;
    this.#imagePath = imagePath;
    this.#capacityIcon = capacityIcon;
  }

  create({ className = "", onHelp }) {
    const view = this.#dom.element("section", `keepnet-overview ${className}`.trim());
    view.setAttribute("aria-label", this.#labels.title);
    const visual = this.#dom.element("div", "keepnet-overview__visual inventory-panel");
    const image = this.#dom.image(this.#imagePath, this.#labels.title);
    image.className = "keepnet-section__icon";
    const help = this.#dom.button("keepnet-section__help", "?");
    help.setAttribute("aria-label", this.#labels.help);
    help.setAttribute("aria-expanded", "false");
    help.setAttribute("aria-controls", "keepnet-help");
    help.addEventListener("click", onHelp);
    visual.append(image, help);
    const stats = this.#dom.element("div", "keepnet-overview__stats inventory-panel");
    const capacity = this.#scales.create({ iconHref: this.#capacityIcon, meterId: "keepnet-capacity",
      className: "keepnet-section__capacity" });
    const status = this.#dom.element("p", "keepnet-section__status");
    status.setAttribute("role", "status");
    status.hidden = true;
    stats.append(capacity, status);
    view.append(visual, stats);
    this.#bindings.set(view, { help, capacity, status });
    return view;
  }

  helpButton(view) {
    return this.#bindings.get(view).help;
  }

  // Occupied space fills the meter; its colour follows the free space like every remaining resource.
  update(view, { percent, value, label, status }) {
    const binding = this.#bindings.get(view);
    this.#scales.update(binding.capacity, { percent, remainingPercent: 100 - percent, value, label });
    if (binding.status.textContent !== status) binding.status.textContent = status;
    binding.status.hidden = !status;
  }
}
