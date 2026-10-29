// Spec 142 D7: the radio's controls among its editor parameters: the station display (name, country, bitrate,
// status), power, previous/next, the country selector, volume and the ducking and background switches. In DEV a
// tuning port (TK-098) adds the main parameters of the enabled sound effects as sliders under the volume; production
// has none (the player never controls the sound quality). One rendered block at a time: a new render replaces the
// subscription of the previous one. Updates write only changed text and values (DESIGN_RULES §13). Station names come
// from a foreign API and are written as text only.
export class RadioControlsRenderer {
  #dom;
  #radio;
  #labels;
  #tuning;
  #unsubscribe = null;
  #expandedSections = new Set();

  // radio: RadioReceiverService-like port; labels: RADIO_LABELS; tuning: DEV only, { list(), set(effect, key, value) }.
  constructor({ domFactory, radio, labels, tuning = null }) {
    this.#dom = domFactory;
    this.#radio = radio;
    this.#labels = labels;
    this.#tuning = tuning;
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

    const channels = this.#dom.element("div", "radio-controls__channels");
    const channelButtons = {};
    for (const key of ["volia", "world"]) {
      const btn = this.#dom.button("radio-controls__channel inventory-action", labels.channels?.[key] || key);
      btn.addEventListener("click", () => this.#radio.setChannel?.(key));
      channels.append(btn);
      channelButtons[key] = btn;
    }

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
    // The player's switches; the sound effects are the configuration's, never the player's (TK-097).
    for (const key of ["ducking", "playInBackground"]) {
      const label = this.#dom.element("label", "radio-controls__switch");
      const input = this.#dom.element("input", "radio-controls__switch-input");
      input.type = "checkbox";
      input.setAttribute("role", "switch");
      input.addEventListener("change", () => this.#radio.setPreference(key, input.checked));
      label.append(input, this.#dom.element("span", "radio-controls__switch-label", labels[key]));
      switches.append(label);
      toggles[key] = input;
    }
    const tuning = this.#tuning ? this.#dom.element("div", "radio-controls__tuning") : null;
    block.append(display, channels, buttons, country.field, volume.field, ...(tuning ? [tuning] : []), switches);

    const nodes = { block, station, meta, status, power, previous, next, channels, channelButtons,
      country: country.control, countryField: country.field,
      volume: volume.control, toggles, countryOptions: null, tuning, tuningSignature: null };
    this.#fillTuning(nodes);
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

  #toggleSection(key, button, content, arrow) {
    const isExpanded = this.#expandedSections.has(key);
    if (isExpanded) {
      this.#expandedSections.delete(key);
      content.style.display = "none";
      button.setAttribute("aria-expanded", "false");
      if (arrow) this.#text(arrow, "▶");
    } else {
      this.#expandedSections.add(key);
      content.style.display = "grid";
      button.setAttribute("aria-expanded", "true");
      if (arrow) this.#text(arrow, "▼");
    }
  }

  // DEV: all radio sound parameters organized into a collapsed list by analogy with DevTools (TK-121).
  #fillTuning(nodes) {
    if (!nodes.tuning) return;
    const groups = this.#tuning.groups();
    const entries = this.#tuning.list();
    const signature = [
      ...groups.map((group) => `${group.group}:${group.enabled}`),
      ...entries.map((entry) => `${entry.effect}.${entry.key}`),
    ].join("|");
    if (signature === nodes.tuningSignature) return;
    nodes.tuningSignature = signature;

    const isMainExpanded = this.#expandedSections.has("main");
    const mainToggle = this.#dom.button("radio-controls__tuning-toggle", "");
    mainToggle.type = "button";
    mainToggle.setAttribute("aria-expanded", String(isMainExpanded));
    const mainArrow = this.#dom.element("span", "radio-controls__tuning-arrow", isMainExpanded ? "▼" : "▶");
    const mainTitle = this.#dom.element("span", "radio-controls__tuning-title", this.#labels.tuningTitle);
    mainToggle.append(mainArrow, mainTitle);

    const mainContent = this.#dom.element("div", "radio-controls__tuning-content");
    mainContent.style.display = isMainExpanded ? "grid" : "none";

    mainToggle.addEventListener("click", () => {
      this.#toggleSection("main", mainToggle, mainContent, mainArrow);
    });

    for (const group of groups) {
      if (group.flag || this.#tuning.isFlag?.(group.group)) {
        const groupEl = this.#dom.element("div", "radio-controls__tuning-group");
        const label = this.#dom.element("label", "radio-controls__switch");
        const input = this.#dom.element("input", "radio-controls__tuning-switch");
        input.type = "checkbox";
        input.setAttribute("role", "switch");
        input.checked = group.enabled;
        input.addEventListener("change", () => {
          this.#tuning.setEnabled(group.group, input.checked);
          this.#fillTuning(nodes);
        });
        label.append(input, this.#dom.element("span", "radio-controls__switch-label", group.label));
        groupEl.append(label);
        mainContent.append(groupEl);
        continue;
      }

      const groupKey = `group:${group.group}`;
      const isGroupExpanded = this.#expandedSections.has(groupKey);
      const groupEl = this.#dom.element("div", "radio-controls__tuning-group");
      const groupHeader = this.#dom.element("div", "radio-controls__group-header");

      const groupToggle = this.#dom.button("radio-controls__group-toggle", "");
      groupToggle.type = "button";
      groupToggle.setAttribute("aria-expanded", String(isGroupExpanded));
      const groupArrow = this.#dom.element("span", "radio-controls__tuning-arrow", isGroupExpanded ? "▼" : "▶");
      const groupTitle = this.#dom.element("span", "radio-controls__group-title", group.label);
      groupToggle.append(groupArrow, groupTitle);

      const label = this.#dom.element("label", "radio-controls__switch");
      const input = this.#dom.element("input", "radio-controls__tuning-switch");
      input.type = "checkbox";
      input.setAttribute("role", "switch");
      input.checked = group.enabled;
      input.addEventListener("change", () => {
        this.#tuning.setEnabled(group.group, input.checked);
        this.#fillTuning(nodes);
      });
      label.append(input, this.#dom.element("span", "radio-controls__switch-label", "увімкнено"));

      groupHeader.append(groupToggle, label);
      groupEl.append(groupHeader);

      const groupContent = this.#dom.element("div", "radio-controls__group-content");
      groupContent.style.display = isGroupExpanded ? "grid" : "none";

      groupToggle.addEventListener("click", () => {
        this.#toggleSection(groupKey, groupToggle, groupContent, groupArrow);
      });

      if (group.enabled) {
        const groupEntries = entries.filter((entry) => entry.effect === group.group);
        for (const entry of groupEntries) {
          const slider = this.#dom.element("input", "radio-controls__slider");
          Object.assign(slider, { type: "range", min: String(entry.min), max: String(entry.max), step: String(entry.step) });
          slider.value = String(entry.value);
          const field = this.#field(entry.label, slider);
          const value = this.#dom.element("span", "radio-controls__tuning-value", String(entry.value));
          field.field.append(value);
          slider.addEventListener("input", () => {
            this.#tuning.set(entry.effect, entry.key, Number(slider.value));
            this.#text(value, slider.value);
          });
          groupContent.append(field.field);
        }

        if (group.group === "vinyl" && typeof this.#tuning.getVinylSfxList === "function") {
          const sfxSection = this.#dom.element("div", "radio-controls__sfx-section");
          const sfxTitle = this.#dom.element("div", "radio-controls__sfx-title", "Семпли SFX (накладання аудіозаписів)");
          sfxSection.append(sfxTitle);

          const sfxList = this.#tuning.getVinylSfxList();
          for (const track of sfxList) {
            const row = this.#dom.element("div", "radio-controls__sfx-row");
            const toggleLabel = this.#dom.element("label", "radio-controls__sfx-toggle");
            const checkbox = this.#dom.element("input", "radio-controls__sfx-checkbox");
            checkbox.type = "checkbox";
            checkbox.checked = track.enabled;
            checkbox.addEventListener("change", () => {
              this.#tuning.setVinylSfxEnabled?.(track.id, checkbox.checked);
            });
            const name = this.#dom.element("span", "radio-controls__sfx-name", track.label);
            toggleLabel.append(checkbox, name);

            const volField = this.#dom.element("div", "radio-controls__sfx-volume-field");
            const volSlider = this.#dom.element("input", "radio-controls__sfx-volume");
            Object.assign(volSlider, { type: "range", min: "0", max: "1", step: "0.05" });
            volSlider.value = String(track.volume);
            const volVal = this.#dom.element("span", "radio-controls__tuning-value", String(track.volume));
            volSlider.addEventListener("input", () => {
              this.#tuning.setVinylSfxVolume?.(track.id, Number(volSlider.value));
              this.#text(volVal, volSlider.value);
            });
            volField.append(volSlider, volVal);

            row.append(toggleLabel, volField);
            sfxSection.append(row);
          }
          groupContent.append(sfxSection);
        }
      }

      groupEl.append(groupContent);
      mainContent.append(groupEl);
    }

    nodes.tuning.replaceChildren(mainToggle, mainContent);
  }

  #update(nodes, reading) {
    this.#fillTuning(nodes);
    const labels = this.#labels;
    const mode = reading.channelMode || "world";

    if (nodes.channelButtons) {
      for (const [key, btn] of Object.entries(nodes.channelButtons)) {
        const active = mode === key;
        btn.classList.toggle("radio-controls__channel--active", active);
        btn.setAttribute("aria-pressed", String(active));
      }
    }

    if (mode === "volia") {
      const title = reading.station?.title ? `${reading.station.name} — ${reading.station.title}` : (reading.station?.name || "VOLIA 77.2");
      this.#text(nodes.station, title);
      const meta = reading.trackCount > 1
        ? `77.2 FM · ${labels.trackIndex(reading.trackIndex + 1, reading.trackCount)}`
        : "77.2 FM · Воля";
      this.#text(nodes.meta, meta);
      if (nodes.countryField) nodes.countryField.hidden = true;
    } else {
      this.#text(nodes.station, reading.station?.name || labels.noStation);
      const meta = [reading.country, reading.station?.bitrate ? labels.bitrate(reading.station.bitrate) : ""]
        .filter(Boolean).join(" · ");
      this.#text(nodes.meta, meta);
      if (nodes.countryField) nodes.countryField.hidden = false;
    }

    const statusText = labels.status[reading.status] || reading.status;
    const weak = reading.powered && Number(reading.signal ?? 1) < 1;
    this.#text(nodes.status, weak ? `${statusText} · ${labels.weakSignal}` : statusText);
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
