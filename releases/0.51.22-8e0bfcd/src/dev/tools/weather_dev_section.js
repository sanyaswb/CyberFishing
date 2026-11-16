import { DevSavingSection } from "./export/dev_saving_section.js";
import {
  buildWeatherFile,
  canonicalLocationWeather,
  canonicalRain,
  changedWeatherParts,
  locationWeatherHash,
  rainHash,
  validateWeatherFile,
  weatherFileName,
} from "../weather/weather_export_format.js";

// DevTools «ПОГОДА» (spec 172, 175, 179; spec 180 stage C, TK-327).
// - On top: the selector «Загальні» | a location, and with a location the switch «Параметри локації» (on: only what
//   belongs to that location; off: the general settings as well) — spec 180 D4, D11.
// - «Стан і керування» of the location the game runs (D10): the live state of every process, then a slider per element
//   (rain, storm, fog, emission, ash, wind, waves, current) — moving a slider holds that element by hand (no separate
//   «manual» switches); under the rain's and the ash's sliders, collapsed, their look at strength 100 for the selected
//   location (or the general one) — each slider stands at the real value within its range (D16). The action buttons
//   (events now, emission parts, a gust, a strike, «↺ Автоматична погода») come last.
// - Sections by element: ДОЩ, ШТОРМ, ВІТЕР, ТУМАН, ВИКИД, ПОПІЛ, ВОДА, ПОЧАТОК І ПОРОГИ — general and location parts by
//   the selector; a section with edits not in the code is marked «· змінено» and has «↺ Скинути розділ до коду» (D8).
// - «Збереження»: the rain's look and the location's weather (spec 175; the general storm and wind files: stage D).
// TK-327.1 (owner): only an element's section opens inside (a different section); everything in it — its groups and
// the trees' nested objects — opens in place under it (inline). The selector is buttons on top (no empty wrapper); each
// event (rain, storm, fog, emission) has a switch: on starts a random event as the game would, off ends it, and the
// event's generated course (duration, peak, strength, lightning) shows on top of «Стан і керування».
const GENERAL = "Загальні";
const EVENT_PHASES = Object.freeze({ rise: "розгін", peak: "пік", fall: "затухання", idle: "немає" });
const EVENTS = Object.freeze([["rain", "Дощ"], ["storm", "Шторм"], ["fog", "Туман"]]);
const EMISSION_LABELS = Object.freeze({ idle: "немає", onset: "початок", peak: "пік", fade: "затихання" });
// TK-327.1: starting and ending the emission is its switch; these jump within the running one.
const EMISSION_ACTIONS = Object.freeze([
  Object.freeze(["Викид: пік зараз", "peak"]),
  Object.freeze(["Викид: затихання зараз", "fade"]),
]);
const WIND_CHOICES = Object.freeze([
  Object.freeze({ label: "авто", direction: null }),
  Object.freeze({ label: "← вліво", direction: -1 }),
  Object.freeze({ label: "немає", direction: 0 }),
  Object.freeze({ label: "вправо →", direction: 1 }),
]);
const WIND_NAMES = Object.freeze({ "-1": "вліво", 0: "немає", 1: "вправо" });
const WIND_STATE_LABELS = Object.freeze({ calm: "штиль", light: "слабкий", moderate: "середній", strong: "сильний" });
// D16: the values that change with an element's strength — [min, max, step] of their sliders, and their names.
const STRENGTH_LIMITS = Object.freeze({
  rain: Object.freeze({ maxDrops: [0, 2000, 10], lengthPx: [0, 300, 1], widthPx: [0, 20, 0.1], speedPx: [100, 4000, 10],
    minScale: [0, 1, 0.01], lengthJitter: [0, 1, 0.01], slantJitterDeg: [0, 20, 0.5] }),
  ash: Object.freeze({ maxParticles: [0, 600, 5], opacity: [0, 1, 0.01], riseSpeedPx: [-100, 100, 1], wanderPx: [0, 200, 1] }),
});
const STRENGTH_LABELS = Object.freeze({ maxDrops: "густота", lengthPx: "довжина краплі", widthPx: "ширина краплі",
  speedPx: "швидкість падіння", minScale: "глибина (далекі)", lengthJitter: "розкид довжини", slantJitterDeg: "розкид нахилу",
  maxParticles: "іскор на екрані", opacity: "непрозорість", riseSpeedPx: "підйом", wanderPx: "хаотичність" });
// D2: each event's chance per check, in its own section.
const CHANCES = Object.freeze({
  rain: Object.freeze(["Дощ: шанс перевірки", "rainChance", ["rain", "chancePerCheck"]]),
  storm: Object.freeze(["Шторм: шанс перевірки", "stormChance", ["storm", "chancePerCheck"]]),
  fog: Object.freeze(["Туман: шанс перевірки", "fogChance", ["fog", "chancePerCheck"]]),
});
const PART_LABELS = Object.freeze({ rain: "Вигляд дощу", locationWeather: "Параметри локації" });

const percent = (value) => `${Math.round((Number(value) || 0) * 100)}%`;
const seconds = (value) => `${Math.round(Number(value) || 0)} с`;
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

