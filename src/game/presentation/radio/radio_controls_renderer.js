// Spec 142 D7: the radio's controls among its editor parameters: the station display (name, country, bitrate,
// status), power, previous/next, the country selector, volume and the switches. One rendered block at a time: a new
// render replaces the subscription of the previous one. Updates write only changed text and values (DESIGN_RULES §13).
// Station names come from a foreign API and are written as text only.
export class RadioControlsRenderer {
  #dom;
  #radio;
  #labels;
  #unsubscribe = null;

  // radio: RadioReceiverService-like port; labels: RADIO_LABELS.
  constructor({ domFactory, radio, labels }) {
    this.#dom = domFactory;
    this.#radio = radio;
    this.#labels = labels;
  }

  supports(item) {
    return item?.itemType === "radio";
  }

  render() {
    this.#unsubscribe?.();
    const labels = this.#labels;
    const block = this.#dom.element("section", "radio-controls inventory-panel");
    block.setAttribute("aria-label", labels.title);
    const display = this.#dom.element("div", "radio-controls__display");
    const station = this.#dom.element("p", "radio-controls__station");
    const meta = this.#dom.element("p", "radio-controls__meta");
    const status = this.#dom.element("p", "radio-controls__status");
    status.setAttribute("role", "status");
    display.append(station, meta, status);

    const buttons = this.#dom.element("div", "radio-controls__buttons");
    const previous = this.#dom.button("radio-controls__button inventory-action", labels.previous);
    const power = this.#dom.button("radio-controls__button radio-controls__button--power inventory-action", labels.powerOn);
    const next = this.#dom.button("radio-controls__button inventory-action", labels.next);
    previous.addEventListener("click", () => this.#radio.previous());
    power.addEventListener("click", () => this.#radio.togglePower());
    next.addEventListener("click", () => this.#radio.next());
    buttons.append(previous, power, next);

    const country = this.#field(labels.country, this.#dom.element("select", "radio-controls__select"));
    country.control.addEventListener("change", () => this.#radio.setCountry(country.control.value));
    const volume = this.#field(labels.volume, this.#dom.element("input", "radio-controls__volume"));
    Object.assign(volume.control, { type: "range", min: "0", max: "100", step: "1" });
    volume.control.addEventListener("input", () => this.#radio.setVolume(Number(volume.control.value) / 100));

    const switches = this.#dom.element("div", "radio-controls__switches");
    const toggles = {};
    for (const key of ["retroMode", "ducking", "playInBackground"]) {
      const label = this.#dom.element("label", "radio-controls__switch");
      const input = this.#dom.element("input", "radio-controls__switch-input");
      input.type = "checkbox";
      input.setAttribute("role", "switch");
      input.addEventListener("change", () => this.#radio.setPreference(key, input.checked));
      label.append(input, this.#dom.element("span", "radio-controls__switch-label", labels[key]));
      switches.append(label);
      toggles[key] = input;
    }
    block.append(display, buttons, country.field, volume.field, switches);

    const nodes = { block, station, meta, status, power, previous, next, country: country.control,
      volume: volume.control, toggles, countryOptions: null };
    this.#fillCountries(nodes);
    this.#unsubscribe = this.#radio.subscribe((reading) => this.#update(nodes, reading));
    this.#update(nodes, this.#radio.getStatus());
    return block;
  }

  dispose() {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  #field(text, control) {
    const field = this.#dom.element("label", "radio-controls__field");
    field.append(this.#dom.element("span", "radio-controls__field-label", text), control);
    return { field, control };
  }

  async #fillCountries(nodes) {
    let countries = [];
    try {
      countries = await this.#radio.listCountries();
    } catch {
      countries = [];
    }
    const current = this.#radio.getStatus().country;
    const entries = countries.some((entry) => entry.code === current) || !current
      ? countries : [{ code: current, name: current }, ...countries];
    nodes.country.replaceChildren(...entries.map((entry) => {
      const option = this.#dom.element("option", "", `${entry.name} (${entry.code})`);
      option.value = entry.code;
      return option;
    }));
    nodes.countryOptions = entries.length;
    nodes.country.value = current;
  }

  #update(nodes, reading) {
    const labels = this.#labels;
    this.#text(nodes.station, reading.station?.name || labels.noStation);
    const meta = [reading.country, reading.station?.bitrate ? labels.bitrate(reading.station.bitrate) : ""]
      .filter(Boolean).join(" · ");
    this.#text(nodes.meta, meta);
    this.#text(nodes.status, labels.status[reading.status] || reading.status);
    this.#text(nodes.power, reading.powered ? labels.powerOff : labels.powerOn);
    nodes.power.setAttribute("aria-pressed", String(reading.powered));
    const tuning = !reading.powered || reading.stationCount < 2;
    if (nodes.previous.disabled !== tuning) nodes.previous.disabled = tuning;
    if (nodes.next.disabled !== tuning) nodes.next.disabled = tuning;
    if (nodes.countryOptions && nodes.country.value !== reading.country) nodes.country.value = reading.country;
    const volume = String(Math.round(reading.volume * 100));
    if (nodes.volume.value !== volume) nodes.volume.value = volume;
    for (const [key, input] of Object.entries(nodes.toggles)) {
      if (input.checked !== reading[key]) input.checked = reading[key];
    }
    nodes.block.classList.toggle("radio-controls--on", reading.powered);
  }

  #text(node, text) {
    if (node.textContent !== text) node.textContent = text;
  }
}
