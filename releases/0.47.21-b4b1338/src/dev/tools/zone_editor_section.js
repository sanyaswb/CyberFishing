import { WATER_PROJECTION_RANGES } from "../../game/domain/locations/illustrated_depth_profile.js";
import { ZONE_CATEGORY_COLORS, ZONE_PHYSICS_KEYS } from "../location/zone_category_colors.js";
import { DEPENDENT_ZONES } from "../location/castable_dependent_zones.js";
import { snapZonesToGrid } from "../location/zone_grid_snap.js";
import { zoneCellSizeWarning, zoneCellSizes } from "../location/zone_cell_sizes.js";
import { buildZoneFile, canonicalZones, changedCategories, validateZoneFile, zoneFileName, zoneHash }
  from "../location/zone_export_format.js";

const CATEGORIES = Object.freeze(["castable", "collisions", "snags", "dynamic"]);
const LABELS = Object.freeze({ castable: "Ігрова область (закидання)", collisions: "Перешкоди", snags: "Зачепи",
  dynamic: "Рухомі зони" });
const PHYSICS_KEYS = ZONE_PHYSICS_KEYS;
// Spec 136 (Revision 2): the show switches of the zones inside the castable area, in "Зони риболовлі".
const FISHING_SHOW_LABELS = Object.freeze({ handChum: "Зона ручної прикормки", net: "Показати зону підсаки",
  lastDash: "Показати зону останнього ривка", catch: "Показати зону підведення", sector: "Показати сектор виважування",
  line: "Показати радіус ліски", chum: "Показати зони прикормки" });
const CELL_SIZE = Object.freeze({ min: 5, max: 200 });
// TK-089, TK-090: the last option of a zone number list takes every zone.
const ALL_ZONES = "Всі";

// The location editor in DevTools (spec 129, spec 130): Локація first — everything below works on the chosen
// location — then the editor and shared cell-grid controls directly, Зони (one list per category: the switch turns the
// zone's physics on, then its items appear), Сітка перспективи, Збереження (the location's zone file).
// The game's overlays measured from the castable area live in its list (spec 136). Config
// edits go through the injected validated runtime override path; editor settings live in ZoneEditorState.
export class ZoneEditorSection {
  #ui; #state; #config; #createSection; #renderTree; #update;
  #lists = new Map();
  #location = null;
  #perspective = null;
  #fishing = null;
  #newDynamicShape = "square";
  #snapSources = new Map();
  #editAllRestore = null;
  #root = null;
  #maskEditor;
  #drawing;

  #saving = null;
  #savingStatus = null;
  #unsubscribe = null;
  #getMetric; #createMetric; #resetPerspective;
  #files; #getBaseZones; #resetZones; #gameVersion; #readDynamicZones; #getDependentZones;

  // files: ZoneEditorBrowserPort (download, pickFile, confirm, openLocation, hashText); getBaseZones(id): the zones in
  // the code (before session overrides); resetZones(id): drops the session's zone overrides of a location.
  constructor({ ui, state, config, createSection, renderTree, updateConfig, getWaterMetric, createWaterMetric,
    resetPerspective, files = null, getBaseZones = null, resetZones = null, gameVersion = "", readDynamicZones = null,
    getDependentZones = null, maskEditor = null, zoneDrawing = null }) {
    this.#ui = ui; this.#state = state; this.#config = config; this.#createSection = createSection;
    this.#renderTree = renderTree; this.#update = updateConfig;
    this.#getMetric = getWaterMetric; this.#resetPerspective = resetPerspective;
    this.#createMetric = createWaterMetric;
    this.#readDynamicZones = readDynamicZones;
    this.#getDependentZones = getDependentZones;
    this.#maskEditor = maskEditor;
    this.#drawing = zoneDrawing;
    this.#files = files; this.#getBaseZones = getBaseZones; this.#resetZones = resetZones; this.#gameVersion = gameVersion;
  }

