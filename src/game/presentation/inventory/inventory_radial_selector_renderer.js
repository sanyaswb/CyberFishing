import {
  calculateRadialSelectorGeometry,
  RADIAL_SECTOR_IDS,
} from "./inventory_radial_selector_geometry.js";
import { INVENTORY_RADIAL_SELECTOR_LABELS } from "./inventory_radial_selector_labels.js";

/**
 * Presentation renderer for the radial inventory selector (TK-008.2, TK-008.5).
 * Owns DOM/SVG construction and visual state representation (open/closed, highlights, icons).
 */
export class InventoryRadialSelectorRenderer {
  #dom;
  #labels;
  #geometry;
  #imageResolver;
  #backpackImage;
  #root;
  #trigger;
  #fan;
  #keepOpen;
  #sectorButtons = new Map();
  #sectorBgPaths = new Map();
  #keepnetIcon = null;
  #isOpen = false;
  #isOpening = false;
  #isReady = false;
  #highlightedSectionId = null;
  #openTimer = null;
  #disposed = false;

  constructor({
    domFactory,
    labels = INVENTORY_RADIAL_SELECTOR_LABELS,
    geometry = null,
    imageResolver = null,
    backpackImage = "assets/items/misc/backpack.webp",
  } = {}) {
    if (!domFactory) {
      throw new TypeError("InventoryRadialSelectorRenderer requires domFactory");
    }
    this.#dom = domFactory;
    this.#labels = labels;
    this.#geometry = geometry || calculateRadialSelectorGeometry();
    this.#imageResolver = imageResolver;
    this.#backpackImage = backpackImage;

    this.#build();
  }

  get element() {
    return this.#root;
  }

  get triggerElement() {
    return this.#trigger;
  }

  get fanElement() {
    return this.#fan;
  }

  get keepOpenElement() {
    return this.#keepOpen;
  }

  get isOpen() {
    return this.#isOpen;
  }

  get isReady() {
    return this.#isOpen && this.#isReady;
  }

  get geometry() {
    return this.#geometry;
  }

  get highlightedSectionId() {
    return this.#highlightedSectionId;
  }

  getSectorButton(sectionId) {
    return this.#sectorButtons.get(sectionId) || null;
  }

  /**
   * Sets the open/closed state of the radial fan.
   * @param {boolean} open
   * @param {object} options
   */
  setOpen(open, { animated = true } = {}) {
    if (this.#disposed) return;
    const nextOpen = Boolean(open);
    if (this.#isOpen === nextOpen && !this.#isOpening) return;

    this.#isOpen = nextOpen;
    this.#trigger.setAttribute("aria-expanded", String(nextOpen));
    this.#trigger.title = nextOpen ? this.#labels.triggerClose : this.#labels.triggerTitle;

    if (this.#openTimer) {
      this.#dom.view?.clearTimeout?.(this.#openTimer);
      this.#openTimer = null;
    }

    if (nextOpen) {
      this.#root.classList.add("inventory-radial-selector--open");
      this.#root.classList.remove("inventory-radial-selector--closing");
      this.#fan.removeAttribute("aria-hidden");

      // Enable tab focus on sectors
      for (const btn of this.#sectorButtons.values()) {
        btn.setAttribute("tabindex", "0");
      }

      if (animated && this.#dom.view?.setTimeout) {
        this.#isOpening = true;
        this.#isReady = false;
        this.#root.classList.add("inventory-radial-selector--opening");
        // Fast transition settle (200ms)
        this.#openTimer = this.#dom.view.setTimeout(() => {
          this.#isOpening = false;
          this.#isReady = true;
          this.#root.classList.remove("inventory-radial-selector--opening");
          this.#openTimer = null;
        }, 200);
      } else {
        this.#isOpening = false;
        this.#isReady = true;
      }
    } else {
      this.#root.classList.remove("inventory-radial-selector--open");
      this.#root.classList.remove("inventory-radial-selector--opening");
      this.#fan.setAttribute("aria-hidden", "true");
      this.setHighlightedSector(null);
      this.#isOpening = false;
      this.#isReady = false;

      // Disable tab focus on hidden sectors
      for (const btn of this.#sectorButtons.values()) {
        btn.setAttribute("tabindex", "-1");
      }
    }
  }

