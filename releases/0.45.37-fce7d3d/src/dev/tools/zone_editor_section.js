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

  #renderPerspective(parent, id, location) {
    const ui = this.#ui;
    const content = this.#createSection("Метри й перспектива", parent);
    const path = ["CONFIG", "locations", "map", id, "distanceProfile"];
    const anglePath = ["CONFIG", "locations", "map", id, "perspective"];
    const readAngles = () => this.#config.locations.map[id].perspective || { angleTop: 5, angleBottom: 60 };
    ui.createInfoRow("Кути", "Попередня логіка: синус сплющує області, тангенс зменшує їх із віддаленням. Кути задані на верхній і нижній межах safeZone локації.", content);
    ui.createInfoRow("Відстань і глибина", "Метри рахуються окремо від кутів. Дальній край — відстань уздовж води, не глибина водойми.", content);
    const status = ui.createInfoRow("Стан перспективи", "", content);
    const compile = profile => {
      const metric = this.#getMetric?.();
      if (!metric) throw new Error("Water metric is not ready");
      return this.#createMetric({ pixelsPerMeter: metric.pixelsPerMeter, shoreY: metric.shoreY, topY: metric.topY,
        maxMeters: profile.maxMeters, linearShare: profile.linearShare });
    };
    const showStatus = () => {
      const metric = this.#getMetric?.(), angles = readAngles();
      const profile = this.#config.locations.map[id].distanceProfile;
      if (status) status.innerText = `Кути ${angles.angleTop}° / ${angles.angleBottom}°. База двигуна: ${metric?.pixelsPerMeter ?? "—"} px = 1 м. ${profile?.enabled ? `Дальній край ${profile.maxMeters} м.` : "Профіль відстаней вимкнено."}`;
    };
    const reject = () => {
      const metric = this.#getMetric?.();
      const minimum = metric ? ((metric.shoreY - metric.topY) / metric.pixelsPerMeter).toFixed(2) : "—";
      if (status) status.innerText = `Не застосовано: перевірте частку (0–<1) і відстань (не менше ${minimum} м за базовим масштабом). Кут на цей мінімум не впливає.`;
    };
    for (const [key, label] of [["angleTop", "Кут верхнього краю, °"], ["angleBottom", "Нахил біля берега, °"]]) {
      ui.createInputRow(label, readAngles()[key], content, "number", value => {
        const previous = readAngles(), next = { ...previous, [key]: value };
        if (!Number.isFinite(value) || next.angleTop < 0 || next.angleTop > next.angleBottom || next.angleBottom < 1 || next.angleBottom > 90) {
          ui.syncValue([...anglePath, key], previous[key]);
          if (status) status.innerText = "Не застосовано: верхній кут має бути 0–90°, нижній — 1–90° і не меншим за верхній.";
          return;
        }
        this.#update(anglePath, next);
        for (const [name, angle] of Object.entries(next)) ui.syncValue([...anglePath, name], angle);
        showStatus();
      }, [...anglePath, key]);
    }
    const apply = (key, value) => {
      const current = this.#config.locations.map[id].distanceProfile;
      try {
        const next = { ...current, [key]: value };
        if (!Number.isFinite(next.maxMeters) || next.maxMeters <= 0) throw new RangeError("Invalid distance");
        if (key !== "enabled" || value !== false) compile(next);
      } catch { ui.syncValue([...path, key], current[key]); reject(); return; }
      this.#update([...path, key], value);
      showStatus();
    };
    const profile = location.distanceProfile;
    if (profile) {
      ui.createSwitcherRow("Профіль відстаней", profile.enabled, content, value => apply("enabled", value), [...path, "enabled"]);
      for (const [key, label] of [["maxMeters", "Від берега до дальнього краю, м"], ["linearShare", "Частка звичайної шкали (0–<1)"]]) {
        ui.createInputRow(label, profile[key], content, "number", value => apply(key, value), [...path, key]);
      }
    } else {
      ui.createButtonRow("Додати перспективу локації", content, () => {
        const metric = this.#getMetric?.();
        if (!metric) return;
        this.#update(path, { enabled: true, linearShare: 0, maxMeters: metric.topMeters }); this.#fill();
      });
    }
    ui.createInfoRow("Застосування", "Кути змінюють попередній візуальний масштаб; сітка показує фізичні метри. Автоматичного збільшення немає. Правки діють у цій сесії; експорт скопіює JSON.", content);
    if (this.#resetPerspective) ui.createButtonRow("Скинути перспективу цієї локації", content, () => { this.#resetPerspective(id); this.#fill(); });
    if (this.#exportOverrides) ui.createButtonRow("Експорт правок (усі налаштування DEV)", content, this.#exportOverrides);
    if (this.#importOverrides) ui.createButtonRow("Імпорт правок (усі налаштування DEV)", content, this.#importOverrides);
    showStatus();
  }
}
