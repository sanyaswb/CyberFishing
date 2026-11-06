// Keepnet view (spec 088), the counterpart of the backpack view (spec 075): an image container (optional help button),
// then a separate stats container with the capacity scale (fish icon, meter, occupancy centred on it) and the status
// line. Wide layouts show it in the keepnet section's left column; portrait shows a second instance as the keepnet
// pager's right page. showHelp places the help button on the image; the game hides it for now (spec 089) and keeps
// the button and its hint as a component. TK-226: showFish() puts one fish's full art in the image container in place of
// the keepnet (the wide layout's summary), and showFish(view, null) brings the keepnet back.
export class KeepnetOverviewRenderer {
  #dom;
  #labels;
  #scales;
  #imageResolver;
  #capacityIcon;
  #showHelp;
  #fishArt;
  #bindings = new WeakMap();

  // fishArt: FishArtVariants (the fish's 768 px display image for the preview).
  constructor({ domFactory, labels, scaleRenderer, imageResolver, capacityIcon, fishArt, showHelp = true }) {
    if (typeof fishArt?.displayPath !== "function") throw new TypeError("KeepnetOverviewRenderer requires fishArt");
    this.#fishArt = fishArt;
    this.#dom = domFactory;
    this.#labels = labels;
    this.#scales = scaleRenderer;
    this.#imageResolver = imageResolver;
    this.#capacityIcon = capacityIcon;
    this.#showHelp = showHelp;
  }

  create({ className = "", onHelp }) {
    const view = this.#dom.element("section", `keepnet-overview ${className}`.trim());
    view.setAttribute("aria-label", this.#labels.title);
    const visual = this.#dom.element("div", "keepnet-overview__visual inventory-panel");
    const imageAsset = this.#imageResolver.resolve(0);
    const image = this.#dom.image(imageAsset, this.#labels.title);
    image.className = "keepnet-section__icon";
    visual.appendChild(image);
    const help = this.#showHelp ? this.#helpButton(onHelp) : null;
    if (help) visual.appendChild(help);
    const stats = this.#dom.element("div", "keepnet-overview__stats inventory-panel");
    const capacity = this.#scales.create({ iconAsset: this.#capacityIcon.asset, iconSymbol: this.#capacityIcon.symbol,
      meterId: "keepnet-capacity",
      className: "keepnet-section__capacity" });
    const status = this.#dom.element("p", "keepnet-section__status");
    status.setAttribute("role", "status");
    status.hidden = true;
    stats.append(capacity, status);
    view.append(visual, stats);
    this.#bindings.set(view, { visual, image, imageAsset, help, capacity, status, fish: null, fishId: null });
    return view;
  }

  // The view's help button, or null while help is hidden.
  helpButton(view) {
    return this.#bindings.get(view).help;
  }

  #helpButton(onHelp) {
    const help = this.#dom.button("keepnet-section__help", "?");
    help.setAttribute("aria-label", this.#labels.help);
    help.setAttribute("aria-expanded", "false");
    help.setAttribute("aria-controls", "keepnet-help");
    help.addEventListener("click", onHelp);
    return help;
  }

  // The fish's full art in place of the keepnet ({ id, name, imagePath }), or the keepnet again with null.
  showFish(view, fish) {
    const binding = this.#bindings.get(view);
    const id = fish?.id ?? null;
    if (binding.fishId === id) return;
    binding.fishId = id;
    binding.image.hidden = id !== null;
    if (id === null) { binding.fish?.remove(); binding.fish = null; return; }
    const image = this.#dom.element("img", "keepnet-overview__fish");
    image.alt = fish.name; image.decoding = "async"; image.draggable = false;
    image.src = this.#fishArt.displayPath(fish.imagePath);
    if (binding.fish) binding.fish.replaceWith(image);
    else binding.visual.insertBefore(image, binding.image);
    binding.fish = image;
  }

  // Occupied space fills the meter; its colour follows the free space like every remaining resource.
  update(view, { percent, value, label, status }) {
    const binding = this.#bindings.get(view);
    const imageAsset = this.#imageResolver.resolve(percent);
    if (binding.imageAsset !== imageAsset) {
      binding.image.src = this.#dom.assetUrl(imageAsset);
      binding.imageAsset = imageAsset;
    }
    this.#scales.update(binding.capacity, { percent, remainingPercent: 100 - percent, value, label });
    if (binding.status.textContent !== status) binding.status.textContent = status;
    binding.status.hidden = !status;
  }
}
