import { UiCatalogFrameResizer } from "./ui_catalog_frame_resizer.js";

// The catalog as tabs of groups (spec 140): one card per example with a one-line bar (name, state, three-step value,
// size) over a resizable live frame. A group's examples are mounted the first time its tab opens and kept afterwards.
export class UiCatalogPage {
  #document;
  #mount;
  #tabsNode;
  #groups;
  #definitions;
  #labels;
  #createSurface;
  #createExample;
  #onGroupChange;
  #tabs = new Map();
  #groupNodes = new Map();
  #groupMounts = new Map();
  #activeGroupId = null;
  #lifetimes = [];
  #removals = [];
  #disposed = false;
  #returnLink;
  #onReturnClick = null;
  constructor({ documentRef, mountNode, tabsNode = null, groups = [], definitions, labels = {}, createSurface,
    createExample, returnLink = null, onReturn = null, onGroupChange = () => {} }) {
    this.#document = documentRef;
    this.#mount = mountNode;
    this.#tabsNode = tabsNode;
    this.#groups = groups;
    this.#definitions = definitions;
    this.#labels = labels;
    this.#createSurface = createSurface;
    this.#createExample = createExample;
    this.#onGroupChange = onGroupChange;
    if (returnLink && typeof onReturn === "function") {
      this.#returnLink = returnLink;
      this.#onReturnClick = event => { event.preventDefault(); onReturn(); };
      returnLink.addEventListener("click", this.#onReturnClick);
    }
  }
  get activeGroupId() { return this.#activeGroupId; }
  // initialGroupId: a group from the URL; an unknown id opens the first group.
  async mount(initialGroupId = null) {
    for (const group of this.#groups) {
      const tab = this.#element("button", "ui-catalog__tab", group.name);
      tab.type = "button";
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", "false");
      this.#listen(tab, "click", () => { void this.selectGroup(group.id); });
      this.#tabsNode?.append(tab);
      this.#tabs.set(group.id, tab);
      const node = this.#element("section", "ui-catalog__group");
      node.id = group.id;
      node.setAttribute("role", "tabpanel");
      node.setAttribute("aria-label", group.name);
      node.hidden = true;
      this.#mount.append(node);
      this.#groupNodes.set(group.id, node);
    }
    const first = this.#groups.find(({ id }) => id === initialGroupId) ?? this.#groups[0];
    if (first) await this.selectGroup(first.id);
  }
  // Shows one group; its examples are created only the first time.
  selectGroup(groupId) {
    if (this.#disposed || !this.#groupNodes.has(groupId)) return Promise.resolve();
    if (this.#activeGroupId !== groupId) {
      this.#activeGroupId = groupId;
      for (const [id, node] of this.#groupNodes) {
        const active = id === groupId;
        node.hidden = !active;
        const tab = this.#tabs.get(id);
        tab.classList.toggle("ui-catalog__tab--active", active);
        tab.setAttribute("aria-selected", String(active));
      }
      this.#onGroupChange(groupId);
    }
    let mounted = this.#groupMounts.get(groupId);
    if (!mounted) {
      mounted = this.#mountGroup(groupId);
      this.#groupMounts.set(groupId, mounted);
    }
    return mounted;
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
  async #mountGroup(groupId) {
    const node = this.#groupNodes.get(groupId);
    for (const definition of this.#definitions) {
      if (this.#disposed) break;
      if (definition.group === groupId) await this.#mountCard(definition, node);
    }
  }
  async #mountCard(definition, groupNode) {
    const card = this.#element("article", "ui-catalog-card");
    card.id = definition.id;
    card.dataset.catalogFamilies = definition.families.join(" ");
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
    const status = this.#element("p", "ui-catalog-card__status");
    status.setAttribute("role", "status");
    card.append(bar, frame, status);
    groupNode.append(card);
    const surface = this.#createSurface(frame);
    let example = null;
    const resizer = new UiCatalogFrameResizer({ documentRef: this.#document, frame, size: definition.size,
      labels: this.#labels, getMaxWidth: () => this.#mount.clientWidth,
      onChange: ({ width, height }) => { size.textContent = `${width} × ${height}`; surface.requestMeasure(); } });
    const unsubscribe = surface.subscribe((metrics) => example?.resize?.(metrics));
    const removals = [];
    const listen = (target, type, callback) => {
      target.addEventListener(type, callback);
      removals.push(() => target.removeEventListener(type, callback));
    };
    this.#lifetimes.push({ dispose: () => {
      for (const remove of removals) remove();
      unsubscribe();
      resizer.dispose();
      example?.dispose();
      surface.dispose();
    } });
    try {
      example = await this.#createExample(definition.id, { surface, status });
      if (this.#disposed) { example.dispose(); example = null; return; }
      const apply = () => {
        example.setState(state.value);
        if (reading) example.setValue(Number(reading.range.value));
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
  #listen(node, type, callback) {
    node.addEventListener(type, callback);
    this.#removals.push(() => node.removeEventListener(type, callback));
  }
  #element(tag, className, text = null) {
    const node = this.#document.createElement(tag); node.className = className;
    if (text !== null) node.textContent = text;
    return node;
  }
}
