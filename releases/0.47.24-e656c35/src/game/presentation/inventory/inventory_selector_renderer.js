const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export class InventorySelectorRenderer {
  #dom;
  #geometries;
  #geometry = null;
  #compact = null;
  #isCompact = false;
  #placement = "";
  #open = false;
  #candidate = -1;
  #enabled = false;
  #equipmentFallback;
  #equipmentArt;
  #equipmentImage;
  #paths = [];

  // `geometries` holds one InventorySelectorGeometry per layout: `corner` for wide toolbars; toolbars up to 820
  // logical px use the configured compact one (`half`/`arc` centred, `corner`/`corner-left` in a bottom corner).
  constructor({ domFactory, geometries, compactLayout = "half", sections, labels, keepnetImage, id }) {
    this.#dom = domFactory;
    this.#geometries = geometries;
    this.element = this.#dom.element("div", "inventory-selector");
    // The wide toolbar reserves the corner fan's footprint.
    this.element.style.setProperty("--inventory-selector-retention-radius", String(geometries.corner.retentionRadius));
    this.element.hidden = true;
    this.retention = this.#dom.element("div", "inventory-selector__retention");
    this.retention.setAttribute("aria-hidden", "true");
    this.group = this.#dom.element("div", "inventory-selector__sections");
    this.group.id = id;
    this.group.setAttribute("role", "group");
    this.group.setAttribute("aria-label", labels.sections);
    this.buttons = sections.items.map(section => {
      const button = this.#dom.button("inventory-selector__section", "");
      button.setAttribute("aria-label", section.label);
      button.dataset.sectionId = section.id;
      const svg = this.#svg("svg");
      svg.setAttribute("class", "inventory-selector__shape");
      svg.setAttribute("aria-hidden", "true");
      const path = this.#svg("path"); svg.appendChild(path);
      this.#paths.push({ svg, path });
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
    this.central.setAttribute("aria-label", labels.inventory);
    this.central.setAttribute("aria-controls", id);
    this.central.setAttribute("aria-expanded", "false");
    this.central.appendChild(this.#dom.svgIcon(`${sections.iconSprite}#inventory`, "inventory-selector__icon"));
    this.group.setAttribute("aria-hidden", "true");
    this.group.inert = true;
    const stage = this.#dom.element("div", "inventory-selector__stage");
    stage.append(this.retention, this.group, this.central);
    this.element.appendChild(stage);
    this.setCompactLayout(compactLayout);
    this.setCompactPlacement("center", "right");
    this.#apply(geometries.corner);
  }

  get expanded() { return this.#open; }
  get enabled() { return this.#enabled; }
  get layout() { return this.#geometry.layout; }
  get compact() { return this.#isCompact; }
  // The fan centre as a share of the central button's box.
  get origin() { return this.#geometry.origin; }

  // The compact fan chosen in configuration; its extent sizes the compact toolbar slot.
  setCompactLayout(layout) {
    const geometry = this.#geometries[layout];
    if (!geometry || geometry === this.#compact) return;
    this.#compact = geometry;
    this.element.style.setProperty("--inventory-selector-compact-width", String(geometry.extent.width));
    this.element.style.setProperty("--inventory-selector-compact-height", String(geometry.extent.height));
    if (this.#isCompact) this.#apply(geometry);
  }

  // Where the compact toolbar places the selector (center, right, left) and its action column (right, left).
  setCompactPlacement(placement, actionsSide) {
    const key = `${placement} ${actionsSide}`;
    if (key === this.#placement) return;
    const [previousPlacement, previousSide] = this.#placement.split(" ");
    if (previousPlacement) {
      this.element.classList.remove(`inventory-selector--slot-${previousPlacement}`);
      this.element.classList.remove(`inventory-selector--actions-${previousSide}`);
    }
    this.#placement = key;
    this.element.classList.add(`inventory-selector--slot-${placement}`);
    this.element.classList.add(`inventory-selector--actions-${actionsSide}`);
  }

  // The toolbar slot decides between the wide corner fan and the compact fan. Returns true when the geometry changed.
  setCompact(compact) {
    this.#isCompact = compact;
    return this.#apply(compact ? this.#compact : this.#geometries.corner);
  }

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
    const { box, sectors } = this.#geometry, shift = sectors[index].shift;
    return `${shift.x * progress / (box.maxX - box.minX) * 100}% ${shift.y * progress / (box.maxY - box.minY) * 100}%`;
  }
  dispose() { this.setEnabled(false); this.element.remove(); }

  // Layout geometry in central-button units; the stylesheet multiplies them by the drawing unit.
  #apply(geometry) {
    if (geometry === this.#geometry) return false;
    if (this.#geometry) this.element.classList.remove(`inventory-selector--${this.#geometry.layout}`);
    this.#geometry = geometry;
    this.element.classList.add(`inventory-selector--${geometry.layout}`);
    const { box, retentionBox, origin, central } = geometry;
    const width = box.maxX - box.minX, height = box.maxY - box.minY;
    const percent = (value, size) => `${value / size * 100}%`;
    const root = this.element.style;
    root.setProperty("--inventory-selector-box-left", String(origin.x + box.minX));
    root.setProperty("--inventory-selector-box-top", String(origin.y + box.minY));
    root.setProperty("--inventory-selector-box-width", String(width));
    root.setProperty("--inventory-selector-box-height", String(height));
    root.setProperty("--inventory-selector-fan-origin", `${percent(-box.minX, width)} ${percent(-box.minY, height)}`);
    root.setProperty("--inventory-selector-art-width", percent(geometry.radius / 4, width));
    root.setProperty("--inventory-selector-art-height", percent(geometry.radius / 4, height));
    root.setProperty("--inventory-selector-retention-left", String(origin.x + retentionBox.minX));
    root.setProperty("--inventory-selector-retention-top", String(origin.y + retentionBox.minY));
    root.setProperty("--inventory-selector-retention-width", String(retentionBox.maxX - retentionBox.minX));
    root.setProperty("--inventory-selector-retention-height", String(retentionBox.maxY - retentionBox.minY));
    root.setProperty("--inventory-selector-retention-clip", geometry.retention.clip);
    const centralWidth = central.box.maxX - central.box.minX, centralHeight = central.box.maxY - central.box.minY;
    this.central.style.setProperty("--inventory-selector-central-art-x", percent(central.center.x - central.box.minX, centralWidth));
    this.central.style.setProperty("--inventory-selector-central-art-y", percent(central.center.y - central.box.minY, centralHeight));
    this.buttons.forEach((button, index) => {
      const shape = geometry.sectors[index], { svg, path } = this.#paths[index];
      button.style.setProperty("--inventory-selector-clip", shape.clip);
      button.style.setProperty("--inventory-selector-shift-x", percent(shape.shift.x, width));
      button.style.setProperty("--inventory-selector-shift-y", percent(shape.shift.y, height));
      button.style.setProperty("--inventory-selector-art-x", percent(shape.center.x - box.minX, width));
      button.style.setProperty("--inventory-selector-art-y", percent(shape.center.y - box.minY, height));
      button.style.setProperty("--inventory-selector-travel-x", percent(-shape.center.x * 0.65, width));
      button.style.setProperty("--inventory-selector-travel-y", percent(-shape.center.y * 0.65, height));
      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      path.setAttribute("d", shape.path);
    });
    return true;
  }

  #svg(tag) { return this.#dom.document.createElementNS(SVG_NAMESPACE, tag); }
}