  render(parent) {
    const content = this.#createSection("🗺️ РЕДАКТОР", parent, ["ZONE_EDITOR"]);
    this.#root = content;
    if (!this.#state.locationId) this.#state.setLocation(this.#locationId());
    this.#location = this.#ui.createControlGroup(content, ["ZONE_EDITOR", "location"]);
    this.#fillLocation();
    this.#renderEditor(content);
    const zones = this.#createSection("Зони", content, ["ZONE_EDITOR", "zones"]);
    this.#renderEditingControls(zones);
    this.#ui.createSwitcherRow("Показати всі", this.#allZonesShown(), zones, value => {
      for (const category of CATEGORIES) {
        this.#state.setCategory(category, value);
        this.#ui.syncValue(["ZONE_EDITOR", "show", category], this.#state.categories[category]);
      }
      this.#syncAllZonesShown();
    }, ["ZONE_EDITOR", "showAll"]);
    this.#lists.clear();
    for (const category of CATEGORIES) {
      const list = this.#createSection(LABELS[category], zones, ["ZONE_EDITOR", "zones", category]);
      this.#lists.set(category, list);
      this.#fillCategory(category);
    }
    this.#fishing = this.#createSection("Зони риболовлі", zones, ["ZONE_EDITOR", "fishing"]);
    this.#fillFishing();
    this.#perspective = this.#createSection("Сітка перспективи", content, ["ZONE_EDITOR", "perspective"]);
    this.#fillPerspective();
    this.#saving = this.#createSection("Збереження", content, ["ZONE_EDITOR", "saving"]);
    this.#fillSaving();
    this.#unsubscribe?.();
    this.#unsubscribe = this.#state.subscribeZonesEdited?.(() => this.#refreshZones()) ?? null;
  }

  dispose({ preserveDraft = false } = {}) {
    if (!preserveDraft) this.#maskEditor?.stop();
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  // D1/D2: the location select; the editor draws on the map only for the location on screen, another one is opened
  // by reloading the DEV page with it, after a warning when zone edits would be lost.
  #fillLocation() {
    const list = this.#location;
    if (!list) return;
    const ui = this.#ui, state = this.#state, maps = this.#config.locations.map;
    ui.releaseValueBindings(list);
    list.replaceChildren();
    const ids = Object.keys(maps);
    const labelOf = id => `${maps[id]?.name || id} (${id})`;
    ui.createSelectRow("Локація", ids.map(labelOf), labelOf(state.locationId), list, (label) => {
      const id = ids.find(candidate => labelOf(candidate) === label);
      if (!id || id === state.locationId) return;
      state.setLocation(id);
      this.#refreshLocation();
    }, ["ZONE_EDITOR", "locationId"]);
    const loaded = state.loadedLocationId;
    if (!loaded || state.editsLoadedLocation) return;
    ui.createInfoRow("На екрані", `На екрані: ${labelOf(loaded)}. Відкрийте цю локацію, щоб редагувати на мапі.`, list);
    if (this.#files) ui.createButtonRow("Відкрити локацію", list, () => this.#openLocation(state.locationId));
  }

  #openLocation(id) {
    const unsaved = Object.keys(this.#config.locations.map).some(location => this.#changedCategories(location).length);
    if (unsaved && !this.#files.confirm("Незбережені зміни зон буде втрачено. Експортуйте їх спочатку. Продовжити?")) return;
    this.#files.openLocation(id);
  }

  // Everything that belongs to the chosen location is rebuilt for it.
  #refreshLocation() {
    this.#fillLocation();
    this.#refreshZones();
    this.#fillPerspective();
    this.#fillSaving();
  }

  // D5: the chosen location's zone file — export, import into the session, reset to the code, and a status line.
  #fillSaving() {
    const list = this.#saving;
    if (!list) return;
    const ui = this.#ui;
    ui.releaseValueBindings(list);
    list.replaceChildren();
    this.#savingStatus = ui.createInfoRow("Стан зон", "", list);
    this.#showSavingStatus();
    if (this.#files) {
      ui.createButtonRow("Експорт зон", list, () => { void this.#exportZones(); });
      ui.createButtonRow("Імпорт зон", list, () => { void this.#importZones(); });
    }
    if (this.#resetZones) ui.createButtonRow("Скинути зміни зон до коду", list, () => {
      this.#resetZones(this.#locationId());
      this.#state.clearZoneMarks();
      this.#refreshZones();
    });
    ui.createInfoRow("Збереження", "Експорт зон завантажує файл зон цієї локації. У код його переносить команда npm run apply:zones -- <файл> (перевірка, конфлікти, підтвердження, бекап); після неї перезавантажте сторінку або скиньте зміни зон до коду. Імпорт зон відкриває такий файл тут, щоб продовжити редагування. Без експорту зміни зникають при перезавантаженні.", list);
  }

  #changedCategories(id) {
    const base = this.#getBaseZones?.(id);
    return base ? changedCategories(base, this.#config.locations.map[id]?.zones) : [];
  }

  #showSavingStatus(message = null) {
    const status = this.#savingStatus;
    if (!status) return;
    if (message) { status.innerText = message; return; }
    const changed = this.#changedCategories(this.#locationId());
    status.innerText = changed.length
      ? `Змінено (ще не в коді): ${changed.map(category => LABELS[category]).join(", ")}.`
      : "Зони збігаються з кодом.";
  }

  async #exportZones() {
    const id = this.#locationId(), locations = this.#config.locations;
    try {
      const baseHash = await zoneHash(this.#getBaseZones?.(id) || {}, text => this.#files.hashText(text));
      const file = buildZoneFile({ locationId: id, zones: locations.map[id]?.zones, baseHash, gameVersion: this.#gameVersion,
        locations, exportedAt: new Date().toISOString() });
      const name = zoneFileName(id, this.#gameVersion, new Date());
      this.#files.download(name, `${JSON.stringify(file, null, 2)}\n`);
      this.#showSavingStatus(`Збережено файл ${name}.`);
    } catch (error) {
      this.#showSavingStatus(`Експорт не вдався: ${error?.message || error}`);
    }
  }

  async #importZones() {
    const text = await this.#files.pickFile();
    if (text === null) return;
    const id = this.#locationId();
    let file;
    try { file = JSON.parse(text); } catch { this.#showSavingStatus("Файл не є JSON."); return; }
    if (file?.locationId && file.locationId !== id) {
      this.#showSavingStatus(`Файл для локації ${file.locationId}; оберіть її у списку «Локація».`);
      return;
    }
    const errors = validateZoneFile(file, this.#config.locations);
    if (errors.length) { this.#showSavingStatus(`Файл не прийнято: ${errors.slice(0, 3).join("; ")}`); return; }
    this.#update(["CONFIG", "locations", "map", id, "zones"], canonicalZones(file.zones));
    this.#state.clearZoneMarks();
    this.#refreshZones();
  }

  #renderEditor(section) {
    const ui = this.#ui, state = this.#state;
    ui.createSwitcherRow("Увімкнути редагування", state.enabled, section, (value) => {
      state.setFlag("enabled", value);
      this.#syncGrids();
      this.#refreshZones();
    }, ["ZONE_EDITOR", "enabled"]);
    ui.createSwitcherRow("Редагувати все", this.#editAllRestore !== null, section, value => {
      this.#editEverything(value); this.#ui.syncValue(["ZONE_EDITOR", "editEverything"], this.#editAllRestore !== null);
    }, ["ZONE_EDITOR", "editEverything"]);
    ui.createSwitcherRow("Показати фон (інакше чорний)", state.background, section,
      value => state.setFlag("background", value), ["ZONE_EDITOR", "background"]);
    this.#renderCellGrid(section);
    ui.createInfoRow("Редактор", "Увімкнений редактор вмикає сітку клітинок і перетягування зон, категорій, увімкнених у «Зони → Редагувати …»: у них рамка їхнього кольору, hover і перетягування працюють лише для вибраного «Номера зони» у відповідній категорії. Інший номер спочатку оберіть у списку. Середина зони (30%) пересуває всю зону, край — змінює розмір (кут — два краї); краї й статичні зони прилипають до клітинок, переміщення рухомого тіла плавне. Постійна заливка — «Показати зону» в списку категорії. Поки редактор увімкнено, гра не отримує дотиків, а її кнопки й вікна приховані; кнопки DevTools теж немає — підведіть курсор до лівого краю екрана або проведіть пальцем від нього вправо.", section);
  }

  #renderEditingControls(parent) {
    const labels = { castable: "Редагувати ігрову", collisions: "Редагувати перешкоди", snags: "Редагувати зачепи", dynamic: "Редагувати рухомі" };
    for (const category of CATEGORIES) {
      const path = ["ZONE_EDITOR", "editing", category];
      this.#ui.createSwitcherRow(labels[category], this.#state.isEditable(category), parent, value => {
        this.#state.setEditing(category, value);
        if (value) this.#snapToGrid([category]);
        this.#syncEditingControls();
        this.#refreshZones();
      }, path, path, { swatch: ZONE_CATEGORY_COLORS[category], requires: this.#categoryPrerequisites([category]) });
    }
    const path = ["ZONE_EDITOR", "editAll"];
    this.#ui.createSwitcherRow("Редагувати всі", CATEGORIES.every(category => this.#state.isEditable(category)), parent, value => {
      for (const category of CATEGORIES) this.#state.setEditing(category, value);
      if (value) this.#snapToGrid(CATEGORIES);
      this.#syncEditingControls();
      this.#refreshZones();
    }, path, path, { requires: this.#categoryPrerequisites(CATEGORIES) });
  }

  // TK-087, spec 141 Revision 2: «Редагувати все» is a switch. On: every editing switch that is off goes on, with the
  // parents it needs (spec 131 prerequisites): the editor, each category's physics and editing, hand chum's far line, the
  // chum zones and the conditional float with the game switches that show them. Off: exactly what it turned on goes back.
  #editEverything(on) {
    if (!on) {
      const restore = this.#editAllRestore ?? [];
      this.#editAllRestore = null;
      for (const undo of restore.reverse()) undo();
      this.#refreshZones();
      this.#fillFishing();
      return;
    }
    if (this.#editAllRestore) return;
    const restore = this.#editAllRestore = [];
    const state = this.#state, locations = this.#config.locations, dependent = this.#getDependentZones?.() ?? null;
    const setConfig = key => {
      if (locations[key] === true) return;
      const previous = locations[key] === true;
      this.#update(["CONFIG", "locations", key], true);
      restore.push(() => this.#update(["CONFIG", "locations", key], previous));
    };
    const setFlag = (read, write) => {
      const previous = read();
      if (previous) return;
      write(true);
      restore.push(() => write(previous));
    };
    setFlag(() => state.enabled, value => { state.setFlag("enabled", value); this.#ui.syncValue(["ZONE_EDITOR", "enabled"], value); this.#syncGrids(); });
    for (const category of CATEGORIES) {
      if (locations[PHYSICS_KEYS[category]] === false) setConfig(PHYSICS_KEYS[category]);
      setFlag(() => state.isEditable(category), value => state.setEditing(category, value));
    }
    this.#snapToGrid(CATEGORIES);
    if (dependent) {
      if (!dependent.isShown("handChum")) setConfig("showAimingZone");
      setFlag(() => dependent.editingChumLine, value => dependent.setEditingChumLine(value));
      if (!dependent.isShown("chum")) setConfig("showChumZones");
      setFlag(() => dependent.chumZones.isEditing, value => dependent.chumZones.setEditing(value));
      setConfig("debugVisuals");
      if (!dependent.isShown("sector") && !dependent.isShown("line")) setConfig("showPoleFightSector");
      setFlag(() => dependent.movingFloat, value => dependent.setMovingFloat(value));
    }
    this.#refreshZones();
    this.#fillFishing();
  }

  // TK-082: the edited categories' zones move onto the current grid (whole map cells), so after a grid change they sit in
  // the new squares and snap to them; zones of categories not being edited keep their exact geometry (spec 137).
  // TK-085: snapping starts from the zones as they were before it, while nothing else has changed them since, so a
  // coarse grid (160 px) that grew a zone to one cell gives the shape back on a finer grid; any other edit (drag,
  // import, reset) makes the current zones the new source.
  #snapToGrid(categories) {
    const locations = this.#config.locations, id = this.#locationId(), zones = locations.map[id]?.zones;
    if (!zones) return;
    const design = Number(locations.designCellSize) || locations.cellSize, step = locations.cellSize / design;
    const map = { w: locations.baseResolution.width / design, h: locations.baseResolution.height / design };
    for (const category of categories) {
      if (!this.#state.isEditable(category) || locations[PHYSICS_KEYS[category]] === false) continue;
      const key = `${id}/${category}`, current = zones[category], record = this.#snapSources.get(key);
      const source = record && record.written === JSON.stringify(current) ? record.source : current;
      const next = snapZonesToGrid(source, category, step, map) ?? source;
      const written = JSON.stringify(next);
      this.#snapSources.set(key, { source, written });
      if (written !== JSON.stringify(current)) this.#update(["CONFIG", "locations", "map", id, "zones", category], next);
    }
  }

  #showGridWarning(sizes) {
    const locations = this.#config.locations;
    this.#files?.showWarning?.(zoneCellSizeWarning(locations.baseResolution, sizes, locations.cellSize, CELL_SIZE));
  }

  #categoryPrerequisites(categories) {
    return [...this.#editingPrerequisites(), ...categories.map(category => ({
      path: ["CONFIG", "locations", PHYSICS_KEYS[category]],
      isEnabled: () => this.#config.locations[PHYSICS_KEYS[category]] !== false,
    }))];
  }

  #syncEditingControls() {
    for (const category of CATEGORIES) this.#ui.syncValue(["ZONE_EDITOR", "editing", category], this.#state.isEditable(category));
    this.#ui.syncValue(["ZONE_EDITOR", "editAll"], CATEGORIES.every(category => this.#state.isEditable(category)));
  }

  #refreshZones() {
    for (const category of CATEGORIES) this.#fillCategory(category);
    this.#syncEditingControls();
    this.#showSavingStatus();
    this.#syncDrawingLock();
  }

  // Spec 141 Revision 2: while a category is drawn, every editor control but that category's list is inactive
  // (dev-tools.css: .zone-editor--drawing).
  #syncDrawingLock() {
    const drawing = this.#drawing?.category ?? null;
    this.#root?.classList?.toggle("zone-editor--drawing", drawing !== null);
    for (const [category, list] of this.#lists) list?.classList?.toggle("zone-editor__drawing-list", category === drawing);
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
      this.#syncEditingControls();
      this.#showSavingStatus();
    }, physicsPath, physicsPath, { swatch: ZONE_CATEGORY_COLORS[category] });
    if (!physicsOn) {
      ui.createInfoRow("Фізика", "Вимкнено: цих зон немає в грі й у редакторі. Увімкніть, щоб показати й редагувати їх.", list);
      return;
    }
    ui.createSwitcherRow("Показати зону", state.categories[category], list,
      value => { state.setCategory(category, value); this.#syncAllZonesShown(); }, ["ZONE_EDITOR", "show", category]);
    const id = this.#locationId();
    const location = this.#config.locations.map[id];
    if (!location) return;
    const zones = location.zones?.[category] || [];
    const path = ["CONFIG", "locations", "map", id, "zones", category];
    if (this.#drawing?.isActive(category)) { this.#fillDrawing(category, zones, list, path); return; }
    const index = Math.max(0, Math.min(state.selectedIndex(category), zones.length - 1));
    let external = list;
    if (zones.length) {
      // TK-090: «Всі» ends the list: every zone of the category under the pointer; the rows below show the one last taken.
      const all = state.selectsAll(category);
      ui.createSelectRow("Номер зони", [...zones.map((_, number) => String(number + 1)), ALL_ZONES], all ? ALL_ZONES : String(index + 1), list,
        value => { if (value === ALL_ZONES) this.#selectAll(category); else this.#select(category, Number(value) - 1); });
      if (all) ui.createInfoRow("Усі зони", `Рухати й міняти розмір можна будь-яку зону категорії під курсором. Нижче — параметри зони ${index + 1} (останньої взятої). Щоб видалити зону, оберіть її номер.`, list);
      ui.createInfoRow("Координати", "x/y/w/h і bounds — клітинки designCellSize. Без зон закидання закинути вудку не можна.", list);
      const displayed = category === "dynamic" ? this.#readDynamicZones?.(id)?.[index] ?? zones[index] : zones[index];
      this.#fillMask(category, index, zones[index], list, path);
      if (this.#maskEditor) {
        const locked = this.#maskEditor.isActive(category, index);
        external = ui.createControlGroup(list, ["ZONE_EDITOR", "outer", category], { disabled: locked });
        if (locked) ui.createInfoRow("Зовнішня зона", "Параметри зовнішньої зони заблоковані, поки редагується її меш. Застосуйте маску або вимкніть «Меш маски», щоб змінити їх.", list);
      }
      if (category === "dynamic") {
        const legacyRectangle = !displayed.shape && displayed.w !== displayed.h;
        ui.createSelectRow("Форма зони", legacyRectangle ? ["Прямокутник", "Квадрат", "Коло"] : ["Квадрат", "Коло"],
          legacyRectangle ? "Прямокутник" : displayed.shape === "circle" ? "Коло" : "Квадрат", external, label => {
          if (label === "Прямокутник") return;
          const side = Math.min(displayed.w, displayed.h);
          this.#update(path, zones.map((zone, number) => number === index
            ? { ...displayed, shape: label === "Коло" ? "circle" : "square", w: side, h: side } : zone));
          this.#select(category, index);
        }, [...path, index, "shape"]);
        const fields = { ...displayed };
        delete fields.shape;
        delete fields.mask;
        if (displayed.shape) {
          delete fields.w; delete fields.h;
          ui.createInputRow(displayed.shape === "circle" ? "Діаметр, клітинок" : "Сторона, клітинок", displayed.w, external, "number",
            value => this.#update(path, zones.map((zone, number) => number === index ? { ...displayed, w: value, h: value } : zone)),
            [...path, index, "w"]);
        }
        this.#renderTree(fields, external, [...path, index]);
      } else { const fields = { ...displayed }; delete fields.mask; this.#renderTree(fields, external, [...path, index]); }
      if (category === "dynamic") ui.createInfoRow("Область руху", "Форма нової зони обирається перед додаванням. Для кола задається діаметр, для квадрата — сторона. Клацніть рухому зону на мапі, щоб показати ручки її області руху. Тягніть край, кут або середину області; вона завжди містить усе тіло зони.", list);
      // Any zone can go, the last one too (TK-051); the refilled list then has no delete button. Not under «Всі».
      if (!all) ui.createButtonRow("Видалити вибрану зону", external, () => {
        this.#update(path, zones.filter((_, number) => number !== index));
        this.#select(category, Math.max(0, index - 1));
      });
    }
    if (category === "dynamic") ui.createSelectRow("Форма нової зони", ["Квадрат", "Коло"], this.#newDynamicShape === "circle" ? "Коло" : "Квадрат", external,
      label => { this.#newDynamicShape = label === "Коло" ? "circle" : "square"; }, ["ZONE_EDITOR", "newDynamicShape"]);
    ui.createButtonRow("Додати зону", external, () => {
      if (category !== "dynamic" && this.#drawing) { this.#startDrawing(category); return; }
      const template = category === "dynamic" ? this.#readDynamicZones?.(id)?.[index] ?? zones[index] : zones[index];
      const zone = template ? JSON.parse(JSON.stringify(template)) : { x: 0, y: 0, w: 1, h: 1 };
      if (category === "dynamic") {
        zone.shape = this.#newDynamicShape;
        zone.w = zone.h = Math.min(zone.w, zone.h);
        zone.moving ??= true;
        zone.type ??= "buff";
        zone.multiplier ??= 1.5;
        zone.speedX ??= 1.2; zone.speedY ??= .8;
        zone.bounds ??= [{ x: 0, y: 0, w: this.#config.locations.baseResolution.width / (this.#config.locations.designCellSize || this.#config.locations.cellSize),
          h: this.#config.locations.baseResolution.height / (this.#config.locations.designCellSize || this.#config.locations.cellSize) }];
        let suffix = zones.length + 1;
        while (zones.some(existing => existing.id === `zone_${suffix}`)) suffix++;
        zone.id = `zone_${suffix}`;
      }
      this.#update(path, [...zones, zone]);
      this.#select(category, zones.length);
    });
  }

  // Spec 141: «Додати зону» draws new zones on the grid. It turns on what drawing needs (the editor, the category's
  // editing) like «Редагувати все»; drawing works only on the location on screen.
  #startDrawing(category) {
    const state = this.#state;
    if (!state.enabled) { state.setFlag("enabled", true); this.#ui.syncValue(["ZONE_EDITOR", "enabled"], true); this.#syncGrids(); }
    if (!state.isEditable(category)) { state.setEditing(category, true); this.#snapToGrid([category]); }
    this.#maskEditor?.stop();
    this.#drawing.start(category);
    this.#refreshZones();
  }

  // While drawing: «Застосувати», «Скасувати» and the new zones' coordinates only; no number list and no mask.
  #fillDrawing(category, zones, list, path) {
    const ui = this.#ui, drawing = this.#drawing, base = drawing.base;
    ui.createButtonRow("Застосувати", list, () => { drawing.apply(); this.#selectAll(category); this.#refreshZones(); });
    ui.createButtonRow("Скасувати", list, () => { drawing.cancel(); this.#state.selectAll(category); this.#refreshZones(); });
    ui.createInfoRow("Малювання зон", "ЛКМ по клітинці створює нову зону; натисніть і тягніть, щоб замалювати прямокутник клітинок по обох осях (назад — зменшує). Кожне натискання — нова зона з новим номером. ПКМ так само вирізає клітинки з нових зон: зону, накриту частково, розділено на прямокутники. Нові зони можна рухати серединою й тягнути за край. Затемнене — де зону цієї категорії додати не можна. «Застосувати» зберігає зони й повертає вибір за номером і маску; «Скасувати» прибирає всі нові зони.", list);
    if (zones.length <= base) ui.createInfoRow("Нові зони", "Ще немає: натисніть клітинку на мапі.", list);
    for (let index = base; index < zones.length; index++) {
      const section = this.#createSection(`Зона ${index + 1}`, list, ["ZONE_EDITOR", "drawing", category, index]);
      this.#renderTree({ ...zones[index] }, section, [...path, index]);
    }
  }

  #selectAll(category) {
    const previous = this.#state.selection.category;
    this.#state.selectAll(category);
    if (previous !== category) this.#fillCategory(previous);
    this.#fillCategory(category);
    this.#syncEditingControls();
  }

  // Selecting a zone makes it the one the editor fills and drags; the lists it leaves and joins are rebuilt.
  #select(category, index) {
    const previous = this.#state.selection.category;
    this.#state.select(category, index);
    if (previous !== category) this.#fillCategory(previous);
    this.#fillCategory(category);
    this.#syncEditingControls();
    this.#showSavingStatus();
  }

  #fillMask(category, index, zone, list, path) {
    const editor = this.#maskEditor;
    if (!editor) return;
    const ui = this.#ui, refresh = () => this.#refreshZones();
    if (zone.mask) ui.createSwitcherRow("Маска увімкнена", zone.mask.enabled, list, enabled => {
      editor.stop(); this.#update([...path, index, "mask"], { ...zone.mask, enabled }); refresh();
    }, [...path, index, "mask", "enabled"]);
    // TK-084: removes the applied mask itself (not only switches it off); the zone keeps its plain shape. Export
    // carries the removal into the code.
    if (zone.mask) ui.createButtonRow("Видалити маску", list, () => {
      if (this.#files && !this.#files.confirm("Видалити маску цієї зони? Зона повернеться до початкової форми.")) return;
      const plain = { ...zone }; delete plain.mask;
      const zones = this.#config.locations.map[this.#locationId()].zones[category];
      editor.stop(); this.#update(path, zones.map((entry, number) => number === index ? plain : entry)); refresh();
    });
    const meshPath = ["ZONE_EDITOR", "mesh", category];
    ui.createSwitcherRow("Меш маски", editor.isActive(category, index), list, enabled => {
      if (enabled) editor.start(category, index); else editor.stop(); refresh();
    }, meshPath, meshPath, { requires: [...this.#categoryPrerequisites([category]),
      { path: ["ZONE_EDITOR", "editing", category], isEnabled: () => this.#state.isEditable(category) },
      { path: ["ZONE_EDITOR", "locationId"], isEnabled: () => this.#state.editsLoadedLocation }] });
    if (zone.mask || editor.isActive(category, index)) {
      const opacityPath = ["ZONE_EDITOR", "maskOpacity"];
      ui.createRangeRow("Непрозорість маски", editor.opacity * 100, list, value => {
        ui.syncValue(opacityPath, editor.setOpacity(value / 100) * 100);
      }, opacityPath);
    }
    if (editor.isActive(category, index)) {
      ui.createSelectRow("Дроблення клітинки", ["×2", "×4"], `×${editor.subdivision}`, list,
        label => { editor.setSubdivision(label === "×4" ? 4 : 2); refresh(); }, [...meshPath, "subdivision"]);
      ui.createSwitcherRow("Інверсія маски", editor.draft.reversed, list, () => { editor.invert(); refresh(); }, [...meshPath, "reverse"]);
      ui.createButtonRow("Застосувати маску", list, () => { editor.apply(); refresh(); });
      ui.createInfoRow("Маска", editor.canApply ? "Готова до застосування." : "Виділіть одну непорожню фігуру, з’єднану сторонами. Роз’єднану маску застосувати не можна.", list);
    }
    if (editor.message) ui.createInfoRow("Стан маски", editor.message, list);
    ui.createInfoRow("Редагування маски", "Меш працює лише для вибраного номера зони. ЛКМ додає клітинки, ПКМ видаляє; можна протягувати. До застосування це чернетка. Під час її редагування зовнішні параметри заблоковані. Непрозорість маски змінює лише заливку; контур і сітка лишаються видимими. Готова маска визначає реальні межі й контур та зберігається з експортом зон; маска ігрової зони обмежує Pixi-хвилі, глибина незмінна. Вимкнення маски повертає початкову форму. Зміна дроблення починає чисту чернетку, готову маску збережено.", list);
  }

  #renderCellGrid(section) {
    const ui = this.#ui, state = this.#state, locations = this.#config.locations;
    ui.createSwitcherRow("Показати сітку", state.cellGrid, section, value => { state.setFlag("cellGrid", value); this.#syncGrids(); },
      ["ZONE_EDITOR", "cellGrid"]);
    ui.createRangeRow("Непрозорість сітки", state.cellGridOpacity * 100, section,
      value => state.setNumber("cellGridOpacity", value / 100), ["ZONE_EDITOR", "cellGridOpacity"]);
    // TK-083: only sizes that cut the map into whole cells; a size that does not (an older session value) stays listed
    // until changed, with the warning over the screen.
    const cellPath = ["CONFIG", "locations", "cellSize"];
    const sizes = zoneCellSizes(locations.baseResolution, CELL_SIZE);
    const options = sizes.includes(locations.cellSize) ? sizes : [locations.cellSize, ...sizes];
    ui.createSelectRow("Розмір клітинки, px", options.map(String), String(locations.cellSize), section, value => {
      const next = Number(value);
      if (next !== locations.cellSize && sizes.includes(next)) { this.#update(cellPath, next); this.#snapToGrid(CATEGORIES); }
      this.#showGridWarning(sizes);
    }, cellPath);
    this.#showGridWarning(sizes);
    const design = Number(locations.designCellSize) || locations.cellSize;
    ui.createInfoRow("Клітинки", `Сітка клітинок спільна для всіх локацій. Непрозорість сітки керує клітинною сіткою, сіткою мешу й перспективи; заливка маски має окрему непрозорість. Розмір клітинки — сітка мапи гри: лише значення, що ділять локацію ${locations.baseResolution.width}×${locations.baseResolution.height} px на цілі клітинки (${sizes.join(", ") || "немає"} px); зміна перебудовує клітинки й глибини, зберігаючи положення та розміри наявних зон. Зони задані в клітинках дизайну ${design} px, множник ${(locations.cellSize / design).toFixed(2)}. Лінії й прилипання — через одну клітинку; переміщення рухомого тіла плавне.`, section);
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
    ui.createSwitcherRow("Показати сітку", state.grid, content,
      value => { state.setFlag("grid", value); this.#syncGrids(); }, ["ZONE_EDITOR", "grid"]);
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
    showStatus();
  }

  #editingPrerequisites() {
    return [{ path: ["ZONE_EDITOR", "enabled"], isEnabled: () => this.#state.enabled }];
  }

  #allZonesShown() {
    return CATEGORIES.every(category => this.#state.categories[category]);
  }

  #syncAllZonesShown() {
    this.#ui.syncValue(["ZONE_EDITOR", "showAll"], this.#allZonesShown());
  }

  #syncGrids() {
    for (const key of ["cellGrid", "grid"]) this.#ui.syncValue(["ZONE_EDITOR", key], this.#state[key]);
  }

  // Spec 136, Revision 2: "Зони риболовлі", every zone inside the castable area. The game's own show switches (they apply
  // in the game too), the editor's line length and conditional float (nothing can be cast while editing), hand chum's
  // far line (the location's chumCastDistance), the net and fish whose real values are previewed, and test chum zones.
  // Item, fish and physics values are never changed.
  #fillFishing() {
    const list = this.#fishing;
    if (!list) return;
    const ui = this.#ui, dependent = this.#getDependentZones?.() ?? null;
    ui.releaseValueBindings(list);
    list.replaceChildren();
    this.#configSwitch(list, "debugVisuals", "Показувати оверлеї гри");
    // Spec 131 prerequisites: a switch that cannot work while its parent is off is blocked, and the parent is shown.
    const locations = this.#config.locations;
    const overlays = { path: ["CONFIG", "locations", "debugVisuals"], isEnabled: () => locations.debugVisuals === true };
    const shown = (id) => {
      const zone = DEPENDENT_ZONES.find(entry => entry.id === id);
      return { path: ["CONFIG", "locations", zone.show], isEnabled: () => dependent?.isShown(id) ?? false };
    };
    const show = (id) => {
      const zone = DEPENDENT_ZONES.find(entry => entry.id === id);
      this.#configSwitch(list, zone.show, FISHING_SHOW_LABELS[id], { swatch: zone.color, defaultOn: zone.defaultOn,
        requires: zone.overlay ? [overlays] : [] });
      return zone;
    };
    const editorSwitch = (label, value, key, change, swatch, requires) => {
      const path = ["ZONE_EDITOR", "fishing", key];
      ui.createSwitcherRow(label, value, list, change, path, path, { swatch, requires: [...this.#editingPrerequisites(), ...requires] });
    };
    const choose = (label, options, current, onChoose, key) => {
      ui.createSelectRow(label, options.map(([, name]) => name), options.find(([id]) => id === current)?.[1] ?? "", list,
        (name) => { const option = options.find(([, candidate]) => candidate === name); if (option) onChoose(option[0]); },
        ["ZONE_EDITOR", "fishing", key]);
    };
    if (dependent) {
      // TK-069: the equipped line and net instead of the field and the select (refilled, so only the used rows show).
      // A display choice: it needs no editor.
      const equipmentPath = ["ZONE_EDITOR", "fishing", "fromEquipment"];
      ui.createSwitcherRow("Брати значення зі спорядження", dependent.fromEquipment, list,
        (value) => { dependent.setFromEquipment(value); this.#fillFishing(); }, equipmentPath, equipmentPath);
      if (!dependent.fromEquipment) {
        const linePath = ["ZONE_EDITOR", "fishing", "lineMeters"];
        ui.createInputRow("Довжина ліски, м", dependent.lineMeters, list, "number",
          value => ui.syncValue(linePath, dependent.setLineMeters(value)), linePath);
      } else {
        const line = dependent.readings.equippedLineMeters();
        ui.createInfoRow("Ліска", line === null ? `Ліску не споряджено: діє ${dependent.lineMeters} м з поля.` : `Спорядженої ліски: ${line} м.`, list);
      }
    }
    const handChum = show("handChum");
    if (dependent) editorSwitch("Редагувати ручну прикормку", dependent.editingChumLine, "handChum",
      value => dependent.setEditingChumLine(value), handChum.color, [shown("handChum")]);
    show("net");
    if (dependent && !dependent.fromEquipment) choose("Підсака", dependent.readings.nets, dependent.netId, id => dependent.setNet(id), "net");
    show("lastDash");
    if (dependent) choose("Риба", dependent.readings.fishes, dependent.fishId, id => dependent.setFish(id), "fish");
    show("catch");
    show("sector");
    show("line");
    // The float shapes the sector and sits on the line radius: either of them must be shown.
    if (dependent) editorSwitch("Рухати поплавок", dependent.movingFloat, "float", value => dependent.setMovingFloat(value), "#ffffff",
      [overlays, { path: ["CONFIG", "locations", "showPoleFightSector"], isEnabled: () => dependent.isShown("sector") || dependent.isShown("line") }]);
    const chum = show("chum");
    if (dependent) {
      const zones = dependent.chumZones, locationId = this.#locationId(), spots = zones.list(locationId);
      editorSwitch("Редагувати зони прикормки", zones.isEditing, "chum", value => zones.setEditing(value), chum.color, [shown("chum")]);
      if (spots.length) {
        // TK-088: the game's own chum zones come first, marked; they move and resize like test zones, only test zones go.
        const labelOf = number => `${number + 1}${zones.isGameZone(locationId, number) ? " (гра)" : ""}`;
        // TK-089: the last option takes every zone, the one under the pointer.
        const selected = Math.min(zones.selected, spots.length - 1);
        ui.createSelectRow("Номер зони прикормки", [...spots.map((_, number) => labelOf(number)), ALL_ZONES], zones.selectsAll ? ALL_ZONES : labelOf(selected), list,
          value => { if (value === ALL_ZONES) zones.selectAll(); else zones.select(parseInt(value, 10) - 1); this.#fillFishing(); },
          ["ZONE_EDITOR", "fishing", "chumIndex"]);
        if (zones.selectsAll) ui.createInfoRow("Усі зони прикормки", "Рухати й міняти розмір можна будь-яку зону прикормки під курсором. Щоб видалити тестову зону, оберіть її номер.", list);
        else if (zones.isGameZone(locationId, selected)) ui.createInfoRow("Зона прикормки гри", "Справжня прикормка гри: її можна рухати й міняти розмір; нове місце зберігається в стані прикормки гри, розмір — до перезавантаження (потім береться з прикормки). Зникає, коли закінчиться дія прикормки.", list);
        else ui.createButtonRow("Видалити вибрану зону прикормки", list, () => { zones.remove(locationId, zones.selected); this.#fillFishing(); });
      }
      ui.createButtonRow("Додати зону прикормки", list, () => { dependent.addChumZone(); this.#fillFishing(); });
    }
    ui.createInfoRow("Зони риболовлі", "Зони всередині ігрової області. Показані зони малюються з реальних значень від вудки на нижній грані, з редактором чи без нього (редагувати можна лише з увімкненим редактором): ручна прикормка — з налаштування локації (її дальню лінію можна тягнути), підсака й останній ривок — для вибраних підсаки й риби, підведення — зі спорядженої вудки й котушки. Сектор виважування й радіус ліски беруть довжину ліски з поля вище; умовний поплавок на краю сектора можна рухати в межах ліски. Підсаку, останній ривок, підведення, сектор і радіус ліски гра показує лише з «Показувати оверлеї гри»; перемикачі редагування працюють лише з увімкненим редактором і показаною зоною — що блокує, підсвічується. Зони прикормки тут — тестові: лише для вигляду, як справжні, без зміни предметів; середина пересуває, край змінює розмір. Перший перемикач гасить усі оверлеї гри.", list);
  }

  // A switch over CONFIG.locations.<key> through the validated runtime override path.
  #configSwitch(parent, key, label, { swatch = null, defaultOn = false, requires = [] } = {}) {
    const path = ["CONFIG", "locations", key];
    const value = this.#config.locations[key];
    this.#ui.createSwitcherRow(label, defaultOn ? value !== false : value === true, parent,
      next => this.#update(path, next), path, path, { swatch, requires });
  }

  #locationId() {
    return this.#state.locationId || this.#state.loadedLocationId || this.#config.locations.currentLocationId ||
      Object.keys(this.#config.locations.map)[0];
  }
}
