export class InventorySelectorRenderer {
  #dom;
  #geometry;
  #open = false;
  #candidate = -1;
  #enabled = false;
  #equipmentFallback;
  #equipmentArt;
  #equipmentImage;

  constructor({ domFactory, geometry, sections, labels, keepnetImage, id }) {
    this.#dom = domFactory;
    this.#geometry = geometry;
    this.element = this.#dom.element("div", "inventory-selector");
    this.element.style.setProperty("--inventory-selector-radius", String(geometry.radius));
    this.element.style.setProperty("--inventory-selector-retention-radius", String(geometry.retentionRadius));
    this.element.style.setProperty("--inventory-selector-retention-padding", String(geometry.retentionPadding));
    this.element.style.setProperty("--inventory-selector-retention-clip", geometry.retention.clip);
    this.element.hidden = true;
    this.retention = this.#dom.element("div", "inventory-selector__retention");
    this.retention.setAttribute("aria-hidden", "true");
    this.group = this.#dom.element("div", "inventory-selector__sections");
    this.group.id = id;
    this.group.setAttribute("role", "group");
    this.group.setAttribute("aria-label", labels.sections);
    this.buttons = sections.items.map((section, index) => {
      const shape = geometry.sectors[index];
      const button = this.#dom.button("inventory-selector__section", "");
      button.setAttribute("aria-label", section.label);
      button.dataset.sectionId = section.id;
      button.style.setProperty("--inventory-selector-clip", shape.clip);
      button.style.setProperty("--inventory-selector-shift-x", `${shape.shift.x / geometry.radius * 100}%`);
      button.style.setProperty("--inventory-selector-shift-y", `${shape.shift.y / geometry.radius * 100}%`);
      button.style.setProperty("--inventory-selector-art-x", `${(shape.center.x + geometry.radius) / geometry.radius * 100}%`);
      button.style.setProperty("--inventory-selector-art-y", `${(shape.center.y + geometry.radius) / geometry.radius * 100}%`);
      button.style.setProperty("--inventory-selector-travel-x", `${-shape.center.x * 0.65 / geometry.radius * 100}%`);
      button.style.setProperty("--inventory-selector-travel-y", `${-shape.center.y * 0.65 / geometry.radius * 100}%`);
      const svg = this.#svg("svg");
      svg.setAttribute("class", "inventory-selector__shape");
      svg.setAttribute("viewBox", `0 0 ${geometry.radius} ${geometry.radius}`);
      svg.setAttribute("aria-hidden", "true");
      const path = this.#svg("path"); path.setAttribute("d", shape.path); svg.appendChild(path);
      const image = section.id === "equipment" ? this.#dom.svgIcon(`${sections.iconSprite}#${section.icon}`, "inventory-selector__art")
        : this.#dom.image(section.id === "backpack" ? sections.backpackImage : keepnetImage, "");
      image.classList.add("inventory-selector__art");
      image.setAttribute("aria-hidden", "true");
      button.append(svg, image);
      if (section.id === "equipment") {
        this.#equipmentFallback = image;
        this.#equipmentArt = this.#dom.element("span", "game-toolbar-button__art inventory-selector__art");
        this.#equipmentArt.hidden = true;
        this.#equipmentArt.setAttribute("aria-hidden", "true");
        this.#equipmentImage = this.#dom.element("img", "game-toolbar-button__image");
        this.#equipmentImage.alt = "";
        this.#equipmentImage.draggable = false;
        this.#equipmentArt.appendChild(this.#equipmentImage);
        button.appendChild(this.#equipmentArt);
      }
      button.tabIndex = -1;
      this.group.appendChild(button);
      return button;
    });
    this.central = this.#dom.button("game-toolbar-button inventory-selector__central", "");
    this.central.style.setProperty("--inventory-selector-central-art-x", `${(geometry.central.center.x + geometry.centralRadius) / geometry.centralRadius * 100}%`);
    this.central.style.setProperty("--inventory-selector-central-art-y", `${(geometry.central.center.y + geometry.centralRadius) / geometry.centralRadius * 100}%`);
    this.central.setAttribute("aria-label", labels.inventory);
    this.central.setAttribute("aria-controls", id);
    this.central.setAttribute("aria-expanded", "false");
    this.central.appendChild(this.#dom.svgIcon(`${sections.iconSprite}#inventory`, "inventory-selector__icon"));
    this.group.setAttribute("aria-hidden", "true");
    this.group.inert = true;
    const stage = this.#dom.element("div", "inventory-selector__stage");
    stage.append(this.retention, this.group, this.central);
    this.element.appendChild(stage);
  }

  get expanded() { return this.#open; }
  get enabled() { return this.#enabled; }

  setEquipmentArtwork(thumbnail) {
    const src = this.#dom.safeImageSource(thumbnail?.src);
    if (src) this.#equipmentFallback.setAttribute("hidden", "");
    else this.#equipmentFallback.removeAttribute("hidden");
    this.#equipmentArt.hidden = !src;
    if (!src) return;
    if (this.#equipmentImage.getAttribute("src") !== src) this.#equipmentImage.setAttribute("src", src);
    this.#equipmentArt.style.setProperty("--game-toolbar-art-visible-height", String(thumbnail.visibleHeight || 1));
    this.#equipmentArt.style.setProperty("--game-toolbar-art-focus-x", String(thumbnail.focusX ?? 0.5));
    this.#equipmentArt.classList.toggle("game-toolbar-button__art--cropped-top", thumbnail.anchor === "top");
  }

  setEnabled(enabled) {
    this.#enabled = enabled;
    this.element.hidden = !enabled;
    if (!enabled) this.setExpanded(false);
  }

  setSizeScales(closed, open) {
    const largest = Math.max(closed, open);
    this.element.style.setProperty("--inventory-selector-scale", String(largest));
    this.element.style.setProperty("--inventory-selector-closed-scale", String(closed / largest));
    this.element.style.setProperty("--inventory-selector-open-scale", String(open / largest));
  }

  setExpanded(open) {
    open = Boolean(open && this.#enabled);
    if (this.#open === open) return;
    this.#open = open;
    this.element.classList.toggle("inventory-selector--open", open);
    this.central.setAttribute("aria-expanded", String(open));
    this.group.setAttribute("aria-hidden", String(!open));
    this.group.inert = !open;
    for (const button of this.buttons) button.tabIndex = open ? 0 : -1;
    if (!open) this.highlight(-1);
  }

  highlight(index) {
    if (index === this.#candidate) return;
    if (this.#candidate >= 0) this.buttons[this.#candidate].classList.remove("inventory-selector__section--highlighted");
    this.#candidate = index;
    if (index >= 0) this.buttons[index].classList.add("inventory-selector__section--highlighted");
  }

  sectionId(index) { return this.buttons[index]?.dataset.sectionId; }
  containsRetention(x, y) { return this.#geometry.contains(x, y); }
  hitTest(x, y, offsets = null) { return this.#geometry.hitTest(x, y, offsets); }
  motionTranslation(index, progress) {
    const shift = this.#geometry.sectors[index].shift;
    return `${shift.x * progress / this.#geometry.radius * 100}% ${shift.y * progress / this.#geometry.radius * 100}%`;
  }
  dispose() { this.setEnabled(false); this.element.remove(); }
  #svg(tag) { return this.#dom.document.createElementNS("http://www.w3.org/2000/svg", tag); }
}
