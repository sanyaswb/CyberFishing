// One row of production meters driven by the card's three-step slider (spec 140 D5): resource, condition and the
// occupancy whose free part reads the same remaining value.
export class UiCatalogMetersExample {
  #meters;
  #resolver;
  #dom;
  #mount;
  #row;
  #state = "normal";
  #value = 50;
  constructor({ domFactory, resourceMeterRenderer, resourceMeterResolver, surface }) {
    this.#dom = domFactory; this.#meters = resourceMeterRenderer;
    this.#resolver = resourceMeterResolver; this.#mount = surface.mountRoot;
    this.#mount.classList.add("ui-catalog-preview__meter-layout");
    const percent = this.#value;
    const row = this.#dom.element("div", "ui-catalog-preview__meter-row");
    const resource = this.#meters.create({ id: "capacity", percent, label: `Залишок ресурсу ${percent}%` }, { variant: "parameter", showIcon: false });
    const condition = this.#meters.create({ id: "condition", percent, label: `Стан ${percent}%` }, { variant: "parameter", showIcon: false });
    const occupancy = this.#meters.create({ id: "keepnet-capacity", percent: 100 - percent, remainingPercent: percent, label: `Зайнятість ${100 - percent}%` }, { variant: "summary", showIcon: false });
    row.append(resource, condition, occupancy);
    this.#mount.append(row);
    this.#row = { resource, condition, occupancy };
  }
  setState(state) { this.#state = state; this.#update(); }
  setValue(value) { this.#value = value; this.#update(); }
  dispose() { this.#mount.replaceChildren(); this.#row = null; }
  #update() {
    const row = this.#row;
    const missing = this.#state === "missing";
    const normalized = this.#resolver.resolve({ progression: { capacity: { available: true, percent: missing ? undefined : this.#value, label: "Залишок" } } });
    const percent = normalized?.percent ?? 0;
    const unavailable = missing && !normalized;
    row.resource.hidden = unavailable; row.condition.hidden = unavailable;
    if (!unavailable) {
      this.#meters.updateReading(row.resource, { percent, label: `Залишок ресурсу ${percent}%` });
      this.#meters.updateReading(row.condition, { percent, label: `Стан ${percent}%` });
    }
    const occupancy = this.#state === "zero" || this.#state === "over" ? 100 : 100 - percent;
    this.#meters.updateReading(row.occupancy, { percent: occupancy, remainingPercent: 100 - occupancy,
      label: this.#state === "zero" ? "Місткість 0: заповнення обмежено до 100%" : this.#state === "over" ? "Переповнення 110 / 100: заповнення обмежено до 100%" : `Зайнятість ${occupancy}%` });
  }
}
