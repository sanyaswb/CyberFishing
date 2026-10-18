import { UI_CATALOG_WIDTHS } from "./ui_catalog_definitions.js";

export class UiCatalogPage {
  #document;
  #mount;
  #definitions;
  #createSurface;
  #createExample;
  #lifetimes = [];
  #disposed = false;
  #returnLink;
  #onReturnClick = null;
  constructor({ documentRef, mountNode, definitions, createSurface, createExample, returnLink = null, onReturn = null }) {
    this.#document = documentRef;
    this.#mount = mountNode;
    this.#definitions = definitions;
    this.#createSurface = createSurface;
    this.#createExample = createExample;
    if (returnLink && typeof onReturn === "function") {
      this.#returnLink = returnLink;
      this.#onReturnClick = event => { event.preventDefault(); onReturn(); };
      returnLink.addEventListener("click", this.#onReturnClick);
    }
  }
  async mount() {
    for (const definition of this.#definitions) {
      if (this.#disposed) break;
      await this.#mountPreview(definition);
    }
  }
  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#returnLink?.removeEventListener("click", this.#onReturnClick);
    this.#returnLink = null;
    this.#onReturnClick = null;
    for (const lifetime of this.#lifetimes.reverse()) lifetime.dispose();
    this.#lifetimes = [];
    this.#mount.replaceChildren();
  }
  async #mountPreview(definition) {
    const section = this.#element("section", "ui-catalog-preview");
    section.id = definition.id;
    section.dataset.catalogFamilies = definition.families.join(" ");
    const heading = this.#element("h2", "ui-catalog-preview__title", definition.name);
    const description = this.#element("p", "ui-catalog-preview__description", definition.description);
    const contract = this.#element("p", "ui-catalog-preview__contract", definition.contract);
    const sources = this.#element("details", "ui-catalog-preview__sources");
    sources.append(this.#element("summary", "ui-catalog-preview__summary", "Джерела компонента та оформлення"));
    for (const path of [...definition.sources, ...definition.styles]) {
      const link = this.#element("a", "ui-catalog-preview__source", path);
      link.href = path;
      sources.append(link);
    }
    const controls = this.#element("div", "ui-catalog-preview__controls");
    const state = this.#select("Стан прикладу", definition.states);
    const width = this.#select("Фізична ширина", UI_CATALOG_WIDTHS.map((value) => [String(value), `${value}px`]));
    width.input.value = "320";
    const metrics = this.#element("output", "ui-catalog-preview__metrics");
    controls.append(state.label, width.label, metrics);
    const viewport = this.#element("div", "ui-catalog-preview__viewport");
    const host = this.#element("div", "ui-catalog-preview__stage");
    host.style.setProperty("--ui-catalog-preview-width", "320px");
    host.style.setProperty("--ui-catalog-preview-height", `${definition.height}px`);
    viewport.append(host);
    const status = this.#element("p", "ui-catalog-preview__status");
    status.setAttribute("role", "status");
    section.append(heading, description, contract, sources, controls, viewport, status);
    this.#mount.append(section);
    const surface = this.#createSurface(host);
    const removals = [];
    let example = null;
    const listen = (node, type, callback) => {
      node.addEventListener(type, callback);
      removals.push(() => node.removeEventListener(type, callback));
    };
    const renderMetrics = (reading) => {
      metrics.textContent = `${Math.round(reading.physicalWidth)}px → ${Math.round(reading.logicalWidth)}px · s=${reading.scale.toFixed(3)}`;
      example?.resize?.(reading);
    };
    const unsubscribe = surface.subscribe(renderMetrics);
    renderMetrics(surface.getMetrics());
    const lifetime = { dispose: () => {
      for (const remove of removals) remove();
      unsubscribe();
      example?.dispose();
      surface.dispose();
    } };
    this.#lifetimes.push(lifetime);
    try {
      example = await this.#createExample(definition.id, { surface, status });
      if (this.#disposed) { example.dispose(); example = null; return; }
      listen(state.input, "change", () => example.setState(state.input.value));
      listen(width.input, "change", () => {
        host.style.setProperty("--ui-catalog-preview-width", `${width.input.value}px`);
        surface.measure();
      });
      if (definition.reading) {
        const label = this.#element("label", "ui-catalog-preview__control");
        label.append(this.#element("span", "ui-catalog-preview__control-label", definition.reading.label));
        const range = this.#element("input", "ui-catalog-preview__range");
        Object.assign(range, { type: "range", min: String(definition.reading.min), max: String(definition.reading.max), value: String(definition.reading.value) });
        const output = this.#element("output", "ui-catalog-preview__value", range.value);
        label.append(range, output);
        controls.append(label);
        listen(range, "input", () => { output.textContent = range.value; example.setValue(Number(range.value)); });
      }
      example.setState("normal");
      surface.measure();
      renderMetrics(surface.getMetrics());
    } catch (error) {
      status.textContent = `Приклад не завантажено: ${error.message}`;
      status.classList.add("ui-catalog-preview__status--error");
      example?.dispose();
      example = null;
      surface.dispose();
    }
  }
  #select(text, choices) {
    const label = this.#element("label", "ui-catalog-preview__control");
    const input = this.#element("select", "ui-catalog-preview__select");
    for (const [value, textValue] of choices) {
      const option = this.#element("option", "", textValue); option.value = value; input.append(option);
    }
    label.append(this.#element("span", "ui-catalog-preview__control-label", text), input);
    return { label, input };
  }
  #element(tag, className, text = null) {
    const node = this.#document.createElement(tag); node.className = className;
    if (text !== null) node.textContent = text;
    return node;
  }
}