  /**
   * Highlights or clears candidate sector visual state.
   * @param {string|null} sectionId
   */
  setHighlightedSector(sectionId) {
    if (this.#disposed) return;
    const targetId = sectionId && RADIAL_SECTOR_IDS.includes(sectionId) ? sectionId : null;
    if (this.#highlightedSectionId === targetId) return;

    if (this.#highlightedSectionId) {
      const prev = this.#sectorButtons.get(this.#highlightedSectionId);
      prev?.classList.remove("inventory-radial-selector__sector--highlighted");
    }

    this.#highlightedSectionId = targetId;

    if (targetId) {
      const next = this.#sectorButtons.get(targetId);
      next?.classList.add("inventory-radial-selector__sector--highlighted");
    }
  }

  /**
   * Updates keepnet icon stage image if capacity changed.
   * @param {number|string} stageOrRatio
   */
  updateKeepnetArt(stageOrRatio) {
    if (!this.#keepnetIcon) return;
    let imageSrc = "";
    if (typeof stageOrRatio === "string" && stageOrRatio) {
      imageSrc = stageOrRatio;
    } else if (this.#imageResolver && typeof stageOrRatio === "number") {
      imageSrc = this.#imageResolver.resolve(stageOrRatio);
    }
    if (imageSrc && this.#keepnetIcon.src !== imageSrc) {
      this.#keepnetIcon.src = imageSrc;
    }
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    if (this.#openTimer) {
      this.#dom.view?.clearTimeout?.(this.#openTimer);
      this.#openTimer = null;
    }
    this.#sectorButtons.clear();
    this.#sectorBgPaths.clear();
    this.#keepnetIcon = null;
    this.#root?.remove();
    this.#root = null;
  }

  #build() {
    const geo = this.#geometry;
    const doc = this.#dom.document;

    // Root container
    this.#root = this.#dom.element("div", "inventory-radial-selector");
    this.#root.setAttribute("data-inventory-selector", "radial");

    // Central quarter-circle trigger button
    this.#trigger = this.#dom.button("inventory-radial-selector__trigger", "", {
      title: this.#labels.triggerTitle,
    });
    this.#trigger.setAttribute("aria-label", this.#labels.trigger);
    this.#trigger.setAttribute("aria-haspopup", "true");
    this.#trigger.setAttribute("aria-expanded", "false");

    // Trigger SVG quarter-circle shape
    const triggerSvg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    triggerSvg.setAttribute("class", "inventory-radial-selector__trigger-svg");
    triggerSvg.setAttribute("viewBox", `0 0 ${geo.r0} ${geo.r0}`);

    const triggerBg = doc.createElementNS("http://www.w3.org/2000/svg", "path");
    triggerBg.setAttribute("class", "inventory-radial-selector__trigger-bg");
    // Local path with bottom-right at (r0, r0)
    triggerBg.setAttribute("d", `M ${geo.r0} ${geo.r0} L 0 ${geo.r0} A ${geo.r0} ${geo.r0} 0 0 1 ${geo.r0} 0 Z`);
    triggerSvg.appendChild(triggerBg);

    // Trigger icon (vector SVG items symbol)
    const triggerIconSvg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    triggerIconSvg.setAttribute("class", "inventory-radial-selector__trigger-icon");
    triggerIconSvg.setAttribute("viewBox", "0 0 24 24");
    triggerIconSvg.setAttribute("aria-hidden", "true");
    const triggerUse = doc.createElementNS("http://www.w3.org/2000/svg", "use");
    triggerUse.setAttribute("href", "assets/ui/inventory-sections.svg#items");
    triggerIconSvg.appendChild(triggerUse);

    this.#trigger.appendChild(triggerSvg);
    this.#trigger.appendChild(triggerIconSvg);
    this.#root.appendChild(this.#trigger);

    // Fan overlay container
    this.#fan = this.#dom.element("div", "inventory-radial-selector__fan");
    this.#fan.setAttribute("role", "group");
    this.#fan.setAttribute("aria-label", this.#labels.triggerTitle);
    this.#fan.setAttribute("aria-hidden", "true");

    // Fan SVG backdrop
    const fanSvg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    fanSvg.setAttribute("class", "inventory-radial-selector__svg");
    fanSvg.setAttribute("viewBox", `0 0 ${geo.viewportSize} ${geo.viewportSize}`);

    // Transparent keep-open area path
    this.#keepOpen = doc.createElementNS("http://www.w3.org/2000/svg", "path");
    this.#keepOpen.setAttribute("class", "inventory-radial-selector__keep-open");
    this.#keepOpen.setAttribute("d", geo.keepOpenPath);
    this.#keepOpen.setAttribute("pointer-events", "auto");
    fanSvg.appendChild(this.#keepOpen);

    // Render sector SVG backgrounds
    for (const sector of geo.sectors) {
      const sectorPath = doc.createElementNS("http://www.w3.org/2000/svg", "path");
      sectorPath.setAttribute("class", "inventory-radial-selector__sector-bg");
      sectorPath.setAttribute("d", sector.pathData);
      fanSvg.appendChild(sectorPath);
      this.#sectorBgPaths.set(sector.id, sectorPath);
    }
    this.#fan.appendChild(fanSvg);

    // Render interactive sector buttons and artwork
    for (const sector of geo.sectors) {
      const labelText = this.#labels[sector.id] || sector.id;
      const btn = this.#dom.button(
        `inventory-radial-selector__sector inventory-radial-selector__sector--${sector.id}`,
        "",
        { title: labelText },
      );
      btn.setAttribute("aria-label", labelText);
      btn.setAttribute("data-section-id", sector.id);
      btn.setAttribute("tabindex", "-1");

      // Content container positioned at center of sector
      const content = this.#dom.element("div", "inventory-radial-selector__sector-content");
      content.style.left = `${sector.center.x}px`;
      content.style.top = `${sector.center.y}px`;
      content.style.transform = `translate(-50%, -50%) rotate(${sector.iconRotationDeg.toFixed(1)}deg)`;

      // Artwork
      if (sector.id === "equipment") {
        const svgIcon = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgIcon.setAttribute("class", "inventory-radial-selector__sector-icon");
        svgIcon.setAttribute("viewBox", "0 0 24 24");
        svgIcon.setAttribute("aria-hidden", "true");
        const useEl = doc.createElementNS("http://www.w3.org/2000/svg", "use");
        useEl.setAttribute("href", "assets/ui/inventory-sections.svg#equipment");
        svgIcon.appendChild(useEl);
        content.appendChild(svgIcon);
      } else if (sector.id === "backpack") {
        const img = this.#dom.image(this.#backpackImage, "");
        img.className = "inventory-radial-selector__sector-icon";
        img.setAttribute("aria-hidden", "true");
        content.appendChild(img);
      } else if (sector.id === "keepnet") {
        const initialKeepnetSrc = this.#imageResolver
          ? this.#imageResolver.resolve(0)
          : "assets/items/equipment/keepnet/keepnet--0.webp";
        this.#keepnetIcon = this.#dom.image(initialKeepnetSrc, "");
        this.#keepnetIcon.className = "inventory-radial-selector__sector-icon";
        this.#keepnetIcon.setAttribute("aria-hidden", "true");
        content.appendChild(this.#keepnetIcon);
      }

      btn.appendChild(content);
      this.#fan.appendChild(btn);
      this.#sectorButtons.set(sector.id, btn);
    }

    this.#root.appendChild(this.#fan);
  }
}
