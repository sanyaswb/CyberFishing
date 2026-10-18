const CATEGORIES = Object.freeze(["castable", "collisions", "snags", "dynamic"]);
const LABELS = Object.freeze({ castable: "Закидання · зелений", collisions: "Перешкоди · червоний", snags: "Зачепи · жовтий", dynamic: "Рухомі · рожевий" });

// Composes existing DevTools controls; geometry edits go through the same validated runtime override path.
export class ZoneEditorSection {
  #ui; #state; #config; #createSection; #renderTree; #update;
  #category = "castable"; #index = 0; #details = null;

  constructor({ ui, state, config, createSection, renderTree, updateConfig }) {
    this.#ui = ui; this.#state = state; this.#config = config; this.#createSection = createSection;
    this.#renderTree = renderTree; this.#update = updateConfig;
  }

  render(parent) {
    const ui = this.#ui, state = this.#state;
    const content = this.#createSection("🗺️ РЕДАКТОР ЗОН", parent, ["ZONE_EDITOR"]);
    for (const [key, label] of [["enabled", "Показати редактор"], ["background", "Показати фон (інакше чорний)"], ["grid", "Метрова сітка"]]) {
      ui.createSwitcherRow(label, state[key], content, value => state.setFlag(key, value));
    }
    const spacingPath = ["ZONE_EDITOR", "spacingMeters"];
    ui.createInputRow("Мін. крок сітки, м", state.spacingMeters, content, "number", value => {
      state.setSpacing(value); ui.syncValue(spacingPath, state.spacingMeters);
    }, spacingPath);
    ui.createInfoRow("Сітка", "Одна WaterMetric для відстаней і масштабу. До 96 ліній на вісь; дрібний крок автоматично збільшується.", content);
    for (const category of CATEGORIES) {
      ui.createSwitcherRow(LABELS[category], state.categories[category], content, value => state.setCategory(category, value));
    }
    ui.createInfoRow("Видимість", "Ці перемикачі не змінюють фізику зон. Зони снасті й виважування показуються після закидання.", content);
    for (const [key, label] of [["showChumZones", "Зони прикормки"], ["showCatchZone", "Зона підведення"],
      ["showLastDashZone", "Зона останнього ривка"], ["showNetZone", "Зона підсаки"], ["showAimingZone", "Зона прицілювання"],
      ["showPoleFightSector", "Сектор виважування"], ["showFightLineRadius", "Радіус ліски"]]) {
      const path = ["CONFIG", "locations", key];
      ui.createSwitcherRow(label, this.#config.locations[key] !== false, content, value => this.#update(path, value), path);
    }
    ui.createSelectRow("Категорія зони", CATEGORIES, this.#category, content, value => {
      this.#category = value; this.#index = 0; this.#fill();
    });
    this.#details = this.#createSection("Геометрія й перспектива", content, ["ZONE_EDITOR", "geometry"]);
    this.#fill();
  }

  #fill() {
    const content = this.#details;
    this.#ui.releaseValueBindings(content);
    content.replaceChildren();
    const id = this.#state.locationId || this.#config.locations.currentLocationId || Object.keys(this.#config.locations.map)[0];
    const location = this.#config.locations.map[id];
    if (!location) return;
    const zones = location.zones?.[this.#category] || [];
    this.#index = Math.max(0, Math.min(this.#index, zones.length - 1));
    this.#ui.createInfoRow("Локація", id, content);
    this.#ui.createInfoRow("Координати", "x/y/w/h — клітинки designCellSize; bounds — пікселі карти. Останню зону закидання видалити не можна.", content);
    const path = ["CONFIG", "locations", "map", id, "zones", this.#category];
    if (zones.length) {
      this.#ui.createSelectRow("Номер зони", zones.map((_, index) => String(index + 1)), String(this.#index + 1), content,
        value => { this.#index = Number(value) - 1; this.#fill(); });
      this.#renderTree(zones[this.#index], content, [...path, this.#index]);
      this.#ui.createButtonRow("Видалити вибрану зону", content, () => {
        if (this.#category === "castable" && zones.length <= 1) return;
        this.#update(path, zones.filter((_, index) => index !== this.#index)); this.#fill();
      });
    }
    this.#ui.createButtonRow("Додати зону", content, () => {
      const zone = zones[this.#index] ? JSON.parse(JSON.stringify(zones[this.#index])) : { x: 0, y: 0, w: 1, h: 1 };
      if (this.#category === "dynamic") {
        let suffix = zones.length + 1;
        while (zones.some(existing => existing.id === `zone_${suffix}`)) suffix++;
        zone.id = `zone_${suffix}`;
      }
      this.#update(path, [...zones, zone]); this.#index = zones.length; this.#fill();
    });
    if (location.distanceProfile) {
      const profile = this.#createSection("Метри й перспектива", content);
      this.#renderTree(location.distanceProfile, profile, ["CONFIG", "locations", "map", id, "distanceProfile"]);
    }
    this.#ui.createInfoRow("Зберегти зміни", "Export overrides у RUNTIME OVERRIDES. Reset all overrides повертає конфігурацію.", content);
  }
}
