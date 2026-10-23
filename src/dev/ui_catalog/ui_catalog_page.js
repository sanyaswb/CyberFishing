import { UiCatalogFrameResizer } from "./ui_catalog_frame_resizer.js";
import { UiCatalogBlockCrop } from "./ui_catalog_block_crop.js";

// The catalog as two tab levels (spec 140): groups, then the cards of the open group. Only one card is on the page,
// centred: a one-line bar (name, state, three-step value, size) over a resizable live window. A card is mounted the
// first time it opens and kept afterwards; a card with a focus selector shows only that block (UiCatalogBlockCrop).
export class UiCatalogPage {
  #document;
  #window;
  #mount;
  #tabsNode;
  #groups;
  #definitions;
  #labels;
  #frameSize;
  #createSurface;
  #createExample;
  #onSelect;
  #groupViews = new Map();
  #cards = new Map();
  #activeGroupId = null;
  #lifetimes = [];
  #removals = [];
  #disposed = false;
  #returnLink;
  #onReturnClick = null;
  constructor({ documentRef, windowTarget = null, mountNode, tabsNode = null, groups = [], definitions, labels = {},
    frameSize = { width: 320, height: 640 }, createSurface, createExample, returnLink = null, onReturn = null,
    onSelect = () => {} }) {
    this.#document = documentRef;
    this.#window = windowTarget;
    this.#mount = mountNode;
    this.#tabsNode = tabsNode;
    this.#groups = groups;
    this.#definitions = definitions;
    this.#labels = labels;
    this.#frameSize = frameSize;
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
  get activeCardId() { return this.#groupViews.get(this.#activeGroupId)?.activeCardId ?? null; }
  // selection: "group" or "group/card" from the URL; unknown parts open the first group or card.
  async mount(selection = "") {
    for (const group of this.#groups) {
      const tab = this.#tab("ui-catalog__tab", group.name, () => { void this.select(group.id); });
      this.#tabsNode?.append(tab);
      const panel = this.#element("section", "ui-catalog__group");
      panel.id = group.id;
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-label", group.name);
      panel.hidden = true;
      const definitions = this.#definitions.filter((definition) => definition.group === group.id);
      const cardTabs = this.#element("nav", "ui-catalog__cards");
      cardTabs.setAttribute("role", "tablist");
      cardTabs.setAttribute("aria-label", group.name);
      cardTabs.hidden = definitions.length < 2;
      const cardTabNodes = new Map();
      for (const definition of definitions) {
        const cardTab = this.#tab("ui-catalog__card-tab", definition.name, () => { void this.select(group.id, definition.id); });
        cardTabs.append(cardTab);
        cardTabNodes.set(definition.id, cardTab);
      }
      panel.append(cardTabs);
      this.#mount.append(panel);
      this.#groupViews.set(group.id, { tab, panel, definitions, cardTabNodes, activeCardId: null });
    }
    const [groupId, cardId] = String(selection).split("/");
    const group = this.#groupViews.has(groupId) ? groupId : this.#groups[0]?.id;
    if (group) await this.select(group, cardId);
  }
  // Opens a group and one of its cards (the last open one, else the first); a card is created only once.
  select(groupId, cardId = null) {
    const view = this.#groupViews.get(groupId);
    if (this.#disposed || !view || view.definitions.length === 0) return Promise.resolve();
    const definition = view.definitions.find(({ id }) => id === cardId) ??
      view.definitions.find(({ id }) => id === view.activeCardId) ?? view.definitions[0];
    if (this.#activeGroupId !== groupId) {
      this.#activeGroupId = groupId;
      for (const [id, other] of this.#groupViews) {
        const active = id === groupId;
        other.panel.hidden = !active;
        this.#setSelected(other.tab, "ui-catalog__tab--active", active);
      }
    }
    if (view.activeCardId !== definition.id) {
      view.activeCardId = definition.id;
      for (const [id, cardTab] of view.cardTabNodes) {
        const active = id === definition.id;
        this.#setSelected(cardTab, "ui-catalog__card-tab--active", active);
        const card = this.#cards.get(id);
        if (card) card.node.hidden = !active;
      }
    }
    this.#onSelect(groupId, definition.id);
    let card = this.#cards.get(definition.id);
    if (!card) {
      card = this.#mountCard(definition, view.panel);
      this.#cards.set(definition.id, card);
    }
    return card.ready;
  }
  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#returnLink?.removeEventListener("click", this.#onReturnClick);
    this.#returnLink = null;
    this.#onReturnClick = null;
    for (const remove of this.#removals) remove();
    this.#removals = [];
    for (const lifetime of this.#lifetimes.reverse()) lifetime.dispose();
    this.#lifetimes = [];
    this.#mount.replaceChildren();
    this.#tabsNode?.replaceChildren();
  }
  #mountCard(definition, panel) {
    const node = this.#element("article", "ui-catalog-card");
    node.id = definition.id;
    node.dataset.catalogFamilies = definition.families.join(" ");
    const bar = this.#element("div", "ui-catalog-card__bar");
    const title = this.#element("h2", "ui-catalog-card__title", definition.name);
    title.title = definition.description;
    const state = this.#element("select", "ui-catalog-card__select");
    state.setAttribute("aria-label", this.#labels.stateLabel ?? "");
    for (const [value, text] of definition.states) {
      const option = this.#element("option", "", text); option.value = value; state.append(option);
    }
    bar.append(title, state);
    const reading = definition.reading ? this.#reading(definition.reading) : null;
    if (reading) bar.append(reading.range, reading.output);
    const size = this.#element("output", "ui-catalog-card__size");
    bar.append(size);
    const frame = this.#element("div", "ui-catalog-card__frame");
    const stage = this.#element("div", "ui-catalog-card__stage");
    frame.append(stage);
    const status = this.#element("p", "ui-catalog-card__status");
    status.setAttribute("role", "status");
    node.append(bar, frame, status);
    panel.append(node);
    const surface = this.#createSurface(stage);
    const crop = definition.focus && this.#window
      ? new UiCatalogBlockCrop({ frame, stage, selector: definition.focus, windowTarget: this.#window }) : null;
    let example = null;
    const resizer = new UiCatalogFrameResizer({ documentRef: this.#document, frame, size: this.#frameSize,
      labels: this.#labels, getMaxWidth: () => this.#mount.clientWidth,
      onChange: ({ width, height }) => { size.textContent = `${width} × ${height}`; surface.requestMeasure(); crop?.request(); } });
    const unsubscribe = surface.subscribe((metrics) => { example?.resize?.(metrics); crop?.request(); });
    const removals = [];
    const listen = (target, type, callback) => {
      target.addEventListener(type, callback);
      removals.push(() => target.removeEventListener(type, callback));
    };
    this.#lifetimes.push({ dispose: () => {
      for (const remove of removals) remove();
      unsubscribe();
      crop?.dispose();
      resizer.dispose();
      example?.dispose();
      surface.dispose();
    } });
    const ready = (async () => {
      try {
        example = await this.#createExample(definition.example ?? definition.id, { surface, status, definition });
        if (this.#disposed) { example.dispose(); example = null; return; }
        const apply = () => {
          example.setState(state.value);
          if (reading) example.setValue(Number(reading.range.value));
          crop?.request();
        };
        listen(state, "change", apply);
        if (reading) {
          listen(reading.range, "input", () => {
            reading.output.textContent = reading.format(reading.range.value);
            example.setValue(Number(reading.range.value));
          });
        }
        state.value = "normal";
        apply();
        surface.measure();
      } catch (error) {
        status.textContent = error.message;
        status.classList.add("ui-catalog-card__status--error");
        example?.dispose();
        example = null;
      }
    })();
    return { node, ready };
  }
  // Three positions: min, the middle and max (spec 140 D5).
  #reading({ min, max, unit, label }) {
    const range = this.#element("input", "ui-catalog-card__range");
    Object.assign(range, { type: "range", min: String(min), max: String(max), step: String((max - min) / 2),
      value: String((min + max) / 2) });
    range.setAttribute("aria-label", label);
    const format = (value) => `${value} ${unit}`;
    const output = this.#element("output", "ui-catalog-card__value", format(range.value));
    return { range, output, format };
  }
  #tab(className, text, onClick) {
    const tab = this.#element("button", className, text);
    tab.type = "button";
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", "false");
    tab.addEventListener("click", onClick);
    this.#removals.push(() => tab.removeEventListener("click", onClick));
    return tab;
  }
  #setSelected(tab, activeClass, active) {
    tab.classList.toggle(activeClass, active);
    tab.setAttribute("aria-selected", String(active));
  }
  #element(tag, className, text = null) {
    const node = this.#document.createElement(tag); node.className = className;
    if (text !== null) node.textContent = text;
    return node;
  }
}
