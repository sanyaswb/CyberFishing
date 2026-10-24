import { UiCatalogBlockCrop } from "./ui_catalog_block_crop.js";

// The catalog (spec 140 Revision 3): group tabs and viewport triggers in the header; the open group's elements in a
// grid, each alone in its own centred row under a one-line bar (name, state, three-step value). Opening another tab
// disposes the elements and removes them from the markup. Every surface lays out at the chosen viewport size and the
// whole preview is scaled down when that size is wider than the page.
export class UiCatalogPage {
  #document;
  #window;
  #mount;
  #tabsNode;
  #viewportsNode;
  #groups;
  #definitions;
  #viewports;
  #labels;
  #createSurface;
  #createExample;
  #onSelect;
  #tabs = new Map();
  #viewportButtons = new Map();
  #items = [];
  #activeGroupId = null;
  #viewport;
  #scale = NaN;
  #generation = 0;
  #ready = Promise.resolve();
  #scaleFrame = null;
  #removals = [];
  #disposed = false;
  #returnLink;
  #onReturnClick = null;
  constructor({ documentRef, windowTarget, mountNode, tabsNode = null, viewportsNode = null, groups = [], definitions,
    viewports = [{ width: 320, height: 640 }], labels = {}, createSurface, createExample, returnLink = null,
    onReturn = null, onSelect = () => {} }) {
    this.#document = documentRef;
    this.#window = windowTarget;
    this.#mount = mountNode;
    this.#tabsNode = tabsNode;
    this.#viewportsNode = viewportsNode;
    this.#groups = groups;
    this.#definitions = definitions;
    this.#viewports = viewports;
    this.#viewport = viewports[0];
    this.#labels = labels;
    this.#createSurface = createSurface;
    this.#createExample = createExample;
    this.#onSelect = onSelect;
    if (returnLink && typeof onReturn === "function") {
      this.#returnLink = returnLink;
      this.#onReturnClick = event => { event.preventDefault(); onReturn(); };
      returnLink.addEventListener("click", this.#onReturnClick);
    }
  }
  get activeGroupId() { return this.#activeGroupId; }
  get viewport() { return this.#viewport; }
  get scale() { return this.#scale; }
  // selection: "group" or "group/width" from the URL; unknown parts open the first group and viewport.
  async mount(selection = "") {
    for (const group of this.#groups) {
      const tab = this.#button("ui-catalog__tab", group.name, () => { void this.select(group.id); });
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", "false");
      this.#tabsNode?.append(tab);
      this.#tabs.set(group.id, tab);
    }
    for (const viewport of this.#viewports) {
      const button = this.#button("ui-catalog__viewport", String(viewport.width), () => this.setViewport(viewport.width));
      button.setAttribute("aria-pressed", "false");
      this.#viewportsNode?.append(button);
      this.#viewportButtons.set(viewport.width, button);
    }
    const onResize = () => this.#requestScale();
    this.#window?.addEventListener?.("resize", onResize);
    this.#removals.push(() => this.#window?.removeEventListener?.("resize", onResize));
    const [groupId, width] = String(selection).split("/");
    this.#applyViewport(this.#viewports.find((viewport) => String(viewport.width) === width) ?? this.#viewports[0]);
    const group = this.#tabs.has(groupId) ? groupId : this.#groups[0]?.id;
    if (group) await this.select(group);
  }
  // Opens a group: the previous group's elements are disposed and removed, this group's are created in order.
  select(groupId) {
    if (this.#disposed || !this.#tabs.has(groupId)) return this.#ready;
    if (groupId === this.#activeGroupId) return this.#ready;
    this.#activeGroupId = groupId;
    for (const [id, tab] of this.#tabs) {
      tab.classList.toggle("ui-catalog__tab--active", id === groupId);
      tab.setAttribute("aria-selected", String(id === groupId));
    }
    this.#disposeItems();
    this.#notify();
    const generation = ++this.#generation;
    this.#ready = (async () => {
      for (const definition of this.#definitions) {
        if (generation !== this.#generation) return;
        if (definition.group === groupId) await this.#mountItem(definition, generation);
      }
    })();
    return this.#ready;
  }
  setViewport(width) {
    const viewport = this.#viewports.find((entry) => entry.width === width);
    if (this.#disposed || !viewport || viewport === this.#viewport) return;
    this.#applyViewport(viewport);
    for (const item of this.#items) { item.surface.requestMeasure(); item.crop.request(); }
    this.#notify();
  }
  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#generation += 1;
    this.#returnLink?.removeEventListener("click", this.#onReturnClick);
    this.#returnLink = null;
    this.#onReturnClick = null;
    if (this.#scaleFrame !== null) this.#window.cancelAnimationFrame(this.#scaleFrame);
    this.#scaleFrame = null;
    for (const remove of this.#removals) remove();
    this.#removals = [];
    this.#disposeItems();
    this.#mount.replaceChildren();
    this.#tabsNode?.replaceChildren();
    this.#viewportsNode?.replaceChildren();
  }
  #applyViewport(viewport) {
    this.#viewport = viewport;
    this.#mount.style.setProperty("--ui-catalog-width", `${viewport.width}px`);
    this.#mount.style.setProperty("--ui-catalog-height", `${viewport.height}px`);
    for (const [width, button] of this.#viewportButtons) {
      button.classList.toggle("ui-catalog__viewport--active", width === viewport.width);
      button.setAttribute("aria-pressed", String(width === viewport.width));
    }
    this.#updateScale();
  }
  // The preview shrinks to the page width; written only when it changes.
  #updateScale() {
    const available = Number(this.#mount.clientWidth) || 0;
    const scale = available > 0 ? Math.min(1, available / this.#viewport.width) : 1;
    if (scale === this.#scale) return;
    this.#scale = scale;
    this.#mount.style.setProperty("--ui-catalog-scale", String(scale));
    for (const item of this.#items) item.crop.request();
  }
  #requestScale() {
    if (this.#disposed || this.#scaleFrame !== null) return;
    this.#scaleFrame = this.#window.requestAnimationFrame(() => {
      this.#scaleFrame = null;
      this.#updateScale();
    });
  }
  #notify() {
    if (this.#activeGroupId) this.#onSelect(this.#activeGroupId, this.#viewport.width);
  }
  #disposeItems() {
    for (const item of this.#items.splice(0).reverse()) item.dispose();
  }
  async #mountItem(definition, generation) {
    const node = this.#element("article", "ui-catalog-item");
    node.id = definition.id;
    node.dataset.catalogFamilies = definition.families.join(" ");
    const bar = this.#element("div", "ui-catalog-item__bar");
    const title = this.#element("h2", "ui-catalog-item__title", definition.name);
    title.title = definition.description;
    const state = this.#element("select", "ui-catalog-item__select");
    state.setAttribute("aria-label", this.#labels.stateLabel ?? "");
    for (const [value, text] of definition.states) {
      const option = this.#element("option", "", text); option.value = value; state.append(option);
    }
    bar.append(title, state);
    const reading = definition.reading ? this.#reading(definition.reading) : null;
    if (reading) bar.append(reading.range, reading.output);
    const view = this.#element("div", "ui-catalog-item__view");
    const stage = this.#element("div", "ui-catalog-item__stage");
    view.append(stage);
    const status = this.#element("p", "ui-catalog-item__status");
    status.setAttribute("role", "status");
    node.append(bar, view, status);
    this.#mount.append(node);
    const surface = this.#createSurface(stage);
    const crop = new UiCatalogBlockCrop({ view, stage, contentRoot: surface.mountRoot, selector: definition.focus ?? null,
      windowTarget: this.#window, getScale: () => this.#scale });
    let example = null;
    const unsubscribe = surface.subscribe((metrics) => { example?.resize?.(metrics); crop.request(); });
    const removals = [];
    const listen = (target, type, callback) => {
      target.addEventListener(type, callback);
      removals.push(() => target.removeEventListener(type, callback));
    };
    let disposed = false;
    const item = { surface, crop, dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const remove of removals) remove();
      unsubscribe();
      crop.dispose();
      example?.dispose();
      example = null;
      surface.dispose();
      node.remove();
    } };
    this.#items.push(item);
    try {
      const created = await this.#createExample(definition.example ?? definition.id, { surface, status, definition });
      if (disposed || generation !== this.#generation) { created.dispose(); item.dispose(); return; }
      example = created;
      const apply = () => {
        example.setState(state.value);
        if (reading) example.setValue(Number(reading.range.value));
        crop.request();
      };
      listen(state, "change", apply);
      if (reading) {
        listen(reading.range, "input", () => {
          reading.output.textContent = reading.format(reading.range.value);
          example.setValue(Number(reading.range.value));
          crop.request();
        });
      }
      state.value = "normal";
      apply();
      surface.measure();
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("ui-catalog-item__status--error");
    }
  }
  // Three positions: min, the middle and max (spec 140 D5).
  #reading({ min, max, unit, label }) {
    const range = this.#element("input", "ui-catalog-item__range");
    Object.assign(range, { type: "range", min: String(min), max: String(max), step: String((max - min) / 2),
      value: String((min + max) / 2) });
    range.setAttribute("aria-label", label);
    const format = (value) => `${value} ${unit}`;
    const output = this.#element("output", "ui-catalog-item__value", format(range.value));
    return { range, output, format };
  }
  #button(className, text, onClick) {
    const button = this.#element("button", className, text);
    button.type = "button";
    button.addEventListener("click", onClick);
    this.#removals.push(() => button.removeEventListener("click", onClick));
    return button;
  }
  #element(tag, className, text = null) {
    const node = this.#document.createElement(tag); node.className = className;
    if (text !== null) node.textContent = text;
    return node;
  }
}
