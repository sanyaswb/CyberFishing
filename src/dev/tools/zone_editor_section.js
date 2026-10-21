const CATEGORIES = Object.freeze(["castable", "collisions", "snags", "dynamic"]);
const LABELS = Object.freeze({ castable: "Закидання · зелений", collisions: "Перешкоди · червоний", snags: "Зачепи · жовтий", dynamic: "Рухомі · рожевий" });

// Composes existing DevTools controls; geometry edits go through the same validated runtime override path.
export class ZoneEditorSection {
  #ui; #state; #config; #createSection; #renderTree; #update;
  #category = "castable"; #index = 0; #details = null;
  #getMetric; #createMetric; #resetPerspective; #exportOverrides; #importOverrides;

  constructor({ ui, state, config, createSection, renderTree, updateConfig, getWaterMetric, createWaterMetric,
    resetPerspective, exportOverrides, importOverrides }) {
    this.#ui = ui; this.#state = state; this.#config = config; this.#createSection = createSection;
    this.#renderTree = renderTree; this.#update = updateConfig;
    this.#getMetric = getWaterMetric; this.#resetPerspective = resetPerspective;
    this.#createMetric = createWaterMetric;
    this.#exportOverrides = exportOverrides; this.#importOverrides = importOverrides;
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
    ui.createInfoRow("Сітка", "WaterMetric показує фізичні метри від берега. До 96 ліній на вісь; дрібний крок автоматично збільшується.", content);
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
    this.#renderPerspective(content, id, location);
  }

  #renderPerspective(parent, id) {
    const ui = this.#ui;
    const content = this.#createSection("Метри й перспектива", parent);
    const root = ["CONFIG", "locations", "map", id];
    const readLocation = () => this.#config.locations.map[id];
    ui.createInfoRow("Налаштування", "Дальність — точні метри від нижнього до верхнього краю зеленої зони. Нахил сплющує кола під фон: 90° — коло, 30° — половина висоти. Масштаб вдалині 0.3 означає 30% ближнього розміру; 1 — без зменшення. Сітка й вода завжди заповнюють всю зелену зону.", content);
    const status = ui.createInfoRow("Стан", "", content);
    const showStatus = () => {
      const metric = this.#getMetric?.();
      if (status && metric) status.innerText = "Вода: 0–" + Number(metric.topMeters.toFixed(2)) + " м. Нахил: " +
        (metric.tiltDegrees ?? 90) + "°. Розмір вдалині: " + Math.round(metric.surfaceScaleAt(metric.topY) * 100) + "%.";
    };
    const apply = (branch, key, value) => {
      const location = readLocation();
      const current = location[branch];
      const metric = this.#getMetric?.();
      const profile = { farScale: metric?.farScale, ...location.distanceProfile, ...(branch === "distanceProfile" ? { [key]: value } : {}) };
      const perspective = { ...location.perspective, ...(branch === "perspective" ? { [key]: value } : {}) };
      try {
        if (!Number.isFinite(profile.maxMeters) || profile.maxMeters <= 0 || !Number.isFinite(perspective.tiltDegrees) ||
          perspective.tiltDegrees < 1 || perspective.tiltDegrees > 90 || !Number.isFinite(profile.farScale) ||
          profile.farScale < .05 || profile.farScale > 1) throw new RangeError("Invalid projection");
        if (!metric) throw new Error("Water metric is not ready");
        this.#createMetric({ pixelsPerMeter: metric.pixelsPerMeter, shoreY: metric.shoreY, topY: metric.topY,
          maxMeters: profile.maxMeters, lateralExpansion: profile.lateralExpansion,
          tiltDegrees: perspective.tiltDegrees, farScale: profile.farScale });
      } catch {
        ui.syncValue([...root, branch, key], current[key]);
        if (status) status.innerText = "Не застосовано: дальність > 0 м, нахил 1–90°, масштаб вдалині 0.05–1. Значення мають бути скінченними.";
        return;
      }
      this.#update([...root, branch, key], value);
      showStatus();
    };
    const location = readLocation();
    for (const [branch, key, label, value] of [
      ["distanceProfile", "maxMeters", "Дальність води, м", location.distanceProfile.maxMeters],
      ["perspective", "tiltDegrees", "Нахил площини, °", location.perspective.tiltDegrees],
      ["distanceProfile", "farScale", "Масштаб вдалині", location.distanceProfile.farScale ?? this.#getMetric?.()?.farScale],
    ]) ui.createInputRow(label, value, content, "number", next => apply(branch, key, next), [...root, branch, key]);
    ui.createSwitcherRow("Звужувати сітку по ширині", location.distanceProfile.lateralExpansion === true, content,
      value => apply("distanceProfile", "lateralExpansion", value), [...root, "distanceProfile", "lateralExpansion"]);
    ui.createInfoRow("Ширина сітки", "Початково вимкнено: вертикальні лінії паралельні. Увімкнено: сітка додатково звужується вдалину. Зони й об’єкти зменшуються за параметром «Масштаб вдалині» в обох режимах.", content);
    ui.createInfoRow("Застосування", "Правки діють одразу. Нахил і масштаб не змінюють задану дальність води. Експорт копіює всі правки DEV у JSON.", content);
    if (this.#resetPerspective) ui.createButtonRow("Скинути перспективу цієї локації", content, () => { this.#resetPerspective(id); this.#fill(); });
    if (this.#exportOverrides) ui.createButtonRow("Експорт правок (усі налаштування DEV)", content, this.#exportOverrides);
    if (this.#importOverrides) ui.createButtonRow("Імпорт правок (усі налаштування DEV)", content, this.#importOverrides);
    showStatus();
  }
}
