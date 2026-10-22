import { WATER_PROJECTION_RANGES } from "../../game/domain/locations/illustrated_depth_profile.js";
import { ZONE_CATEGORY_COLORS } from "../location/zone_category_colors.js";

const CATEGORIES = Object.freeze(["castable", "collisions", "snags", "dynamic"]);
const LABELS = Object.freeze({ castable: "Закидання · зелений", collisions: "Перешкоди · червоний", snags: "Зачепи · жовтий", dynamic: "Рухомі · рожевий" });

// Composes existing DevTools controls; geometry edits go through the same validated runtime override path.
export class ZoneEditorSection {
  #ui; #state; #config; #createSection; #renderTree; #update;
  #details = null; #unsubscribe = null;
  #getMetric; #createMetric; #resetPerspective; #exportOverrides; #importOverrides;

  constructor({ ui, state, config, createSection, renderTree, updateConfig, getWaterMetric, createWaterMetric,
    resetPerspective, exportOverrides, importOverrides }) {
    this.#ui = ui; this.#state = state; this.#config = config; this.#createSection = createSection;
    this.#renderTree = renderTree; this.#update = updateConfig;
    this.#getMetric = getWaterMetric; this.#resetPerspective = resetPerspective;
    this.#createMetric = createWaterMetric;
    this.#exportOverrides = exportOverrides; this.#importOverrides = importOverrides;
  }

  // One place for zones (spec 129 D3): the editor, its categories, the gameplay zone switches, the game overlays,
  // the location debug map, then the selected zone's geometry and the water's metres and perspective.
  render(parent) {
    const ui = this.#ui, state = this.#state;
    const content = this.#createSection("🗺️ РЕДАКТОР ЗОН", parent, ["ZONE_EDITOR"]);
    const editor = this.#createSection("Редактор", content, ["ZONE_EDITOR", "editor"]);
    for (const [key, label] of [["enabled", "Показати редактор"], ["background", "Показати фон (інакше чорний)"],
      ["grid", "Метрова сітка"], ["cellGrid", "Сітка клітинок мапи"], ["dragEdit", "Перетягувати межі обраної зони"]]) {
      ui.createSwitcherRow(label, state[key], editor, value => state.setFlag(key, value));
    }
    const spacingPath = ["ZONE_EDITOR", "spacingMeters"];
    ui.createInputRow("Мін. крок сітки, м", state.spacingMeters, editor, "number", value => {
      state.setSpacing(value); ui.syncValue(spacingPath, state.spacingMeters);
    }, spacingPath);
    ui.createInfoRow("Сітка", "Метрова сітка — фізичні метри води від берега (до 96 ліній на вісь; дрібний крок збільшується). Сітка клітинок — клітинки мапи, до яких прилипають межі зон.", editor);
    ui.createInfoRow("Перетягування", "Увімкніть і перетягніть мишею чи пальцем край обраної зони (кут — два краї). Край прилипає до клітинок, мінімум одна клітинка; адаптивні за шириною зони — лише верх і низ. Поки увімкнено, гра не отримує дотиків.", editor);

    const categories = this.#createSection("Категорії в редакторі", content, ["ZONE_EDITOR", "categories"]);
    for (const category of CATEGORIES) {
      ui.createSwitcherRow(LABELS[category], state.categories[category], categories,
        value => state.setCategory(category, value), null, null, { swatch: ZONE_CATEGORY_COLORS[category] });
    }
    ui.createInfoRow("Видимість", "Лише показ у редакторі: фізику зон не змінюють.", categories);

    const game = this.#createSection("Зони в грі", content, ["ZONE_EDITOR", "gameZones"]);
    for (const [key, category, label] of [["enableCastable", "castable", "Закидання"], ["enableCollisions", "collisions", "Перешкоди"],
      ["enableSnags", "snags", "Зачепи"], ["enableDynamicZones", "dynamic", "Рухомі зони"]]) {
      this.#configSwitch(game, key, label, { swatch: ZONE_CATEGORY_COLORS[category] });
    }
    ui.createInfoRow("Геймплей", "Ці перемикачі вмикають і вимикають зони в самій грі: закидання, колізії, зачепи, рухомі косяки.", game);

    const overlays = this.#createSection("Оверлеї гри", content, ["ZONE_EDITOR", "overlays"]);
    for (const [key, label] of [["showChumZones", "Зони прикормки"], ["showCatchZone", "Зона підведення"],
      ["showLastDashZone", "Зона останнього ривка"], ["showNetZone", "Зона підсаки"], ["showAimingZone", "Зона прицілювання"],
      ["showPoleFightSector", "Сектор виважування"], ["showFightLineRadius", "Радіус ліски"]]) {
      this.#configSwitch(overlays, key, label, { defaultOn: true });
    }
    ui.createInfoRow("Видимість", "Не змінюють фізику. Зони снасті й виважування показуються після закидання.", overlays);

    const debugMap = this.#createSection("Налагоджувальна карта", content, ["ZONE_EDITOR", "debugMap"]);
    for (const [key, label] of [["debugVisuals", "Головний вимикач оверлеїв"], ["debugZones", "Заливка зон і рухомі зони"],
      ["debugGrid", "Сітка клітинок"], ["debugDepthText", "Глибина в клітинках"]]) {
      this.#configSwitch(debugMap, key, label);
    }
    const opacityPath = ["CONFIG", "locations", "debugOpacity"];
    ui.createInputRow("Прозорість карти", this.#config.locations.debugOpacity ?? 0.7, debugMap, "number",
      value => this.#update(opacityPath, Math.max(0, Math.min(1, value))), opacityPath);
    ui.createInfoRow("Карта", "Малюється поверх води, також під відкритим редактором. Головний вимикач гасить і оверлеї виважування в грі.", debugMap);

    const selection = state.selection;
    ui.createSelectRow("Категорія зони", CATEGORIES, selection.category, content, value => {
      state.select(value, 0); this.#fill();
    }, null, { swatches: ZONE_CATEGORY_COLORS });
    this.#details = this.#createSection("Геометрія й перспектива", content, ["ZONE_EDITOR", "geometry"]);
    this.#unsubscribe?.();
    this.#unsubscribe = state.subscribeZonesEdited?.(() => this.#fill()) ?? null;
    this.#fill();
  }

  // A switch over CONFIG.locations.<key> through the validated runtime override path.
  #configSwitch(parent, key, label, { swatch = null, defaultOn = false } = {}) {
    const path = ["CONFIG", "locations", key];
    const value = this.#config.locations[key];
    this.#ui.createSwitcherRow(label, defaultOn ? value !== false : value === true, parent,
      next => this.#update(path, next), path, path, { swatch });
  }

