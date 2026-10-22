import { WATER_PROJECTION_RANGES } from "../../game/domain/locations/illustrated_depth_profile.js";
import { ZONE_CATEGORY_COLORS, ZONE_PHYSICS_KEYS } from "../location/zone_category_colors.js";

const CATEGORIES = Object.freeze(["castable", "collisions", "snags", "dynamic"]);
const LABELS = Object.freeze({ castable: "Ігрова область (закидання)", collisions: "Перешкоди", snags: "Зачепи",
  dynamic: "Рухомі зони" });
const PHYSICS_KEYS = ZONE_PHYSICS_KEYS;
const OVERLAYS = Object.freeze([["showChumZones", "Зони прикормки"], ["showCatchZone", "Зона підведення"],
  ["showLastDashZone", "Зона останнього ривка"], ["showNetZone", "Зона підсаки"], ["showAimingZone", "Зона прицілювання"],
  ["showPoleFightSector", "Сектор виважування"], ["showFightLineRadius", "Радіус ліски"]]);
const CELL_SIZE = Object.freeze({ min: 5, max: 200 });

// The zone editor in DevTools (spec 129, Revision 2): Редактор (one switch), Зони (one list per category: the switch
// turns the zone's physics on, then its items appear), Сітка клітинок, Сітка перспективи and the game's overlays.
// Config edits go through the injected validated runtime override path; editor settings live in ZoneEditorState.
export class ZoneEditorSection {
  #ui; #state; #config; #createSection; #renderTree; #update;
  #lists = new Map();
  #perspective = null;
  #editable = null;
  #unsubscribe = null;
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
    const content = this.#createSection("🗺️ РЕДАКТОР ЗОН", parent, ["ZONE_EDITOR"]);
    this.#renderEditor(this.#createSection("Редактор", content, ["ZONE_EDITOR", "editor"]));
    const zones = this.#createSection("Зони", content, ["ZONE_EDITOR", "zones"]);
    this.#lists.clear();
    for (const category of CATEGORIES) {
      const list = this.#createSection(LABELS[category], zones, ["ZONE_EDITOR", "zones", category]);
      this.#lists.set(category, list);
      this.#fillCategory(category);
    }
    this.#renderCellGrid(this.#createSection("Сітка клітинок", content, ["ZONE_EDITOR", "cells"]));
    this.#perspective = this.#createSection("Сітка перспективи", content, ["ZONE_EDITOR", "perspective"]);
    this.#fillPerspective();
    this.#renderOverlays(this.#createSection("Оверлеї гри", content, ["ZONE_EDITOR", "overlays"]));
    this.#unsubscribe?.();
    this.#unsubscribe = this.#state.subscribeZonesEdited?.(() => this.#refreshZones()) ?? null;
  }

  #renderEditor(section) {
    const ui = this.#ui, state = this.#state;
    ui.createSwitcherRow("Увімкнути", state.enabled, section, (value) => {
      state.setFlag("enabled", value);
      ui.syncValue(["ZONE_EDITOR", "cellGrid"], state.cellGrid);
    }, ["ZONE_EDITOR", "enabled"]);
    this.#editable = this.#createSection("Зони для редагування", section, ["ZONE_EDITOR", "editable"]);
    this.#fillEditable();
    ui.createSwitcherRow("Показати фон (інакше чорний)", state.background, section,
      value => state.setFlag("background", value), ["ZONE_EDITOR", "background"]);
    ui.createInfoRow("Редактор", "Увімкнений редактор вмикає сітку клітинок і перетягування зон, позначених у «Зони для редагування»: у них рамка їхнього кольору, під курсором вони заливаються. Середина зони (30%) пересуває всю зону, край — змінює розмір (кут — два краї); усе прилипає до клітинок. Постійна заливка — «Показати зону» в списку категорії. Поки редактор увімкнено, гра не отримує дотиків, а її кнопки й вікна приховані; кнопки DevTools теж немає — підведіть курсор до лівого краю екрана або проведіть пальцем від нього вправо.", section);
  }

  // Revision 3 (R3-2): one switch per zone of every category whose physics is on; a checked zone is outlined, fills
  // under the pointer and is the only kind the drag tool takes.
  #fillEditable() {
    const list = this.#editable;
    if (!list) return;
    const ui = this.#ui, state = this.#state;
    ui.releaseValueBindings(list);
    list.replaceChildren();
    const location = this.#config.locations.map[this.#locationId()];
    let count = 0;
    for (const category of CATEGORIES) {
      if (this.#config.locations[PHYSICS_KEYS[category]] === false) continue;
      const zones = location?.zones?.[category] || [];
      for (let index = 0; index < zones.length; index++, count++) {
        const path = ["ZONE_EDITOR", "editable", category, String(index)];
        ui.createSwitcherRow(`${LABELS[category]} ${index + 1}`, state.isEditable(category, index), list,
          value => state.setEditable(category, index, value), path, path, { swatch: ZONE_CATEGORY_COLORS[category] });
      }
    }
    if (!count) ui.createInfoRow("Зони", "Немає зон з увімкненою фізикою.", list);
  }

  #refreshZones() {
    for (const category of CATEGORIES) this.#fillCategory(category);
    this.#fillEditable();
  }

  // One category's list: the physics switch first; the items only while the physics is on.
  #fillCategory(category) {
    const list = this.#lists.get(category);
    if (!list) return;
    const ui = this.#ui, state = this.#state;
    ui.releaseValueBindings(list);
    list.replaceChildren();
    const physicsPath = ["CONFIG", "locations", PHYSICS_KEYS[category]];
    const physicsOn = this.#config.locations[PHYSICS_KEYS[category]] !== false;
    ui.createSwitcherRow("Фізика зони", physicsOn, list, (value) => {
      this.#update(physicsPath, value);
      this.#fillCategory(category);
      this.#fillEditable();
    }, physicsPath, physicsPath, { swatch: ZONE_CATEGORY_COLORS[category] });
    if (!physicsOn) {
      ui.createInfoRow("Фізика", "Вимкнено: цих зон немає в грі й у редакторі. Увімкніть, щоб показати й редагувати їх.", list);
      return;
    }
    ui.createSwitcherRow("Показати зону", state.categories[category], list,
      value => state.setCategory(category, value), ["ZONE_EDITOR", "show", category]);
    const id = this.#locationId();
    const location = this.#config.locations.map[id];
    if (!location) return;
    const zones = location.zones?.[category] || [];
    const path = ["CONFIG", "locations", "map", id, "zones", category];
    const selected = state.selection.category === category;
    const index = selected ? Math.max(0, Math.min(state.selection.index, zones.length - 1)) : 0;
    if (zones.length) {
      ui.createSelectRow("Номер зони", zones.map((_, number) => String(number + 1)), String(index + 1), list,
        value => { this.#select(category, Number(value) - 1); });
      ui.createInfoRow("Координати", "x/y/w/h — клітинки designCellSize; bounds — пікселі карти. Без зон закидання закинути вудку не можна.", list);
      this.#renderTree(zones[index], list, [...path, index]);
      // Any zone can go, the last one too (TK-051); the refilled list then has no delete button.
      ui.createButtonRow("Видалити вибрану зону", list, () => {
        this.#state.zoneRemoved(category, index);
        this.#update(path, zones.filter((_, number) => number !== index));
        this.#select(category, Math.max(0, index - 1));
      });
    }
    ui.createButtonRow("Додати зону", list, () => {
      const zone = zones[index] ? JSON.parse(JSON.stringify(zones[index])) : { x: 0, y: 0, w: 1, h: 1 };
      if (category === "dynamic") {
        let suffix = zones.length + 1;
        while (zones.some(existing => existing.id === `zone_${suffix}`)) suffix++;
        zone.id = `zone_${suffix}`;
      }
      this.#update(path, [...zones, zone]);
      // A new zone is ready to drag (R3-2).
      this.#state.setEditable(category, zones.length, true);
      this.#select(category, zones.length);
    });
  }

  // Selecting a zone makes it the one the editor fills and drags; the lists it leaves and joins are rebuilt.
  #select(category, index) {
    const previous = this.#state.selection.category;
    this.#state.select(category, index);
    if (previous !== category) this.#fillCategory(previous);
    this.#fillCategory(category);
    this.#fillEditable();
  }

  #renderCellGrid(section) {
    const ui = this.#ui, state = this.#state, locations = this.#config.locations;
    ui.createSwitcherRow("Показати сітку", state.cellGrid, section, value => state.setFlag("cellGrid", value),
      ["ZONE_EDITOR", "cellGrid"]);
    ui.createRangeRow("Непрозорість сітки", state.cellGridOpacity * 100, section,
      value => state.setNumber("cellGridOpacity", value / 100), ["ZONE_EDITOR", "cellGridOpacity"]);
    const stepPath = ["ZONE_EDITOR", "cellLineStep"];
    ui.createInputRow("Крок ліній, клітинок", state.cellLineStep, section, "number", value => {
      state.setNumber("cellLineStep", value); ui.syncValue(stepPath, state.cellLineStep);
    }, stepPath);
    const snapPath = ["ZONE_EDITOR", "snapCells"];
    ui.createInputRow("Прилипання, клітинок", state.snapCells, section, "number", value => {
      state.setNumber("snapCells", value); ui.syncValue(snapPath, state.snapCells);
    }, snapPath);
    const cellPath = ["CONFIG", "locations", "cellSize"];
    ui.createInputRow("Розмір клітинки, px", locations.cellSize, section, "number", value => {
      const next = Math.round(Math.max(CELL_SIZE.min, Math.min(CELL_SIZE.max, Number(value) || locations.cellSize)));
      ui.syncValue(cellPath, next);
      if (next !== locations.cellSize) this.#update(cellPath, next);
    }, cellPath);
    const design = Number(locations.designCellSize) || locations.cellSize;
    ui.createInfoRow("Клітинки", `Розмір клітинки — сітка мапи гри (${CELL_SIZE.min}–${CELL_SIZE.max} px): зміна перебудовує клітинки й глибини. Зони задані в клітинках дизайну ${design} px, множник ${(locations.cellSize / design).toFixed(2)}. Крок ліній — кожна N-та лінія; прилипання — на скільки клітинок пересувається край.`, section);
    ui.createSwitcherRow("Глибина в клітинках", state.depth, section, value => state.setFlag("depth", value),
      ["ZONE_EDITOR", "depth"]);
    ui.createRangeRow("Непрозорість глибини", state.depthOpacity * 100, section,
      value => state.setNumber("depthOpacity", value / 100), ["ZONE_EDITOR", "depthOpacity"]);
  }

  #fillPerspective() {
    const content = this.#perspective;
    if (!content) return;
    const ui = this.#ui, state = this.#state, ranges = WATER_PROJECTION_RANGES;
    ui.releaseValueBindings(content);
    content.replaceChildren();
    const id = this.#locationId();
    const path = ["CONFIG", "locations", "map", id, "waterProjection"];
    const readProjection = () => this.#config.locations.map[id]?.waterProjection;
    const valueOf = (projection, key) => projection[key] ?? ranges[key]?.default;
    ui.createSwitcherRow("Показати сітку", state.grid, content, value => state.setFlag("grid", value), ["ZONE_EDITOR", "grid"]);
    const projection = readProjection();
    ui.createSwitcherRow("Фізика перспективи", !!projection, content, (value) => {
      if (value && !readProjection()) {
        const metric = this.#getMetric?.();
        if (!metric) return;
        this.#update(path, { maxMeters: metric.topMeters, tiltDegrees: ranges.tiltDegrees.default,
          farScale: ranges.farScale.default, lateralContraction: ranges.lateralContraction.default });
      } else if (!value && readProjection()) {
        this.#update(path, null);
      }
      this.#fillPerspective();
    }, ["ZONE_EDITOR", "projectionPhysics"]);
    const spacingPath = ["ZONE_EDITOR", "spacingMeters"];
    ui.createInputRow("Крок сітки, м", state.spacingMeters, content, "number", value => {
      state.setSpacing(value); ui.syncValue(spacingPath, state.spacingMeters);
    }, spacingPath);
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
    if (projection) {
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
    }
    ui.createInfoRow("Перспектива", "Фізика перспективи: увімкнено — метри води рахуються з дальністю, нахилом і масштабом вдалині; вимкнено — вода рівномірна. Дальність — точні метри від нижнього до верхнього краю зеленої зони; нахил сплющує кола (90° — коло); масштаб вдалині 0.3 — 30% ближнього розміру; звуження по ширині — вертикальні лінії сходяться вдалину. Правки діють одразу.", content);
    if (this.#resetPerspective) ui.createButtonRow("Скинути перспективу цієї локації", content, () => { this.#resetPerspective(id); this.#fillPerspective(); });
    if (this.#exportOverrides) ui.createButtonRow("Експорт правок (усі налаштування DEV)", content, this.#exportOverrides);
    if (this.#importOverrides) ui.createButtonRow("Імпорт правок (усі налаштування DEV)", content, this.#importOverrides);
    showStatus();
  }

  #renderOverlays(section) {
    this.#configSwitch(section, "debugVisuals", "Показувати оверлеї гри");
    for (const [key, label] of OVERLAYS) this.#configSwitch(section, key, label, { defaultOn: true });
    this.#ui.createInfoRow("Оверлеї", "Перший перемикач гасить усі оверлеї гри. Фізику не змінюють; зони снасті й виважування показуються після закидання.", section);
  }

  // A switch over CONFIG.locations.<key> through the validated runtime override path.
  #configSwitch(parent, key, label, { swatch = null, defaultOn = false } = {}) {
    const path = ["CONFIG", "locations", key];
    const value = this.#config.locations[key];
    this.#ui.createSwitcherRow(label, defaultOn ? value !== false : value === true, parent,
      next => this.#update(path, next), path, path, { swatch });
  }

  #locationId() {
    return this.#state.locationId || this.#config.locations.currentLocationId || Object.keys(this.#config.locations.map)[0];
  }
}
