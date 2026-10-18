export class UiCatalogMetersExample {
  #meters;
  #resolver;
  #dom;
  #mount;
  #status;
  #readings = [];
  #state = "normal";
  #value = 67;
  constructor({ domFactory, resourceMeterRenderer, resourceMeterResolver, surface, status }) {
    this.#dom = domFactory; this.#meters = resourceMeterRenderer;
    this.#resolver = resourceMeterResolver; this.#mount = surface.mountRoot; this.#status = status;
    this.#mount.classList.add("ui-catalog-preview__meter-layout");
    for (const percent of [0, 1, 34, 67, 100]) this.#appendPair(percent, false);
    this.#appendPair(this.#value, true);
  }
  setState(state) { this.#state = state; this.#update(); }
  setValue(value) { this.#value = value; this.#update(); }
  dispose() { this.#mount.replaceChildren(); this.#readings = []; }
  #appendPair(percent, dynamic) {
    const row = this.#dom.element("div", "ui-catalog-preview__meter-row");
    const label = this.#dom.element("span", "ui-catalog-preview__reading", `${percent}% залишку`);
    const resource = this.#meters.create({ id: "capacity", percent, label: `Залишок ресурсу ${percent}%` }, { variant: "parameter", showIcon: false });
    const condition = this.#meters.create({ id: "condition", percent, label: `Стан ${percent}%` }, { variant: "parameter", showIcon: false });
    const occupancy = this.#meters.create({ id: "keepnet-capacity", percent: 100 - percent, remainingPercent: percent, label: `Зайнятість ${100 - percent}%` }, { variant: "summary", showIcon: false });
    row.append(label, resource, condition, occupancy);
    this.#mount.append(row);
    if (dynamic) this.#readings.push({ label, resource, condition, occupancy });
  }
  #update() {
    for (const row of this.#readings) {
      const missing = this.#state === "missing";
      const normalized = this.#resolver.resolve({ progression: { capacity: { available: true, percent: missing ? undefined : this.#value, label: "Залишок" } } });
      const percent = normalized?.percent ?? 0;
      const unavailable = missing && !normalized;
      row.resource.hidden = unavailable; row.condition.hidden = unavailable;
      row.label.textContent = unavailable ? "Значення відсутнє: production resolver не створює шкалу" : `Ресурс / стан ${percent}% · зайнятість ${100 - percent}%`;
      if (!unavailable) {
        this.#meters.updateReading(row.resource, { percent, label: `Залишок ресурсу ${percent}%` });
        this.#meters.updateReading(row.condition, { percent, label: `Стан ${percent}%` });
      }
      const occupancy = this.#state === "zero" || this.#state === "over" ? 100 : 100 - percent;
      this.#meters.updateReading(row.occupancy, { percent: occupancy, remainingPercent: 100 - occupancy,
        label: this.#state === "zero" ? "Місткість 0: заповнення обмежено до 100%" : this.#state === "over" ? "Переповнення 110 / 100: заповнення обмежено до 100%" : `Зайнятість ${occupancy}%` });
    }
    this.#status.textContent = "У кожному рядку: ресурс, стан, зайнятість. Перші дві шкали мають той самий колір, що й вільна частина третьої.";
  }
}