export class WeatherDevSection {
  #ui;
  #weather;
  #config;
  #locationConfig;
  #locationsMap;
  #rainConfig;
  #ashConfig;
  #general;
  #createSection;
  #renderConfigTree;
  #updateConfig;
  #edits;
  #getBaseRain;
  #getBaseLocationWeather;
  #resetWeather;
  #gameVersion;
  #now;
  #savingSection;
  #content = null;
  #selected = null;
  #locationOnly = true;
  #listening = false;
  #levels = { rain: 70, storm: 80, fog: 60, emission: 100, ash: 100, wind: 40, waves: 100 };
  #fadeSec = 5;
  #radiation = 50;
  #onConfigUpdated = (event) => {
    if (!this.#savingSection.hasStatusElement) return;
    const path = event?.detail?.path;
    if (!Array.isArray(path) || path[0] !== "CONFIG") return;
    const isRain = path[1] === "canvas" && path[2] === "rain";
    const isLocation = path[1] === "locations" && path[2] === "map" && path[3] === this.#locationId() && path[4] === "weather";
    if (isRain || isLocation) this.#savingSection.refreshStatus();
  };

  // weather: the DEV port { getModel(), getWindModel(), getEmissionModel(), getWind(), setWind(dir | null),
  //   setWindStrength(0…1 | null), triggerWindGust(), holdAsh(0…1 | null), holdWaves(scale | null), requestImage(id),
  //   sessionSeed, locationId }; config: () => the active location's weather; locationConfig(id) / locationsMap();
  //   general: () => { rain, ash, water, storm, wind, screen } (the general settings); edits: { hasOverrides(parts),
  //   resetTree(parts) } (the «змінено» mark and the section reset).
  constructor({
    ui,
    weather,
    config,
    locationConfig = null,
    locationsMap = null,
    rainConfig = () => null,
    ashConfig = () => null,
    general = () => null,
    createSection,
    renderConfigTree,
    updateConfig = null,
    edits = null,
    files = null,
    getBaseRain = null,
    getBaseLocationWeather = null,
    resetWeather = null,
    gameVersion = "",
    now = () => new Date(),
  }) {
    this.#ui = ui;
    this.#weather = weather;
    this.#config = config;
    this.#locationConfig = locationConfig;
    this.#locationsMap = locationsMap;
    this.#rainConfig = rainConfig;
    this.#ashConfig = ashConfig;
    this.#general = general;
    this.#createSection = createSection;
    this.#renderConfigTree = renderConfigTree;
    this.#updateConfig = updateConfig;
    this.#edits = edits;
    this.#getBaseRain = getBaseRain;
    this.#getBaseLocationWeather = getBaseLocationWeather;
    this.#resetWeather = resetWeather;
    this.#gameVersion = gameVersion;
    this.#now = now;
    this.#selected = weather?.locationId ?? GENERAL;
    this.#savingSection = new DevSavingSection({
      ui,
      files,
      commandPrefix: "npm run apply:weather",
      useTextStatus: true,
      hasReset: Boolean(resetWeather),
      labels: {
        statusLabel: "Стан погоди",
        exportLabel: "Експорт погоди",
        importLabel: "Імпорт погоди",
        resetLabel: "Скинути зміни погоди до коду",
        description:
          "Експорт погоди завантажує файл вигляду дощу й погоди вибраної локації. У код зміни переносить команда npm run apply:weather -- <файл> (перевірка, конфлікти, підтвердження, бекап); після неї перезавантажте сторінку або скиньте зміни погоди до коду. Імпорт погоди відкриває такий файл тут, щоб продовжити редагування. Без експорту зміни зникають при перезавантаженні.",
      },
      readStatus: () => this.#readSavingStatus(),
      buildExport: (hashText) => this.#buildExport(hashText),
      onImport: (file, setStatus) => this.#applyImport(file, setStatus),
      onReset: () => {
        this.#resetWeather(this.#locationId());
        this.#fill();
      },
    });
  }

  render(parent) {
    this.#content = this.#createSection("ПОГОДА", parent, ["WEATHER"], { icon: "cloud" });
    if (!this.#listening && typeof document !== "undefined" && document?.addEventListener) {
      document.addEventListener("config-updated", this.#onConfigUpdated);
      this.#listening = true;
    }
    this.#fill();
  }

  dispose() {
    if (this.#listening && typeof document !== "undefined" && document?.removeEventListener) {
      document.removeEventListener("config-updated", this.#onConfigUpdated);
    }
    this.#listening = false;
    this.#savingSection.clear();
    this.#content = null;
  }

  // The location the selector names (or the game's, with «Загальні»): export, import and the location parts use it.
  #locationId() {
    const map = this.#locationsMap?.();
    if (this.#selected !== GENERAL && map?.[this.#selected]?.weather) return this.#selected;
    return this.#weather.locationId;
  }

  #locationWeather(id = this.#locationId()) {
    return this.#locationConfig?.(id) ?? this.#config();
  }

  #locationChoices() {
    const map = this.#locationsMap?.();
    if (!map || typeof map !== "object") return [this.#weather.locationId];
    const ids = Object.keys(map).filter((id) => map[id]?.weather);
    return ids.length ? ids : [this.#weather.locationId];
  }

  // What the selector shows: the general parts, the location parts (its id), or both.
  #mode() {
    const location = this.#selected === GENERAL ? null : this.#locationId();
    return { location, general: location === null || !this.#locationOnly };
  }

  #fill() {
    const content = this.#content;
    if (!content) return;
    const rebuild = () => {
      this.#ui.releaseValueBindings?.(content);
      content.replaceChildren();
      this.#savingSection.clear();
      this.#renderSelector(content);
      const model = this.#weather.getModel();
      if (!model) {
        this.#ui.createInfoRow("стан", "погода не створена", content);
        return;
      }
      this.#renderControls(model, content);
      const mode = this.#mode();
      this.#renderRain(content, mode);
      this.#renderStorm(content, mode);
      this.#renderWind(content, mode);
      if (mode.location) this.#renderFog(content, mode);
      this.#renderEmission(content, mode);
      this.#renderAsh(content, mode);
      this.#renderWater(content, mode);
      if (mode.location) this.#renderStart(content, mode);
      this.#savingSection.render(this.#createSection("Збереження", content, ["WEATHER", "saving"]));
    };
    if (typeof this.#ui.preserveDrill === "function") this.#ui.preserveDrill(content, rebuild);
    else rebuild();
  }

  // TK-327.1: «Загальні» and every location as buttons on top (all visible, one press).
  #renderSelector(content) {
    const options = [{ value: GENERAL, label: GENERAL }, ...this.#locationChoices().map((id) => ({ value: id, label: id }))];
    this.#ui.addParameter(content, { control: "segments", label: "налаштування", options, value: this.#selected,
      onCommit: (next) => { this.#selected = next; this.#fill(); }, path: ["WEATHER", "location", "id"] });
    if (this.#selected === GENERAL) return;
    this.#ui.addParameter(content, { control: "switch", label: "Параметри локації", value: this.#locationOnly,
      onCommit: (on) => { this.#locationOnly = on === true; this.#fill(); }, path: ["WEATHER", "location", "only"] });
    if (this.#selected !== this.#weather.locationId) {
      this.#ui.createInfoRow("активна у грі", `${this.#weather.locationId} (нижче — ${this.#selected})`, content);
    }
  }

  // A section of one element; parts: the CONFIG roots it edits (for «змінено» and the reset).
  #elementSection(title, key, content, parts, body) {
    const changed = this.#edits ? parts.some((part) => this.#edits.hasOverrides(part)) : false;
    const section = this.#createSection(changed ? `${title} · змінено` : title, content, ["WEATHER", key]);
    body(section);
    if (changed) {
      this.#ui.createButtonRow("↺ Скинути розділ до коду", section, () => {
        for (const part of parts) this.#edits.resetTree(part);
        this.#fill();
      }, false, "", ["WEATHER", key, "reset"]);
    }
  }

  #tree(value, section, parts) {
    if (value && typeof value === "object") this.#renderConfigTree(value, section, ["CONFIG", ...parts], { inlineSections: true });
  }

  // A group inside an element's section: opens in place (TK-327.1).
  #group(label, parent, path) {
    return this.#createSection(label, parent, path, { inline: true });
  }

  #locationParts(id, ...rest) {
    return ["locations", "map", id, "weather", ...rest];
  }

  #chanceRow(kind, id, section) {
    const [label, key, segments] = CHANCES[kind];
    const value = this.#locationWeather(id)?.[segments[0]]?.[segments[1]];
    if (typeof value !== "number") return;
    const cfgPath = ["CONFIG", ...this.#locationParts(id, ...segments)];
    this.#ui.createInputRow(label, value, section, "number", (raw) => {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return;
      const clamped = clamp(parsed, 0, 1);
      this.#updateConfig?.(cfgPath, clamped);
      this.#ui.syncValue?.(cfgPath, clamped);
    }, ["WEATHER", "chances", key], cfgPath, this.#changeTracking(cfgPath));
  }

  #changeTracking(cfgPath, onAfterReset = null) {
    if (!this.#edits?.isOverridden || !this.#edits?.resetParameter) return {};
    return {
      isChanged: () => this.#edits.isOverridden(cfgPath),
      onReset: () => {
        this.#edits.resetParameter(cfgPath);
        onAfterReset?.();
      },
    };
  }

  #renderRain(content, mode) {
    const general = this.#general()?.rain ?? this.#rainConfig();
    const parts = [];
    if (mode.general) parts.push(["canvas", "rain"]);
    if (mode.location) parts.push(this.#locationParts(mode.location, "rain"), this.#locationParts(mode.location, "look", "rain"));
    this.#elementSection("ДОЩ", "rain", content, parts, (section) => {
      if (mode.general) this.#tree(general, this.#group("Вигляд (загальний)", section, ["WEATHER", "rain", "look"]), ["canvas", "rain"]);
      if (!mode.location) return;
      const weather = this.#locationWeather(mode.location);
      this.#chanceRow("rain", mode.location, section);
      this.#tree(weather?.rain, this.#group("Подія дощу (локація)", section, ["WEATHER", "rain", "event"]),
        this.#locationParts(mode.location, "rain"));
      this.#renderAt100Numbers("rain", mode.location, this.#group("При силі 100 (локація)", section, ["WEATHER", "rain", "at100"]));
    });
  }

  #renderStorm(content, mode) {
    const parts = [];
    if (mode.general) parts.push(["weather", "storm"]);
    if (mode.location) parts.push(this.#locationParts(mode.location, "storm"));
    this.#elementSection("ШТОРМ", "storm", content, parts, (section) => {
      if (mode.general) {
        this.#tree(this.#general()?.storm, this.#group("Що робить шторм (загальне)", section, ["WEATHER", "storm", "effects"]),
          ["weather", "storm"]);
      }
      if (!mode.location) return;
      this.#chanceRow("storm", mode.location, section);
      this.#tree(this.#locationWeather(mode.location)?.storm, this.#group("Подія шторму й блискавки (локація)", section,
        ["WEATHER", "storm", "event"]), this.#locationParts(mode.location, "storm"));
    });
  }

  #renderWind(content, mode) {
    const parts = [];
    if (mode.general) parts.push(["weather", "wind"]);
    if (mode.location) parts.push(this.#locationParts(mode.location, "wind"));
    this.#elementSection("ВІТЕР", "wind", content, parts, (section) => {
      if (mode.general) {
        this.#tree(this.#general()?.wind, this.#group("Як діє вітер і порив (загальне)", section, ["WEATHER", "wind", "effects"]),
          ["weather", "wind"]);
        this.#renderWindByEvents(this.#group("Вплив подій на вітер (загальне)", section, ["WEATHER", "wind", "events"]));
      }
      if (!mode.location) return;
      this.#tree(this.#locationWeather(mode.location)?.wind, this.#group("Стани вітру й частота поривів (локація)", section,
        ["WEATHER", "wind", "states"]), this.#locationParts(mode.location, "wind"));
    });
  }

  // TK-327.1: what each event does to the wind, in one place (the storm's keys are the same as in ШТОРМ, the rain's as in
  // «Як діє вітер»; the emission acts through its storm).
  #renderWindByEvents(parent) {
    const general = this.#general();
    const rows = [
      ["Дощ: вітер не слабший", ["weather", "wind", "rain", "minStrength"], general?.wind?.rain?.minStrength],
      ["Дощ: додаток до вітру", ["weather", "wind", "rain", "bonus"], general?.wind?.rain?.bonus],
      ["Дощ: пориви ×", ["weather", "wind", "rain", "gustChanceMult"], general?.wind?.rain?.gustChanceMult],
      ["Шторм: вітер не слабший", ["weather", "storm", "windMinStrength"], general?.storm?.windMinStrength],
      ["Шторм: пориви ×", ["weather", "storm", "gustChanceMult"], general?.storm?.gustChanceMult],
    ];
    for (const [label, parts, value] of rows) {
      if (typeof value !== "number") continue;
      const cfgPath = ["CONFIG", ...parts];
      this.#ui.addParameter(parent, { control: "number", label, value, path: ["WEATHER", "wind", "events", parts.at(-1), parts[1]],
        bindingPath: cfgPath, onCommit: (next) => { if (Number.isFinite(Number(next))) this.#updateConfig?.(cfgPath, Number(next)); },
        ...this.#changeTracking(cfgPath) });
    }
    this.#ui.createInfoRow("Викид", "діє на вітер через свій шторм (ВИКИД → «Подія викиду» → storm)", parent);
  }

  #renderFog(content, mode) {
    this.#elementSection("ТУМАН", "fog", content, [this.#locationParts(mode.location, "fog")], (section) => {
      this.#chanceRow("fog", mode.location, section);
      this.#tree(this.#locationWeather(mode.location)?.fog, this.#group("Подія туману (локація)", section, ["WEATHER", "fog", "event"]),
        this.#locationParts(mode.location, "fog"));
    });
  }

  #renderEmission(content, mode) {
    const emission = this.#weather.getEmissionModel?.() ?? null;
    const parts = [];
    if (mode.general) parts.push(["emission", "screen"]);
    if (mode.location) parts.push(this.#locationParts(mode.location, "emission"), this.#locationParts(mode.location, "radiation"));
    this.#elementSection("ВИКИД", "emission", content, parts, (section) => {
      if (emission) {
        const snapshot = emission.snapshot;
        if (snapshot.radiationForced) this.#radiation = Math.round(snapshot.radiation * 100);
        this.#ui.createSwitcherRow("Радіація вручну", snapshot.radiationForced, section, (on) => {
          emission.setRadiationOverride(on ? this.#radiation / 100 : null);
          this.#fill();
        }, ["WEATHER", "emission", "radiationHold"]);
        this.#ui.createRangeRow("радіація, %", this.#radiation, section, (value) => {
          this.#radiation = clamp(value, 0, 100);
          emission.setRadiationOverride(this.#radiation / 100);
          this.#ui.syncValue?.(["WEATHER", "emission", "radiationHold"], true);
        }, ["WEATHER", "emission", "radiation"]);
        this.#ui.createSwitcherRow("заморозити викид", snapshot.frozen === true, section, (frozen) => {
          emission.setFrozen(frozen);
          this.#fill();
        }, ["WEATHER", "emission", "frozen"]);
      }
      if (mode.general) {
        const screen = this.#general()?.screen;
        this.#tree(screen?.vignette, this.#group("Затемнення", section, ["WEATHER", "emission", "vignette"]),
          ["emission", "screen", "vignette"]);
        this.#tree(screen?.blur, this.#group("Розмиття", section, ["WEATHER", "emission", "blur"]), ["emission", "screen", "blur"]);
        if (screen) {
          const includeHudPath = ["CONFIG", "emission", "screen", "includeHud"];
          this.#ui.addParameter(section, { control: "switch", label: "Розмивати разом з HUD", value: screen.includeHud !== false,
            onCommit: (on) => this.#updateConfig?.(includeHudPath, on === true),
            path: ["WEATHER", "emission", "includeHud"], bindingPath: includeHudPath, ...this.#changeTracking(includeHudPath) });
        }
      }
      if (!mode.location) return;
      const weather = this.#locationWeather(mode.location);
      this.#tree(weather?.emission, this.#group("Подія викиду (локація)", section, ["WEATHER", "emission", "event"]),
        this.#locationParts(mode.location, "emission"));
      this.#tree(weather?.radiation, this.#group("Радіація (локація)", section, ["WEATHER", "emission", "radiationConfig"]),
        this.#locationParts(mode.location, "radiation"));
    });
  }

  #renderAsh(content, mode) {
    const parts = [];
    if (mode.general) parts.push(["canvas", "ash"]);
    if (mode.location) parts.push(this.#locationParts(mode.location, "look", "ash"));
    this.#elementSection("ПОПІЛ", "ash", content, parts, (section) => {
      if (mode.general) this.#tree(this.#general()?.ash ?? this.#ashConfig(), this.#group("Вигляд (загальний)", section,
        ["WEATHER", "ash", "look"]), ["canvas", "ash"]);
      if (mode.location) this.#renderAt100Numbers("ash", mode.location, this.#group("При силі 100 (локація)", section, ["WEATHER", "ash", "at100"]));
    });
  }

  #renderWater(content, mode) {
    const water = this.#general()?.water;
    const parts = [];
    if (mode.general) parts.push(["canvas", "water"]);
    if (mode.location) parts.push(["locations", "map", mode.location, "environment", "current"]);
    this.#elementSection("ВОДА", "water", content, parts, (section) => {
      if (mode.general) {
        const testOn = this.#general()?.debug?.waveTestBackground === true;
        const waveTestPath = ["CONFIG", "debug", "waveTestBackground"];
        this.#ui.addParameter(section, { control: "switch", label: "Тестовий фон хвиль (смуги)", value: testOn,
          onCommit: (on) => {
            const id = this.#locationsMap?.()?.[this.#weather.locationId]?.waveTestBackground;
            if (on && id) this.#weather.requestImage?.(id);
            this.#updateConfig?.(waveTestPath, on === true);
          }, path: ["WEATHER", "water", "testBackground"], bindingPath: waveTestPath, ...this.#changeTracking(waveTestPath) });
        this.#tree(water, this.#group("Хвилі й стан моря (загальне)", section, ["WEATHER", "water", "waves"]), ["canvas", "water"]);
      }
      if (!mode.location) return;
      const current = this.#locationsMap?.()?.[mode.location]?.environment?.current;
      this.#tree(current, this.#group("Течія (локація)", section, ["WEATHER", "water", "current"]),
        ["locations", "map", mode.location, "environment", "current"]);
    });
  }

  #renderStart(content, mode) {
    const weather = this.#locationWeather(mode.location);
    this.#elementSection("ПОЧАТОК І ПОРОГИ", "start", content,
      [this.#locationParts(mode.location, "initial"), this.#locationParts(mode.location, "thresholds")], (section) => {
        this.#tree(weather?.initial, this.#group("Погода на старті сесії", section, ["WEATHER", "start", "initial"]),
          this.#locationParts(mode.location, "initial"));
        this.#tree(weather?.thresholds, this.#group("Пороги для кльову", section, ["WEATHER", "start", "thresholds"]),
          this.#locationParts(mode.location, "thresholds"));
      });
  }

  // D16: the value at strength 100 — the location's override or the general end; with «Загальні», the general end.
  #at100(kind, key) {
    const range = (this.#general()?.[kind] ?? (kind === "rain" ? this.#rainConfig() : this.#ashConfig()))?.strength?.[key];
    const generalEnd = Array.isArray(range) ? Number(range[1]) : NaN;
    if (this.#selected === GENERAL) return generalEnd;
    const override = this.#locationWeather(this.#locationId())?.look?.[kind]?.[key];
    return Number.isFinite(Number(override)) ? Number(override) : generalEnd;
  }

  #setAt100(kind, key, value) {
    if (this.#selected === GENERAL) {
      const look = this.#general()?.[kind] ?? (kind === "rain" ? this.#rainConfig() : this.#ashConfig());
      const range = look?.strength?.[key];
      if (!Array.isArray(range)) return;
      this.#updateConfig?.(["CONFIG", "canvas", kind, "strength", key], [range[0], value]);
      return;
    }
    const id = this.#locationId();
    const weather = this.#locationWeather(id);
    if (!weather) return;
    if (!weather.look) this.#updateConfig?.(["CONFIG", ...this.#locationParts(id, "look")], { rain: {}, ash: {} });
    if (!this.#locationWeather(id)?.look?.[kind]) this.#updateConfig?.(["CONFIG", ...this.#locationParts(id, "look", kind)], {});
    this.#updateConfig?.(["CONFIG", ...this.#locationParts(id, "look", kind, key)], value);
  }

  // The sliders under an element's strength: each at its real value within its range (D16).
  #renderAt100Sliders(kind, parent) {
    const selectedId = this.#selected === GENERAL ? null : this.#locationId();
    for (const [key, [min, max, step]] of Object.entries(STRENGTH_LIMITS[kind])) {
      const value = this.#at100(kind, key);
      if (!Number.isFinite(value)) continue;
      const cfgPath = selectedId
        ? ["CONFIG", ...this.#locationParts(selectedId, "look", kind, key)]
        : ["CONFIG", "canvas", kind, "strength", key];
      const sliderPath = ["WEATHER", "controls", `${kind}At100`, key];
      const syncPath = selectedId ? cfgPath : sliderPath;
      this.#ui.addParameter(parent, {
        control: "range",
        label: STRENGTH_LABELS[key] ?? key,
        value: clamp(value, min, max),
        min,
        max,
        step,
        onCommit: (next) => this.#setAt100(kind, key, Number(next)),
        path: sliderPath,
        bindingPath: syncPath,
        configPath: cfgPath,
        ...this.#changeTracking(cfgPath, () => this.#ui.syncValue?.(syncPath, clamp(this.#at100(kind, key), min, max))),
      });
    }
  }

  // The same values as numbers in the element's section (location overrides).
  #renderAt100Numbers(kind, id, parent) {
    for (const key of Object.keys(STRENGTH_LIMITS[kind])) {
      const value = this.#at100(kind, key);
      if (!Number.isFinite(value)) continue;
      const cfgPath = ["CONFIG", ...this.#locationParts(id, "look", kind, key)];
      this.#ui.addParameter(parent, { control: "number", label: STRENGTH_LABELS[key] ?? key, value,
        onCommit: (next) => { if (Number.isFinite(Number(next))) this.#setAt100(kind, key, Number(next)); },
        path: ["WEATHER", kind, "at100", key], bindingPath: cfgPath,
        ...this.#changeTracking(cfgPath, () => this.#ui.syncValue?.(cfgPath, this.#at100(kind, key))) });
    }
  }

  #readSavingStatus() {
    const id = this.#locationId();
    const liveRain = this.#rainConfig(), liveWeather = this.#locationWeather(id);
    const baseRain = this.#getBaseRain?.(), baseWeather = this.#getBaseLocationWeather?.(id);
    if (!liveRain || !liveWeather || !baseRain || !baseWeather) return "Параметри погоди завантажено.";
    const changed = changedWeatherParts(baseRain, liveRain, baseWeather, liveWeather);
    return changed.length
      ? `Змінено (ще не в коді): ${changed.map((part) => PART_LABELS[part] ?? part).join(", ")}.`
      : "Погода збігається з кодом.";
  }

  async #buildExport(hashText) {
    const id = this.#locationId();
    const liveRain = this.#rainConfig(), liveWeather = this.#locationWeather(id);
    if (!liveRain || !liveWeather) return { error: "Немає параметрів погоди для експорту." };
    const baseRain = this.#getBaseRain?.() ?? liveRain;
    const baseWeather = this.#getBaseLocationWeather?.(id) ?? liveWeather;
    const moment = this.#now();
    return {
      fileName: weatherFileName(id, this.#gameVersion, moment),
      data: buildWeatherFile({
        locationId: id,
        rain: liveRain,
        locationWeather: liveWeather,
        rainBaseHash: await rainHash(baseRain, hashText),
        locationWeatherBaseHash: await locationWeatherHash(baseWeather, hashText),
        gameVersion: this.#gameVersion,
        exportedAt: moment.toISOString(),
      }),
    };
  }

  #applyImport(file, setStatus) {
    const id = this.#locationId();
    if (file?.locationId && file.locationId !== id) {
      setStatus(`Файл для локації ${file.locationId}; зараз відкрито ${id}.`);
      return;
    }
    const errors = validateWeatherFile(file, {
      rainTemplate: this.#getBaseRain?.() ?? this.#rainConfig(),
      locationWeatherTemplate: this.#getBaseLocationWeather?.(id) ?? this.#locationWeather(id),
    });
    if (errors.length) {
      setStatus(`Файл не прийнято: ${errors.slice(0, 3).join("; ")}`);
      return;
    }
    this.#updateConfig?.(["CONFIG", "canvas", "rain"], canonicalRain(file.rain));
    this.#updateConfig?.(["CONFIG", "locations", "map", id, "weather"], canonicalLocationWeather(file.locationWeather));
    this.#fill();
  }

  // Each process's own course — held by hand, its event (phase, elapsed / duration, peak) or, idle, its cooldown or the
  // chance of its next check.
  #eventText(event) {
    if (!event) return "—";
    const strength = percent(event.strength);
    if (event.held) return `${strength} · вручну`;
    if (event.active) {
      return `${strength} · ${EVENT_PHASES[event.phase] ?? event.phase} ${seconds(event.elapsedSec)} з ${seconds(event.durationSec)}` +
        `, пік ${percent(event.peakStrength)} ${seconds(event.peakStartSec)}–${seconds(event.peakEndSec)}`;
    }
    return event.cooldownLeftSec > 0 ? `${strength} · пауза ще ${seconds(event.cooldownLeftSec)}`
      : `${strength} · шанс перевірки ${(event.chance * 100).toFixed(2)}%`;
  }

  #emissionText(snapshot) {
    if (!snapshot) return "—";
    if (snapshot.intensityHeld) return `${percent(snapshot.intensity)} · вручну`;
    const idle = snapshot.phase === "idle";
    const left = snapshot.frozen ? "заморожено"
      : !idle ? `ще ${seconds(snapshot.phaseLeftSec)}`
        : snapshot.cooldownLeftSec > 0 ? `пауза ще ${seconds(snapshot.cooldownLeftSec)}`
          : `шанс перевірки ${(snapshot.chance * 100).toFixed(2)}%`;
    return `${EMISSION_LABELS[snapshot.phase] ?? snapshot.phase} · ${percent(snapshot.intensity)} · ${left}`;
  }

  #renderStatus(weather, controls) {
    const wind = this.#weather.getWind?.() ?? null;
    const emission = this.#weather.getEmissionModel?.()?.snapshot ?? null;
    this.#ui.createInfoRow("дощ", this.#eventText(weather.events?.rain), controls);
    this.#ui.createInfoRow("шторм", this.#eventText(weather.events?.storm), controls);
    this.#ui.createInfoRow("туман", this.#eventText(weather.events?.fog), controls);
    this.#ui.createInfoRow("викид", this.#emissionText(emission), controls);
    if (emission) this.#ui.createInfoRow("радіація", `${percent(emission.radiation)}${emission.radiationForced ? " (вручну)" : ""}`, controls);
    const windText = wind
      ? `${WIND_NAMES[wind.direction] ?? wind.direction}${wind.state && wind.direction !== 0 ? ` · ${WIND_STATE_LABELS[wind.state] ?? wind.state}` : ""}` +
        ` · ${percent(wind.strength)}${wind.isGusting ? " (порив)" : ""}${wind.forced || wind.forcedStrength != null ? " (вручну)" : ""}`
      : "—";
    this.#ui.createInfoRow("вітер", windText, controls);
    this.#ui.createInfoRow("блискавки", `${weather.lightningActive ? "ідуть" : "немає"} · ударів ${weather.strikeSerial}, ` +
      `остання: варіант ${weather.strikeVariant + 1}, відстань ${percent(weather.strikeDistance)}`, controls);
    if (this.#weather.sessionSeed !== undefined) this.#ui.createInfoRow("сід сесії", String(this.#weather.sessionSeed), controls);
    this.#ui.createButtonRow("↻ Оновити", controls, () => this.#fill());
  }

  // TK-327.1: what the running events rolled — duration, peak (start, length, strength) and the storm's lightning.
  #renderGenerated(weather, emission, controls) {
    const minutes = (sec) => `${Math.floor((Number(sec) || 0) / 60)}:${String(Math.round((Number(sec) || 0) % 60)).padStart(2, "0")}`;
    const course = (event) => `${minutes(event.durationSec)}, пік з ${minutes(event.peakStartSec)} до ${minutes(event.peakEndSec)}, ` +
      `сила ${percent(event.peakStrength)}`;
    for (const [kind, label] of EVENTS) {
      const event = weather.events?.[kind];
      if (!event?.active) continue;
      let text = course(event);
      if (kind === "storm") {
        text += weather.lightning?.has
          ? `; блискавки ${minutes(weather.lightning.startSec)}–${minutes(weather.lightning.endSec)}` : "; без блискавок";
      }
      this.#ui.createInfoRow(`згенеровано: ${label.toLowerCase()}`, text, controls);
    }
    if (emission && emission.phase !== "idle" && !emission.intensityHeld) {
      this.#ui.createInfoRow("згенеровано: викид", course(emission), controls);
    }
  }

  #renderControls(model, content) {
    const weather = model.snapshot;
    const controls = this.#createSection("Стан і керування", content, ["WEATHER", "controls"]);
    this.#renderGenerated(weather, this.#weather.getEmissionModel?.()?.snapshot ?? null, controls);
    this.#renderStatus(weather, controls);
    // D10: moving a slider holds that element by hand; «↺ Автоматична погода» returns everything.
    for (const [kind, label] of EVENTS) {
      const event = weather.events?.[kind];
      // TK-327.1: on starts a random event (as the game would), off ends it and releases its slider's hold.
      this.#ui.createSwitcherRow(label, event?.active === true || event?.held === true, controls, (on) => {
        if (on) model.start(kind);
        else {
          model.hold(kind, null, { fadeSec: this.#fadeSec });
          model.stop(kind);
        }
        this.#fill();
      }, ["WEATHER", "controls", kind]);
      if (event?.held) this.#levels[kind] = Math.round(event.strength * 100);
      this.#ui.createRangeRow(`${label}: сила, %`, this.#levels[kind], controls, (value) => {
        this.#levels[kind] = clamp(value, 0, 100);
        model.hold(kind, this.#levels[kind] / 100, { fadeSec: this.#fadeSec });
      }, ["WEATHER", "controls", `${kind}Strength`]);
      if (kind === "rain") this.#renderAt100Sliders("rain", this.#group("Дощ при силі 100", controls, ["WEATHER", "controls", "rainAt100"]));
    }
    const emission = this.#weather.getEmissionModel?.() ?? null;
    if (emission) {
      const snapshot = emission.snapshot;
      this.#ui.createSwitcherRow("Викид", snapshot.phase !== "idle", controls, (on) => {
        if (on) emission.force("onset");
        else {
          emission.holdIntensity(null);
          emission.force("idle");
        }
        this.#fill();
      }, ["WEATHER", "controls", "emission"]);
      if (snapshot.intensityHeld) this.#levels.emission = Math.round(snapshot.intensity * 100);
      this.#ui.createRangeRow("Викид: сила, %", this.#levels.emission, controls, (value) => {
        this.#levels.emission = clamp(value, 0, 100);
        emission.holdIntensity(this.#levels.emission / 100);
      }, ["WEATHER", "controls", "emissionStrength"]);
    }
    if (this.#weather.holdAsh) {
      this.#ui.createRangeRow("Попіл: сила, %", this.#levels.ash, controls, (value) => {
        this.#levels.ash = clamp(value, 0, 100);
        this.#weather.holdAsh(this.#levels.ash / 100);
      }, ["WEATHER", "controls", "ashStrength"]);
      this.#renderAt100Sliders("ash", this.#group("Попіл при силі 100", controls, ["WEATHER", "controls", "ashAt100"]));
    }
    this.#renderWindControls(controls);
    if (this.#weather.holdWaves) {
      this.#ui.addParameter(controls, { control: "range", label: "Хвилі: висота, % від звичайної", value: this.#levels.waves,
        min: 0, max: 300, step: 5, onCommit: (value) => {
          this.#levels.waves = clamp(value, 0, 300);
          this.#weather.holdWaves(this.#levels.waves / 100);
        }, path: ["WEATHER", "controls", "waves"] });
    }
    const current = this.#locationsMap?.()?.[this.#weather.locationId]?.environment?.current;
    if (current && Number.isFinite(Number(current.speedPxPerSec))) {
      const currentPath = ["CONFIG", "locations", "map", this.#weather.locationId, "environment", "current", "speedPxPerSec"];
      this.#ui.addParameter(controls, { control: "range", label: "Течія, px/с", value: clamp(current.speedPxPerSec, 0, 60),
        min: 0, max: 60, step: 0.5, onCommit: (value) => this.#updateConfig?.(currentPath, Number(value)),
        path: ["WEATHER", "controls", "current"], bindingPath: currentPath, ...this.#changeTracking(currentPath) });
    }
    this.#ui.createInputRow("перехід, с", this.#fadeSec, controls, "number", (value) => {
      this.#fadeSec = Math.max(0, Number(value) || 0);
    });
    this.#renderActions(model, emission, controls);
  }

  #renderWindControls(controls) {
    const wind = this.#weather.getWind?.() ?? null;
    if (this.#weather.setWind) {
      const current = WIND_CHOICES.find((choice) => wind?.forced && choice.direction === wind.direction) ?? WIND_CHOICES[0];
      this.#ui.createSelectRow("Вітер: напрям", WIND_CHOICES.map((choice) => choice.label), current.label, controls, (label) => {
        this.#weather.setWind(WIND_CHOICES.find((choice) => choice.label === label)?.direction ?? null);
        this.#fill();
      }, ["WEATHER", "controls", "windDirection"]);
    }
    if (this.#weather.setWindStrength) {
      if (wind?.forcedStrength != null) this.#levels.wind = Math.round(Number(wind.forcedStrength) * 100);
      this.#ui.createRangeRow("Вітер: сила, %", this.#levels.wind, controls, (value) => {
        this.#levels.wind = clamp(value, 0, 100);
        this.#weather.setWindStrength(this.#levels.wind / 100);
      }, ["WEATHER", "controls", "windStrength"]);
    }
  }

  #renderActions(model, emission, controls) {
    if (emission) {
      for (const [label, phase] of EMISSION_ACTIONS) {
        this.#ui.createButtonRow(label, controls, () => {
          emission.force(phase);
          this.#fill();
        }, false, "", ["WEATHER", "emission", phase]);
      }
    }
    if (this.#weather.triggerWindGust) {
      this.#ui.createButtonRow("Порив вітру зараз", controls, () => {
        this.#weather.triggerWindGust();
        this.#fill();
      }, false, "", ["WEATHER", "controls", "gust"]);
    }
    this.#ui.createButtonRow("Удар блискавки зараз", controls, () => {
      model.strike();
      this.#fill();
    }, false, "", ["WEATHER", "controls", "strike"]);
    this.#ui.createButtonRow("↺ Автоматична погода", controls, () => {
      model.releaseAll();
      this.#weather.setWind?.(null);
      this.#weather.setWindStrength?.(null);
      this.#weather.getEmissionModel?.()?.holdIntensity(null);
      this.#weather.holdAsh?.(null);
      this.#weather.holdWaves?.(null);
      this.#fill();
    });
  }
}