  #fill() {
    const content = this.#details;
    this.#ui.releaseValueBindings(content);
    content.replaceChildren();
    const id = this.#state.locationId || this.#config.locations.currentLocationId || Object.keys(this.#config.locations.map)[0];
    const location = this.#config.locations.map[id];
    if (!location) return;
    const { category } = this.#state.selection;
    const zones = location.zones?.[category] || [];
    this.#state.select(category, Math.max(0, Math.min(this.#state.selection.index, zones.length - 1)));
    const index = this.#state.selection.index;
    this.#ui.createInfoRow("Локація", id, content);
    this.#ui.createInfoRow("Координати", "x/y/w/h — клітинки designCellSize; bounds — пікселі карти. Останню зону закидання видалити не можна.", content);
    const path = ["CONFIG", "locations", "map", id, "zones", category];
    if (zones.length) {
      this.#ui.createSelectRow("Номер зони", zones.map((_, number) => String(number + 1)), String(index + 1), content,
        value => { this.#state.select(category, Number(value) - 1); this.#fill(); });
      this.#renderTree(zones[index], content, [...path, index]);
      this.#ui.createButtonRow("Видалити вибрану зону", content, () => {
        if (category === "castable" && zones.length <= 1) return;
        this.#update(path, zones.filter((_, number) => number !== index)); this.#fill();
      });
    }
    this.#ui.createButtonRow("Додати зону", content, () => {
      const zone = zones[index] ? JSON.parse(JSON.stringify(zones[index])) : { x: 0, y: 0, w: 1, h: 1 };
      if (category === "dynamic") {
        let suffix = zones.length + 1;
        while (zones.some(existing => existing.id === `zone_${suffix}`)) suffix++;
        zone.id = `zone_${suffix}`;
      }
      this.#update(path, [...zones, zone]); this.#state.select(category, zones.length); this.#fill();
    });
    this.#renderPerspective(content, id);
  }

  #renderPerspective(parent, id) {
    const ui = this.#ui, ranges = WATER_PROJECTION_RANGES;
    const content = this.#createSection("Метри й перспектива", parent);
    const path = ["CONFIG", "locations", "map", id, "waterProjection"];
    const readProjection = () => this.#config.locations.map[id].waterProjection;
    const valueOf = (projection, key) => projection[key] ?? ranges[key]?.default;
    ui.createInfoRow("Налаштування", "Дальність — точні метри від нижнього до верхнього краю зеленої зони. Нахил сплющує кола під фон: 90° — коло, 30° — половина висоти. Масштаб вдалині 0.3 означає 30% ближнього розміру; 1 — без зменшення. Сітка й вода завжди заповнюють всю зелену зону.", content);
    const status = ui.createInfoRow("Стан", "", content);
    const showStatus = () => {
      const metric = this.#getMetric?.();
      if (!status || !metric) return;
      const near = metric.shoreY, far = metric.topY, round = value => Number(value.toFixed(1));
      status.innerText = metric.isUniform
        ? "Вода рівномірна: 0–" + round(metric.topMeters) + " м, " + metric.pixelsPerMeter + " px = 1 м по всій зоні, кола без сплющення."
        : "Вода: 0–" + Number(metric.topMeters.toFixed(2)) + " м. Нахил: " + metric.tiltDegrees + "°. Розмір вдалині: " +
          Math.round(metric.surfaceScaleAt(far) * 100) + "%. Px на 1 м уздовж / упоперек: біля берега " +
          round(metric.pixelsPerMeterY(near)) + " / " + round(metric.pixelsPerMeterX(near)) + ", вдалині " +
          round(metric.pixelsPerMeterY(far)) + " / " + round(metric.pixelsPerMeterX(far)) + ".";
    };
    const projection = readProjection();
    if (!projection) {
      ui.createButtonRow("Додати перспективу води", content, () => {
        const metric = this.#getMetric?.();
        if (!metric) return;
        this.#update(path, { maxMeters: metric.topMeters, tiltDegrees: ranges.tiltDegrees.default,
          farScale: ranges.farScale.default, lateralContraction: ranges.lateralContraction.default });
        this.#fill();
      });
    } else {
      const apply = (key, value) => {
        const current = readProjection(), metric = this.#getMetric?.();
        try {
          if (!metric) throw new Error("Water metric is not ready");
          // The production factory validates; the editor keeps no copy of the ranges.
          this.#createMetric({ pixelsPerMeter: metric.pixelsPerMeter, shoreY: metric.shoreY, topY: metric.topY,
            ...current, [key]: value });
        } catch {
          ui.syncValue([...path, key], valueOf(current, key));
          if (status) status.innerText = "Не застосовано: дальність > 0 м, нахил " + ranges.tiltDegrees.min + "–" +
            ranges.tiltDegrees.max + "°, масштаб вдалині " + ranges.farScale.min + "–" + ranges.farScale.max +
            ". Значення мають бути скінченними.";
          return;
        }
        this.#update([...path, key], value);
        showStatus();
      };
      for (const [key, label] of [["maxMeters", "Дальність води, м"], ["tiltDegrees", "Нахил площини, °"],
        ["farScale", "Масштаб вдалині"]]) {
        ui.createInputRow(label, valueOf(projection, key), content, "number", next => apply(key, next), [...path, key]);
      }
      ui.createSwitcherRow("Звужувати сітку по ширині", valueOf(projection, "lateralContraction") === true, content,
        value => apply("lateralContraction", value), [...path, "lateralContraction"]);
      ui.createInfoRow("Ширина сітки", "Початково вимкнено: вертикальні лінії паралельні. Увімкнено: сітка додатково звужується вдалину. Зони й об’єкти зменшуються за параметром «Масштаб вдалині» в обох режимах.", content);
    }
    ui.createInfoRow("Застосування", "Правки діють одразу. Нахил і масштаб не змінюють задану дальність води. Експорт копіює всі правки DEV у JSON.", content);
    if (this.#resetPerspective) ui.createButtonRow("Скинути перспективу цієї локації", content, () => { this.#resetPerspective(id); this.#fill(); });
    if (this.#exportOverrides) ui.createButtonRow("Експорт правок (усі налаштування DEV)", content, this.#exportOverrides);
    if (this.#importOverrides) ui.createButtonRow("Імпорт правок (усі налаштування DEV)", content, this.#importOverrides);
    showStatus();
  }
}
