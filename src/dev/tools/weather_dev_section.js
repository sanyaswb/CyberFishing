import { DevSavingSection } from "./export/dev_saving_section.js";
import {
  GENERAL_WEATHER_PART_IDS,
  GENERAL_WEATHER_PARTS,
  buildWeatherFile,
  canonicalGeneralPart,
  canonicalLocationWeather,
  changedWeatherParts,
  generalPartHash,
  locationWeatherHash,
  readWeatherFile,
  validateWeatherFile,
  weatherFileName,
} from "../weather/weather_export_format.js";

// DevTools «ПОГОДА» (spec 172, 175, 179; spec 180 stage C, TK-327).
// - On top: the selector «Загальні» | «Всі» | a location (spec 180 D4, D11; TK-333): «Загальні» — the general settings,
//   a location — only what belongs to it, «Всі» — both together in every section (the location picked last).
// - «Керування» (TK-360; was «Стан і керування») of the location the game runs (D10). TK-367 (owner): «Оновити» on top,
//   «Автоматична погода» under it, the live state of every process; then every element (rain, storm, fog, emission,
//   starfall, ash, wind, waves, current) as a switch that follows its live state. While an element is on: its slider
//   (standing at the live value; moving it holds the element by hand, the label then says «· вручну»), the wind's
//   direction «← вліво | авто | вправо →», «авто» (this element back to its own course) while it is held, and its
//   settings collapsed under it — the rain's and the ash's look at strength 100 (D16), the others' config trees. The
//   ash, waves, current and wind: on holds the slider's value, off holds 0 (the wind calm). The actions (emission parts,
//   a gust, a strike) come last, «Болід» at the very end (on a phone it closes the panel, so the bolide is seen).
//   TK-367.1 (owner): the buttons two to a line with short labels (DevToolsUI.createButtonGrid): «Оновити» on top;
//   «Викид: пік | Викид: спад», «Порив вітру | Блискавка», «Болід» at the bottom.
//   TK-398 (owner): the switch «Автоматична погода» under «Оновити» (it replaced the button «Авто погода»): off — nothing
//   starts by itself and everything goes out; every element's own switch still turns it on, with its links to the
//   others (the emission's ash and storm, TK-399: not the rain; the storm's wind and waves). An event's switch off
//   under the emission's floor holds it at 0.
// - TK-360: the switches follow the live state. While the panel is open, refreshLive() (each live update) compares
//   which elements are on — one integer — with what the section shows, and redraws it only when that changed: a fog
//   that started by itself shows at once, not at the next redraw caused by another control.
// - TK-400 (owner): the section's own «i» — the automatic weather, the states on now and a short line for each (strength,
//   phase, time left), the radiation; its texts follow the live updates while it is open.
// - Sections by element: ДОЩ, ШТОРМ, ВІТЕР, ТУМАН, ВИКИД, РАДІАЦІЯ (TK-337), ПОПІЛ, ВОДА, ПОЧАТОК І ПОРОГИ — general and location parts by
//   the selector; a section with edits not in the code is marked «· змінено» and has «Скинути розділ до коду» (D8).
// - «Збереження» (spec 175, spec 180 stage D, TK-332): the file holds the level the selector shows — «Загальні»: the
//   general rain, ash, storm and wind settings; a location: its weather; «Всі»: both.
//   The status names every part of both levels that differs from the code, and what an export would leave out.
// TK-327.1 (owner): only an element's section opens inside (a different section); everything in it — its groups and
// the trees' nested objects — opens in place under it (inline). The selector is buttons on top (no empty wrapper); each
// event (rain, storm, fog, emission) has a switch: on starts a random event as the game would, off ends it, and the
// event's generated course (duration, peak, strength, lightning) shows on top of «Керування».
const GENERAL = "Загальні";
const ALL = "Всі";
const EVENT_PHASES = Object.freeze({ rise: "розгін", peak: "пік", fall: "затухання", idle: "немає" });
const EVENTS = Object.freeze([["rain", "Дощ"], ["storm", "Шторм"], ["fog", "Туман"]]);
const EMISSION_LABELS = Object.freeze({ idle: "немає", onset: "початок", peak: "пік", fade: "затихання" });
// TK-327.1: starting and ending the emission is its switch; these jump within the running one.
const EMISSION_ACTIONS = Object.freeze([
  Object.freeze(["Викид: пік", "peak"]),
  Object.freeze(["Викид: спад", "fade"]),
]);
// TK-367 (owner): the wind's direction as buttons «← вліво | авто | вправо →»; calm is the wind's switch off.
const WIND_CHOICES = Object.freeze([
  Object.freeze({ value: "left", label: "← вліво", direction: -1 }),
  Object.freeze({ value: "auto", label: "авто", direction: null }),
  Object.freeze({ value: "right", label: "вправо →", direction: 1 }),
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
const PART_LABELS = Object.freeze({ rain: "Дощ", ash: "Попіл", storm: "Шторм", wind: "Вітер", locationWeather: "Параметри локації" });
const samePath = (path, prefix) => prefix.every((key, index) => path[index] === key);

const percent = (value) => `${Math.round((Number(value) || 0) * 100)}%`;
const seconds = (value) => `${Math.round(Number(value) || 0)} с`;
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
// TK-354.1: the game hour the «Зорепад» test switch jumps to (inside the starfall's night 21:00–5:00).
const STARFALL_TEST_HOUR = 23;
// TK-360: one bit per element with a switch — which of them are on (refreshLive compares it with the shown one).
// TK-367: also the ash, the wind, the waves and the current (each on while it shows: ash / current above zero, the
// wind not calm, the waves not held flat).
const LIVE_BITS = Object.freeze({ rain: 1, storm: 2, fog: 4, emission: 8, starfall: 16, ash: 32, wind: 64, waves: 128,
  current: 256 });
// Below this a live share or speed counts as off.
const LIVE_EPSILON = 1e-3;
// TK-398.1: the waves' live height (× the usual) above which they count as on without a hold.
const WAVES_SHOWN = 0.01;
// TK-400: the states the section's «i» lists, in this order (each a LIVE_BITS key), with their short names.
const SUMMARY_STATES = Object.freeze([["rain", "дощ"], ["storm", "шторм"], ["fog", "туман"], ["emission", "викид"],
  ["wind", "вітер"], ["ash", "попіл"], ["starfall", "зорепад"], ["waves", "хвилі"], ["current", "течія"]]);
const clockText = (sec) => {
  const total = Math.max(0, Math.round(Number(sec) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

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
  #getBaseGeneral;
  #getBaseLocationWeather;
  #resetWeather;
  #gameVersion;
  #now;
  #savingSection;
  #content = null;
  #view;
  #marks = [];
  // TK-400: the «i» rows that follow the live state: { kind, element } (the value element).
  #summary = [];
  // TK-401: the «Керування» sliders that follow the live value: { path, read: () => slider value, shown }.
  #liveSliders = [];
  #listening = false;
  // The levels a switch turns on with (the last live value above zero): %, the waves' % of the usual, the current px/s.
  #levels = { rain: 70, storm: 80, fog: 60, emission: 100, ash: 100, wind: 40, waves: 100, current: 10 };
  // Spec 182 stage E: the starfall's strength by hand, %.
  #starfallLevel = 70;
  #fadeSec = 5;
  #radiation = 50;
  // TK-360: which switched elements are on in what the section shows (LIVE_BITS), -1 before the first draw.
  #shownLive = -1;
  #closeOnPhone;
  #onConfigUpdated = (event) => {
    const path = event?.detail?.path;
    if (!Array.isArray(path) || path[0] !== "CONFIG") return;
    this.#refreshMarks();
    if (!this.#savingSection.hasStatusElement) return;
    const rest = path.slice(1);
    const isGeneral = GENERAL_WEATHER_PART_IDS.some((part) => samePath(rest, GENERAL_WEATHER_PARTS[part].configPath));
    const isLocation = samePath(rest, ["locations", "map", this.#locationId(), "weather"]);
    if (isGeneral || isLocation) this.#savingSection.refreshStatus();
  };

  // weather: the DEV port { getModel(), isAutomatic(), setAutomatic(on), getWindModel(), getEmissionModel(), getWind(), setWind(dir | null),
  //   setWindStrength(0…1 | null), triggerWindGust(), holdAsh(0…1 | null), holdWaves(scale | null), requestImage(id),
  //   sessionSeed, locationId }; config: () => the active location's weather; locationConfig(id) / locationsMap();
  //   general: () => { rain, ash, water, storm, wind, screen } (the general settings); edits: { hasOverrides(parts),
  //   resetTree(parts) } (the «змінено» mark and the section reset); getBaseGeneral: () => { rain, ash, storm, wind } as
  //   in the code, getBaseLocationWeather(id); resetWeather({ general, locationId }) drops the session's edits of the
  //   general parts (general: true) and / or of that location's weather (spec 180 stage D).
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
    getBaseGeneral = null,
    getBaseLocationWeather = null,
    resetWeather = null,
    gameVersion = "",
    now = () => new Date(),
    view = {},
    closeOnPhone = () => {},
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
    this.#getBaseGeneral = getBaseGeneral;
    this.#getBaseLocationWeather = getBaseLocationWeather;
    this.#resetWeather = resetWeather;
    this.#gameVersion = gameVersion;
    this.#now = now;
    this.#closeOnPhone = closeOnPhone;
    // TK-333.2 (owner): «Всі» by default, and the choice outlives the section — the panel draws a new section every
    // time it opens, so the choice lives in view (owned by the module, which lives as long as the page).
    this.#view = view;
    this.#view.selected ??= ALL;
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
          "Експорт погоди завантажує файл того, що показує вибір нагорі: «Загальні» — дощ, попіл, шторм і вітер для всіх локацій; локація — її погода; «Всі» — обидва. У код зміни переносить команда npm run apply:weather -- <файл> (перевірка, конфлікти, підтвердження, бекап); після неї перезавантажте сторінку або скиньте зміни погоди до коду. Імпорт погоди відкриває такий файл тут, щоб продовжити редагування; скидання скидає те саме, що йде в експорт. Вода й екран викиду в експорт не входять. Без експорту зміни зникають при перезавантаженні.",
      },
      readStatus: () => this.#readSavingStatus(),
      buildExport: (hashText) => this.#buildExport(hashText),
      onImport: (file, setStatus) => this.#applyImport(file, setStatus),
      onReset: () => {
        const mode = this.#mode();
        this.#resetWeather({ general: mode.general, locationId: mode.location });
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
    this.#marks = [];
    this.#summary.length = 0;
    this.#liveSliders.length = 0;
    this.#content = null;
    this.#shownLive = -1;
  }

  // TK-360: called on every live update while the panel is open; redraws only when an element turned on or off.
  // TK-400: otherwise the section's «i» texts follow the live state, only while that «i» is open.
  refreshLive() {
    if (!this.#content || this.#shownLive < 0) return;
    if (this.#liveState() !== this.#shownLive) this.#fill();
    else {
      this.#refreshSummary();
      this.#refreshSliders();
    }
  }

  // TK-401 (owner: «повзунок в керуванні теж плавно рухається в залежності від %»): a slider shown in «Керування»
  // follows its element's live value (the wind with its gusts); a value held by hand shows that value.
  #followLive(path, read) {
    this.#liveSliders.push({ path, read, shown: read() });
  }

  // Moves the sliders whose live value changed (DevToolsUI.showLiveValue: a slider the person is moving keeps theirs).
  #refreshSliders() {
    for (const slider of this.#liveSliders) {
      const value = slider.read();
      if (value === slider.shown) continue;
      slider.shown = value;
      this.#ui.showLiveValue(slider.path, value);
    }
  }

  // TK-400 (owner: «актуальну інформацію які стани активні і параметри коротко»): the section's «i» — the automatic
  // weather, which states are on, the radiation, and one short line per state that is on. Which lines exist follows the
  // redraw (LIVE_BITS); their texts follow refreshLive.
  #renderSummary(content) {
    const add = (kind, label) => {
      const element = this.#ui.createInfoRow(label, this.#summaryText(kind), content, ["WEATHER", "summary", kind]);
      if (element) this.#summary.push({ kind, element });
    };
    add("automatic", "автоматика");
    add("active", "активні");
    add("radiation", "радіація");
    const live = this.#liveState();
    for (const [kind, label] of SUMMARY_STATES) if (live & LIVE_BITS[kind]) add(kind, label);
  }

  // Rewrites the «i» texts that changed; nothing while the «i» is closed (its rows' container is hidden).
  #refreshSummary() {
    const first = this.#summary[0]?.element;
    const info = first?.parentNode?.parentNode;
    if (!info || info.hidden !== false) return;
    for (const entry of this.#summary) {
      const text = this.#summaryText(entry.kind);
      if (entry.element.innerText !== text) entry.element.innerText = text;
    }
  }

  #summaryText(kind) {
    const weather = this.#weather;
    const snapshot = weather.getModel()?.snapshot ?? null;
    switch (kind) {
      case "automatic": return weather.isAutomatic?.() === false ? "вимкнена (лише вручну)" : "увімкнена";
      case "active": {
        const live = this.#liveState();
        const names = SUMMARY_STATES.filter(([state]) => live & LIVE_BITS[state]).map(([, label]) => label);
        return names.length ? names.join(", ") : "нічого";
      }
      case "radiation": {
        const emission = weather.getEmissionModel?.()?.snapshot ?? null;
        return emission ? `${percent(emission.radiation)}${emission.radiationForced ? " · вручну" : ""}` : "—";
      }
      case "rain":
      case "storm":
      case "fog": return this.#summaryEvent(kind, snapshot);
      case "emission": {
        const emission = weather.getEmissionModel?.()?.snapshot ?? null;
        if (!emission) return "—";
        if (emission.intensityHeld) return `${percent(emission.intensity)} · вручну`;
        return `${EMISSION_LABELS[emission.phase] ?? emission.phase} · ${percent(emission.intensity)} · ще ${clockText(emission.phaseLeftSec)}`;
      }
      case "wind": {
        const wind = weather.getWind?.() ?? null;
        if (!wind) return "—";
        return `${WIND_NAMES[wind.direction] ?? wind.direction} · ${percent(wind.strength)}${wind.isGusting ? " · порив" : ""}` +
          `${wind.forced || wind.forcedStrength != null ? " · вручну" : ""}`;
      }
      case "ash": return percent(weather.getAshStrength?.() ?? 0);
      case "starfall": {
        const starfall = weather.getStarfallModel?.()?.snapshot ?? null;
        return starfall ? `${percent(starfall.strength)}${starfall.held ? " · вручну" : ""}` : "—";
      }
      case "waves": {
        const hold = weather.getWavesHold?.() ?? null;
        return hold === null ? "від вітру й шторму" : `${percent(hold)} звичайних · вручну`;
      }
      case "current": return `${Math.round(Number(weather.getCurrentSpeed?.() ?? 0) * 10) / 10} px/с`;
      default: return "—";
    }
  }

  // A weather event in short: its strength, phase and time left; by hand, or held up by the emission's floor.
  #summaryEvent(kind, snapshot) {
    const event = snapshot?.events?.[kind];
    if (!event) return "—";
    const strength = percent(event.strength);
    const lightning = kind === "storm" && snapshot.lightningActive ? " · блискавки" : "";
    if (event.held) return `${strength} · вручну${lightning}`;
    if (!event.active) return `${strength} · від викиду${lightning}`;
    const left = Math.max(0, (Number(event.durationSec) || 0) - (Number(event.elapsedSec) || 0));
    return `${strength} · ${EVENT_PHASES[event.phase] ?? event.phase} · ще ${clockText(left)}${lightning}`;
  }

  // Which switched elements are on now (LIVE_BITS); reads the snapshots, allocates nothing.
  #liveState() {
    const events = this.#weather.getModel()?.snapshot?.events;
    const emission = this.#weather.getEmissionModel?.()?.snapshot ?? null;
    const starfall = this.#weather.getStarfallModel?.()?.snapshot ?? null;
    let state = 0;
    for (const [kind] of EVENTS) if (this.#eventOn(events?.[kind])) state |= LIVE_BITS[kind];
    if (emission && emission.phase !== "idle") state |= LIVE_BITS.emission;
    if (starfall?.held === true) state |= LIVE_BITS.starfall;
    const weather = this.#weather;
    if ((weather.getAshStrength?.() ?? 0) > LIVE_EPSILON) state |= LIVE_BITS.ash;
    if (this.#windOn(weather.getWind?.() ?? null)) state |= LIVE_BITS.wind;
    if (this.#wavesOn()) state |= LIVE_BITS.waves;
    if (Number(weather.getCurrentSpeed?.() ?? 0) > LIVE_EPSILON) state |= LIVE_BITS.current;
    return state;
  }

  // TK-398.1 (owner): the waves are on while held above zero by hand, or, from the weather, while they really show (the
  // live height above WAVES_SHOWN of the usual) — flat water without the automatic weather is off. No reader: off.
  #wavesOn() {
    const weather = this.#weather;
    if (!weather.getWavesHold) return false;
    const hold = weather.getWavesHold();
    if (hold !== null) return hold > 0;
    return Number(weather.getWavesScale?.() ?? 1) > WAVES_SHOWN;
  }

  // TK-398: on while it runs or heads above zero — an emission's floor shows it too, a hold at 0 (switched off) does not.
  #eventOn(event) {
    if (!event) return false;
    const rising = Number(event.target) > LIVE_EPSILON;
    return event.held === true ? rising : event.active === true || rising;
  }

  // The location the selector names (or the game's, with «Загальні»): export, import and the location parts use it.
  #locationId() {
    const map = this.#locationsMap?.();
    const id = this.#view.selected === ALL ? this.#view.lastLocation : this.#view.selected;
    if (id !== GENERAL && map?.[id]?.weather) return id;
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

  // What the selector shows: «Загальні» — the general parts; a location — its parts; «Всі» (TK-333) — both, for the
  // location picked last (at first the game's).
  #mode() {
    if (this.#view.selected === GENERAL) return { location: null, general: true };
    return { location: this.#locationId(), general: this.#view.selected === ALL };
  }

  #fill() {
    const content = this.#content;
    if (!content) return;
    // TK-387: the one redraw path (R23: an open drill-in is reopened; bindings and the section's «i» released).
    this.#ui.redraw(content, () => {
      this.#marks = [];
      this.#summary.length = 0;
      this.#liveSliders.length = 0;
      this.#savingSection.clear();
      this.#renderSelector(content);
      const model = this.#weather.getModel();
      if (!model) {
        this.#ui.createInfoRow("стан", "погода не створена", content);
        return;
      }
      this.#renderSummary(content);
      this.#renderControls(model, content);
      const mode = this.#mode();
      this.#renderRain(content, mode);
      this.#renderStorm(content, mode);
      this.#renderWind(content, mode);
      if (mode.location) this.#renderFog(content, mode);
      this.#renderEmission(content, mode);
      this.#renderRadiation(content, mode);
      this.#renderAsh(content, mode);
      this.#renderStarfall(content, mode);
      this.#renderWater(content, mode);
      if (mode.location) this.#renderStart(content, mode);
      this.#savingSection.render(this.#createSection("Збереження", content, ["WEATHER", "saving"]));
    });
  }

  // TK-327.1: «Загальні», «Всі» (TK-333) and every location as buttons on top (all visible, one press).
  #renderSelector(content) {
    const options = [{ value: GENERAL, label: GENERAL }, { value: ALL, label: ALL },
      ...this.#locationChoices().map((id) => ({ value: id, label: id }))];
    this.#ui.addParameter(content, { control: "segments", label: "налаштування", options, value: this.#view.selected,
      onCommit: (next) => {
        this.#view.selected = next;
        if (next !== GENERAL && next !== ALL) this.#view.lastLocation = next;
        this.#fill();
      }, path: ["WEATHER", "location", "id"] });
    if (this.#view.selected === GENERAL) return;
    const id = this.#locationId();
    if (this.#view.selected === ALL) this.#ui.createInfoRow("показано", `загальні й локація ${id}`, content);
    if (id !== this.#weather.locationId) {
      this.#ui.createInfoRow("активна у грі", `${this.#weather.locationId} (нижче — ${id})`, content);
    }
  }

  // A section of one element; parts: the CONFIG roots it edits (for «змінено» and the reset).
  // TK-333: the mark and the reset follow every edit in place (#refreshMarks), not only the next redraw.
  #elementSection(title, key, content, parts, body) {
    const changed = this.#sectionChanged(parts);
    const section = this.#createSection(changed ? `${title} · змінено` : title, content, ["WEATHER", key]);
    body(section);
    if (!this.#edits) return;
    const resetRow = this.#ui.createButtonRow("Скинути розділ до коду", section, () => {
      for (const part of parts) this.#edits.resetTree(part);
      this.#fill();
    }, false, "", ["WEATHER", key, "reset"], { icon: "reset" });
    resetRow.style.display = changed ? "" : "none";
    this.#marks.push({ section, title, parts, resetRow });
  }

  #sectionChanged(parts) {
    return this.#edits ? parts.some((part) => this.#edits.hasOverrides(part)) : false;
  }

  #refreshMarks() {
    for (const mark of this.#marks) {
      const changed = this.#sectionChanged(mark.parts);
      this.#ui.setSectionLabel(mark.section, changed ? `${mark.title} · змінено` : mark.title);
      mark.resetRow.style.display = changed ? "" : "none";
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
    if (mode.location) parts.push(this.#locationParts(mode.location, "emission"));
    this.#elementSection("ВИКИД", "emission", content, parts, (section) => {
      if (emission) {
        const snapshot = emission.snapshot;
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
        // Spec 179 stage J (TK-372): the view's shake.
        this.#tree(screen?.shake, this.#group("Тряска", section, ["WEATHER", "emission", "shake"]), ["emission", "screen", "shake"]);
        if (screen) {
          // TK-333: the screen effect's own switch (it had no control in this section).
          const enabledPath = ["CONFIG", "emission", "screen", "enabled"];
          this.#ui.addParameter(section, { control: "switch", label: "Ефект екрана (затемнення й розмиття)", value: screen.enabled !== false,
            onCommit: (on) => this.#updateConfig?.(enabledPath, on === true),
            path: ["WEATHER", "emission", "screenEnabled"], bindingPath: enabledPath, ...this.#changeTracking(enabledPath) });
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
    });
  }

  // TK-337 (owner): the radiation in its own section under the emission — set by hand now, and the location's levels.
  #renderRadiation(content, mode) {
    const emission = this.#weather.getEmissionModel?.() ?? null;
    if (!emission && !mode.location && !this.#general()?.grain) return;
    const parts = mode.location ? [this.#locationParts(mode.location, "radiation")] : [];
    if (mode.general) parts.push(["canvas", "radiationGrain"], ["ui", "audio", "geiger"]);
    this.#elementSection("РАДІАЦІЯ", "radiation", content, parts, (section) => {
      if (emission) {
        const snapshot = emission.snapshot;
        if (snapshot.radiationForced) this.#radiation = Math.round(snapshot.radiation * 100);
        this.#ui.createSwitcherRow("Радіація вручну", snapshot.radiationForced, section, (on) => {
          emission.setRadiationOverride(on ? this.#radiation / 100 : null);
          this.#fill();
        }, ["WEATHER", "radiation", "hold"]);
        this.#ui.createRangeRow("радіація, %", this.#radiation, section, (value) => {
          this.#radiation = clamp(value, 0, 100);
          emission.setRadiationOverride(this.#radiation / 100);
          this.#ui.syncValue?.(["WEATHER", "radiation", "hold"], true);
        }, ["WEATHER", "radiation", "level"]);
      }
      // TK-338: the radiation's hiss over the scene (general).
      if (mode.general) this.#tree(this.#general()?.grain, this.#group("Шипіння (загальне)", section, ["WEATHER", "radiation", "grain"]),
        ["canvas", "radiationGrain"]);
      // TK-339: the Geiger counter's clicks (general).
      if (mode.general) this.#tree(this.#general()?.geiger, this.#group("Звук лічильника (загальне)", section,
        ["WEATHER", "radiation", "sound"]), ["ui", "audio", "geiger"]);
      if (!mode.location) return;
      this.#tree(this.#locationWeather(mode.location)?.radiation, this.#group("Радіація (локація)", section,
        ["WEATHER", "radiation", "config"]), this.#locationParts(mode.location, "radiation"));
    });
  }

  // Spec 182 stage E (TK-354): the starfall — the night's state and plan; the stars' and the bolide's look (general) and
  // the night's settings (location). The test controls are in «Стан і керування» (TK-354.1).
  #renderStarfall(content, mode) {
    const starfall = this.#weather.getStarfallModel?.() ?? null;
    const parts = [];
    if (mode.general) parts.push(["canvas", "starfall"]);
    if (mode.location) parts.push(this.#locationParts(mode.location, "starfall"));
    this.#elementSection("ЗОРЕПАД", "starfall", content, parts, (section) => {
      if (starfall) {
        const snapshot = starfall.snapshot;
        // TK-354.1 (owner): the test switch, its strength and «Болід зараз» live in «Стан і керування».
        this.#ui.createInfoRow("ніч", this.#starfallText(snapshot), section);
      }
      if (mode.general) this.#tree(this.#general()?.starfall, this.#group("Зорі й болід (загальне)", section,
        ["WEATHER", "starfall", "look"]), ["canvas", "starfall"]);
      if (mode.location) this.#tree(this.#locationWeather(mode.location)?.starfall, this.#group("Ніч зорепаду (локація)", section,
        ["WEATHER", "starfall", "night"]), this.#locationParts(mode.location, "starfall"));
    });
  }

  // The night now: outside the window, a plain night, or a starfall night with its plan, strength and bolide.
  #starfallText(snapshot) {
    const clock = (hours) => `${Math.floor(hours)}:${String(Math.round((hours % 1) * 60) % 60).padStart(2, "0")}`;
    const strength = `сила ${percent(snapshot.strength)}${snapshot.held ? " (вручну)" : ""}`;
    if (!snapshot.inWindow) return `поза вікном · ${strength}`;
    if (!snapshot.active) return `звичайна ніч (перевірка не прокнула) · ${strength}`;
    const periods = snapshot.periodLevels.map((level) => Math.round(level * 100)).join(", ");
    const bolide = snapshot.bolideAtHours === null ? "без боліда" : `болід через ${clock(Math.max(0, snapshot.bolideAtHours - snapshot.positionHours))} год`;
    return `зорепадна ніч · періоди ${periods} · ${strength} · ${bolide}`;
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
    if (this.#view.selected === GENERAL) return generalEnd;
    const override = this.#locationWeather(this.#locationId())?.look?.[kind]?.[key];
    return Number.isFinite(Number(override)) ? Number(override) : generalEnd;
  }

  #setAt100(kind, key, value) {
    if (this.#view.selected === GENERAL) {
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
    const selectedId = this.#view.selected === GENERAL ? null : this.#locationId();
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

  // The general parts as they run now: { rain, ash, storm, wind } (a part the port lacks is null).
  #liveGeneral() {
    const general = this.#general?.() ?? {};
    const live = {};
    for (const part of GENERAL_WEATHER_PART_IDS) live[part] = general[part] ?? null;
    live.rain ??= this.#rainConfig();
    live.ash ??= this.#ashConfig();
    return live;
  }

  // Spec 180 stage D: every part of both levels that differs from the code, and — when the export would leave some of
  // them out (the selector shows the other level) — where to export them from.
  #readSavingStatus() {
    const id = this.#locationId();
    const baseGeneral = this.#getBaseGeneral?.(), baseWeather = this.#getBaseLocationWeather?.(id);
    const liveWeather = this.#locationWeather(id);
    if (!baseGeneral || !baseWeather || !liveWeather) return "Параметри погоди завантажено.";
    const changed = changedWeatherParts({ baseGeneral, liveGeneral: this.#liveGeneral(),
      baseLocationWeather: baseWeather, liveLocationWeather: liveWeather });
    if (!changed.length) return "Погода збігається з кодом.";
    const labels = changed.map((part) => (part === "locationWeather" ? `${PART_LABELS[part]} ${id}` : PART_LABELS[part]));
    const mode = this.#mode();
    const generalLeft = !mode.general && changed.some((part) => part !== "locationWeather");
    const locationLeft = !mode.location && changed.includes("locationWeather");
    const hint = generalLeft ? " Загальні не ввійдуть в експорт: оберіть «Загальні» або «Всі»."
      : locationLeft ? ` Погода ${id} не ввійде в експорт: оберіть локацію ${id} або «Всі».` : "";
    return `Змінено (ще не в коді): ${labels.join(", ")}.${hint}`;
  }

  async #buildExport(hashText) {
    const mode = this.#mode();
    const id = mode.location;
    const moment = this.#now();
    let general = null, generalBaseHashes = null, liveWeather = null, locationWeatherBaseHash = null;
    if (mode.general) {
      general = this.#liveGeneral();
      if (GENERAL_WEATHER_PART_IDS.some((part) => !general[part])) return { error: "Немає загальних параметрів погоди для експорту." };
      const base = this.#getBaseGeneral?.() ?? general;
      generalBaseHashes = {};
      for (const part of GENERAL_WEATHER_PART_IDS) generalBaseHashes[part] = await generalPartHash(base[part] ?? general[part], hashText);
    }
    if (id) {
      liveWeather = this.#locationWeather(id);
      if (!liveWeather) return { error: `Немає погоди локації ${id} для експорту.` };
      locationWeatherBaseHash = await locationWeatherHash(this.#getBaseLocationWeather?.(id) ?? liveWeather, hashText);
    }
    return {
      fileName: weatherFileName({ general: Boolean(general), locationId: id }, this.#gameVersion, moment),
      data: buildWeatherFile({
        general, generalBaseHashes, locationId: id, locationWeather: liveWeather, locationWeatherBaseHash,
        gameVersion: this.#gameVersion,
        exportedAt: moment.toISOString(),
      }),
    };
  }

  // A v2 file brings its levels; a v1 file the rain and a location. A location must be the one the selector names
  // (or the game's, with «Загальні»).
  #applyImport(file, setStatus) {
    const id = this.#locationId();
    const read = readWeatherFile(file);
    if (read?.locationId && read.locationId !== id) {
      setStatus(`Файл для локації ${read.locationId}; зараз відкрито ${id}.`);
      return;
    }
    const errors = validateWeatherFile(file, {
      generalTemplates: this.#getBaseGeneral?.() ?? this.#liveGeneral(),
      locationWeatherTemplate: this.#getBaseLocationWeather?.(id) ?? this.#locationWeather(id),
    });
    if (errors.length) {
      setStatus(`Файл не прийнято: ${errors.slice(0, 3).join("; ")}`);
      return;
    }
    for (const part of Object.keys(read.general ?? {})) {
      this.#updateConfig?.(["CONFIG", ...GENERAL_WEATHER_PARTS[part].configPath], canonicalGeneralPart(read.general[part]));
    }
    if (read.locationId) {
      this.#updateConfig?.(["CONFIG", "locations", "map", id, "weather"], canonicalLocationWeather(read.locationWeather));
    }
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
    if (event.automatic === false) return `${strength} · сам не почнеться (авто вимкнено)`;
    return event.cooldownLeftSec > 0 ? `${strength} · пауза ще ${seconds(event.cooldownLeftSec)}`
      : `${strength} · шанс перевірки ${(event.chance * 100).toFixed(2)}%`;
  }

  #emissionText(snapshot) {
    if (!snapshot) return "—";
    if (snapshot.intensityHeld) return `${percent(snapshot.intensity)} · вручну`;
    const idle = snapshot.phase === "idle";
    const left = snapshot.frozen ? "заморожено"
      : !idle ? `ще ${seconds(snapshot.phaseLeftSec)}`
        : snapshot.automatic === false ? "сам не почнеться (авто вимкнено)"
        : snapshot.cooldownLeftSec > 0 ? `пауза ще ${seconds(snapshot.cooldownLeftSec)}`
          : `шанс перевірки ${(snapshot.chance * 100).toFixed(2)}%`;
    return `${EMISSION_LABELS[snapshot.phase] ?? snapshot.phase} · ${percent(snapshot.intensity)} · ${left}`;
  }

  #renderStatus(weather, controls) {
    const wind = this.#weather.getWind?.() ?? null;
    const emission = this.#weather.getEmissionModel?.()?.snapshot ?? null;
    this.#ui.createInfoRow("дощ", this.#eventText(weather.events?.rain), controls);
    this.#ui.createInfoRow("шторм", this.#eventText(weather.events?.storm), controls);
    // TK-336: the fog's chance multipliers now — its hour window and the rains since the last fog.
    this.#ui.createInfoRow("туман", `${this.#eventText(weather.events?.fog)} · вікно ×${weather.fogHourMult ?? 1}` +
      ` · після дощу ×${weather.fogRainBoost ?? 1}`, controls);
    this.#ui.createInfoRow("викид", this.#emissionText(emission), controls);
    if (emission) this.#ui.createInfoRow("радіація", `${percent(emission.radiation)}${emission.radiationForced ? " (вручну)" : ""}`, controls);
    // TK-358: the player's statuses (the vodka, the gas mask) are shown and given in DevTools «Гра» → «СТАТУСИ».
    const windText = wind
      ? `${WIND_NAMES[wind.direction] ?? wind.direction}${wind.state && wind.direction !== 0 ? ` · ${WIND_STATE_LABELS[wind.state] ?? wind.state}` : ""}` +
        ` · ${percent(wind.strength)}${wind.isGusting ? " (порив)" : ""}${wind.forced || wind.forcedStrength != null ? " (вручну)" : ""}`
      : "—";
    this.#ui.createInfoRow("вітер", windText, controls);
    this.#ui.createInfoRow("блискавки", `${weather.lightningActive ? "ідуть" : "немає"} · ударів ${weather.strikeSerial}, ` +
      `остання: варіант ${weather.strikeVariant + 1}, відстань ${percent(weather.strikeDistance)}`, controls);
    if (this.#weather.sessionSeed !== undefined) this.#ui.createInfoRow("сід сесії", String(this.#weather.sessionSeed), controls);
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

  // TK-367 (owner): «Оновити» on top and «Автоматична погода» (TK-398: a switch) under it, then the state; then every element as a
  // switch that follows its live state (R26) with its strength, «авто» and settings only while it is on; the actions
  // at the bottom, «Болід зараз» last.
  #renderControls(model, content) {
    const weather = model.snapshot;
    const controls = this.#createSection("Керування", content, ["WEATHER", "controls"]);
    this.#shownLive = this.#liveState();
    // TK-367.1 (owner): the buttons two to a line with short labels.
    const top = this.#ui.createButtonGrid(controls);
    this.#ui.createButtonRow("Оновити", top, () => this.#fill(), false, "", ["WEATHER", "controls", "refresh"],
      { icon: "refresh" });
    // TK-398 (owner): one switch for the whole automatic weather (it replaced the button «Авто погода»). Either way every
    // hold is released: on — everything back to its own course; off — everything goes out (what runs by itself ends, the
    // holds are dropped) and nothing starts by itself; each element's own switch still turns it on.
    if (this.#weather.setAutomatic) {
      this.#ui.createSwitcherRow("Автоматична погода", this.#weather.isAutomatic?.() !== false, controls, (on) => {
        this.#weather.setAutomatic(on === true);
        this.#automaticWeather(model);
        this.#fill();
      }, ["WEATHER", "controls", "auto"]);
    }
    this.#renderGenerated(weather, this.#weather.getEmissionModel?.()?.snapshot ?? null, controls);
    this.#renderStatus(weather, controls);
    for (const [kind, label] of EVENTS) this.#renderEventControl(model, kind, label, weather.events?.[kind], controls);
    const emission = this.#weather.getEmissionModel?.() ?? null;
    this.#renderEmissionControl(emission, controls);
    this.#renderStarfallControls(controls);
    this.#renderAshControl(controls);
    this.#renderWindControls(controls);
    this.#renderWavesControl(controls);
    this.#renderCurrentControl(controls);
    this.#ui.createInputRow("перехід, с", this.#fadeSec, controls, "number", (value) => {
      this.#fadeSec = Math.max(0, Number(value) || 0);
    }, ["WEATHER", "controls", "fadeSec"]);
    const actions = this.#ui.createButtonGrid(controls);
    this.#renderActions(model, emission, actions);
    this.#renderBolide(actions);
  }

  // D10: every hold released — each element returns to its own course (TK-398: without automatic weather, off).
  #automaticWeather(model) {
    model.releaseAll();
    this.#weather.setWind?.(null);
    this.#weather.setWindStrength?.(null);
    this.#weather.getEmissionModel?.()?.holdIntensity(null);
    this.#weather.holdAsh?.(null);
    this.#weather.holdWaves?.(null);
    this.#weather.holdCurrent?.(null);
  }

  // TK-367: a slider's label says when the element is held by hand.
  #heldLabel(label, held) {
    return held ? `${label} · вручну` : label;
  }

  // TK-367: «авто» returns this one element to its own course (the others keep theirs), shown only while it is held.
  #renderAutoButton(key, held, controls, release) {
    if (!held) return;
    this.#ui.createButtonRow("авто", controls, () => {
      release();
      this.#fill();
    }, false, "", ["WEATHER", "controls", `${key}Auto`], { icon: "reset" });
  }

  // TK-367 (owner: «всі інші також повинні мати такі розділи для налаштування»): an element's settings, collapsed under
  // its controls — the same live config the element's section edits.
  #renderSettings(label, key, value, parts, controls) {
    if (!value || typeof value !== "object") return;
    this.#tree(value, this.#group(label, controls, ["WEATHER", "controls", `${key}Settings`]), parts);
  }

  // A live share 0…1 as the slider's percent; remembered as the level a switch turns on with when above zero.
  #liveLevel(key, share, scale = 100) {
    const value = Math.round(Math.max(0, Number(share) || 0) * scale * 10) / 10;
    if (value > 0) this.#levels[key] = value;
    return value;
  }

  #renderEventControl(model, kind, label, event, controls) {
    const shown = this.#eventOn(event);
    // TK-327.1: on starts a random event (as the game would), off ends it and releases its slider's hold. TK-398: when
    // something else still holds it up (an emission's floor — it used to stay with its switch off), off holds it at 0;
    // «авто» (below) returns it to its course.
    this.#ui.createSwitcherRow(label, shown, controls, (on) => {
      model.hold(kind, null, { fadeSec: this.#fadeSec });
      if (on) model.start(kind);
      else {
        model.stop(kind);
        if (Number(model.snapshot?.events?.[kind]?.target) > LIVE_EPSILON) model.hold(kind, 0, { fadeSec: this.#fadeSec });
      }
      this.#fill();
    }, ["WEATHER", "controls", kind]);
    // TK-360 (owner): the strength appears once the element is on; TK-367: it stands at the live strength.
    if (shown) {
      const level = Math.round(this.#liveLevel(kind, event?.strength));
      this.#ui.createRangeRow(this.#heldLabel(`${label}: сила, %`, event?.held === true), level, controls, (value) => {
        this.#levels[kind] = clamp(value, 0, 100);
        model.hold(kind, this.#levels[kind] / 100, { fadeSec: this.#fadeSec });
      }, ["WEATHER", "controls", `${kind}Strength`]);
      this.#followLive(["WEATHER", "controls", `${kind}Strength`], () => {
        const live = model.snapshot?.events?.[kind];
        return Math.round(Number(live?.held ? live.target : live?.strength) * 100) || 0;
      });
    }
    this.#renderAutoButton(kind, event?.held === true, controls, () => model.hold(kind, null, { fadeSec: this.#fadeSec }));
    if (!shown) return;
    const id = this.#weather.locationId;
    if (kind === "rain") this.#renderAt100Sliders("rain", this.#group("Дощ при силі 100", controls, ["WEATHER", "controls", "rainAt100"]));
    else if (kind === "storm") {
      this.#renderSettings("Шторм: що робить (загальне)", "storm", this.#general()?.storm, ["weather", "storm"], controls);
    } else {
      this.#renderSettings("Туман: подія (локація)", "fog", this.#locationWeather(id)?.fog, this.#locationParts(id, "fog"), controls);
    }
  }

  #renderEmissionControl(emission, controls) {
    if (!emission) return;
    const snapshot = emission.snapshot;
    const shown = snapshot.phase !== "idle";
    this.#ui.createSwitcherRow("Викид", shown, controls, (on) => {
      if (on) emission.force("onset");
      else {
        emission.holdIntensity(null);
        emission.force("idle");
      }
      this.#fill();
    }, ["WEATHER", "controls", "emission"]);
    if (!shown) return;
    const level = Math.round(this.#liveLevel("emission", snapshot.intensity));
    this.#ui.createRangeRow(this.#heldLabel("Викид: сила, %", snapshot.intensityHeld === true), level, controls, (value) => {
      this.#levels.emission = clamp(value, 0, 100);
      emission.holdIntensity(this.#levels.emission / 100);
    }, ["WEATHER", "controls", "emissionStrength"]);
    this.#followLive(["WEATHER", "controls", "emissionStrength"], () => Math.round(Number(emission.snapshot.intensity) * 100) || 0);
    this.#renderAutoButton("emission", snapshot.intensityHeld === true, controls, () => emission.holdIntensity(null));
    this.#renderSettings("Викид: затемнення й розмиття (загальне)", "emission", this.#general()?.screen, ["emission", "screen"],
      controls);
  }

  // TK-354.1 (owner): «Зорепад» for a test — on: the game clock jumps to the night (unless it is already inside the
  // starfall's window) and the starfall is held at the slider's strength; off: the night's own plan again. Under it,
  // while on, the strength (TK-360) and the stars' look (TK-367).
  #renderStarfallControls(controls) {
    const starfall = this.#weather.getStarfallModel?.() ?? null;
    if (!starfall) return;
    const snapshot = starfall.snapshot;
    if (snapshot.held) this.#starfallLevel = Math.round(snapshot.strength * 100);
    this.#ui.createSwitcherRow("Зорепад (ніч)", snapshot.held === true, controls, (on) => {
      if (on) {
        if (!snapshot.inWindow) this.#weather.setGameHour?.(STARFALL_TEST_HOUR);
        starfall.hold(this.#starfallLevel / 100);
      } else starfall.hold(null);
      this.#fill();
    }, ["WEATHER", "controls", "starfall"]);
    if (!snapshot.held) return;
    this.#ui.createRangeRow("Зорепад: сила, %", this.#starfallLevel, controls, (value) => {
      this.#starfallLevel = clamp(value, 0, 100);
      starfall.hold(this.#starfallLevel / 100);
    }, ["WEATHER", "controls", "starfallStrength"]);
    this.#renderSettings("Зорепад: зорі й болід (загальне)", "starfall", this.#general()?.starfall, ["canvas", "starfall"], controls);
  }

  // TK-367 (owner: «попіл … з'являється з викидом але керувати я повинен ним і окремо»): on — the ash held at the
  // slider; off — held at 0 even during an emission; «авто» — it follows the emission again.
  #renderAshControl(controls) {
    const weather = this.#weather;
    if (!weather.holdAsh) return;
    const hold = weather.getAshHold?.() ?? null;
    const shown = (weather.getAshStrength?.() ?? hold ?? 0) > LIVE_EPSILON;
    this.#ui.createSwitcherRow("Попіл", shown, controls, (on) => {
      weather.holdAsh(on ? this.#levels.ash / 100 : 0);
      this.#fill();
    }, ["WEATHER", "controls", "ash"]);
    if (shown) {
      const level = Math.round(this.#liveLevel("ash", weather.getAshStrength?.() ?? hold));
      this.#ui.createRangeRow(this.#heldLabel("Попіл: сила, %", hold !== null), level, controls, (value) => {
        this.#levels.ash = clamp(value, 0, 100);
        weather.holdAsh(this.#levels.ash / 100);
      }, ["WEATHER", "controls", "ashStrength"]);
      this.#followLive(["WEATHER", "controls", "ashStrength"],
        () => Math.round(Number(weather.getAshHold?.() ?? weather.getAshStrength?.() ?? 0) * 100) || 0);
    }
    this.#renderAutoButton("ash", hold !== null, controls, () => weather.holdAsh(null));
    if (shown) this.#renderAt100Sliders("ash", this.#group("Попіл при силі 100", controls, ["WEATHER", "controls", "ashAt100"]));
  }

  // TK-367 (owner): on — the wind blows at the slider's strength (the direction «← вліво | авто | вправо →»); off — calm.
  #renderWindControls(controls) {
    const weather = this.#weather;
    if (!weather.setWind) return;
    const wind = weather.getWind?.() ?? null;
    const shown = this.#windOn(wind);
    const forcedDirection = wind?.forcedDirection ?? null;
    const held = wind?.forcedStrength != null || forcedDirection === -1 || forcedDirection === 1;
    this.#ui.createSwitcherRow("Вітер", shown, controls, (on) => {
      if (on) {
        weather.setWind(forcedDirection === -1 || forcedDirection === 1 ? forcedDirection : null);
        weather.setWindStrength?.(this.#levels.wind / 100);
      } else weather.setWind(0);
      this.#fill();
    }, ["WEATHER", "controls", "wind"]);
    if (shown) {
      const choice = WIND_CHOICES.find((option) => option.direction === forcedDirection) ?? WIND_CHOICES[1];
      this.#ui.addParameter(controls, { control: "segments", label: "Вітер: напрям",
        options: WIND_CHOICES.map((option) => ({ value: option.value, label: option.label })), value: choice.value,
        onCommit: (next) => {
          weather.setWind(WIND_CHOICES.find((option) => option.value === next)?.direction ?? null);
          this.#fill();
        }, path: ["WEATHER", "controls", "windDirection"] });
      if (weather.setWindStrength) {
        const level = Math.round(this.#liveLevel("wind", wind?.forcedStrength ?? wind?.strength));
        this.#ui.createRangeRow(this.#heldLabel("Вітер: сила, %", wind?.forcedStrength != null), level, controls, (value) => {
          this.#levels.wind = clamp(value, 0, 100);
          weather.setWindStrength(this.#levels.wind / 100);
        }, ["WEATHER", "controls", "windStrength"]);
        // TK-401 (owner): the wind's own strength with its gusts; a strength held by hand stays where it was put.
        this.#followLive(["WEATHER", "controls", "windStrength"], () => {
          const live = weather.getWind?.() ?? null;
          return Math.round(Number(live?.forcedStrength ?? live?.strength) * 100) || 0;
        });
      }
    }
    this.#renderAutoButton("wind", held || forcedDirection === 0, controls, () => {
      weather.setWind(null);
      weather.setWindStrength?.(null);
    });
    if (shown) this.#renderSettings("Вітер: як діє (загальне)", "wind", this.#general()?.wind, ["weather", "wind"], controls);
  }

  #windOn(wind) {
    return !!wind && wind.direction !== 0 && Number(wind.strength) > LIVE_EPSILON;
  }

  // TK-367: on — the waves' height held at the slider (% of the usual); off — flat water; «авто» — from wind and storm.
  #renderWavesControl(controls) {
    const weather = this.#weather;
    if (!weather.holdWaves) return;
    const hold = weather.getWavesHold?.() ?? null;
    const shown = this.#wavesOn();
    this.#ui.createSwitcherRow("Хвилі", shown, controls, (on) => {
      weather.holdWaves(on ? this.#levels.waves / 100 : 0);
      this.#fill();
    }, ["WEATHER", "controls", "wavesOn"]);
    if (shown) {
      const level = Math.round(this.#liveLevel("waves", hold ?? weather.getWavesScale?.() ?? 1) / 5) * 5;
      this.#ui.addParameter(controls, { control: "range", label: this.#heldLabel("Хвилі: висота, % від звичайної", hold !== null),
        value: clamp(level, 0, 300), min: 0, max: 300, step: 5, onCommit: (value) => {
          this.#levels.waves = clamp(value, 0, 300);
          weather.holdWaves(this.#levels.waves / 100);
        }, path: ["WEATHER", "controls", "waves"] });
      this.#followLive(["WEATHER", "controls", "waves"], () =>
        clamp(Math.round(Number(weather.getWavesHold?.() ?? weather.getWavesScale?.() ?? 1) * 100 / 5) * 5, 0, 300));
    }
    this.#renderAutoButton("waves", hold !== null, controls, () => weather.holdWaves(null));
    if (shown) this.#renderSettings("Хвилі: стан моря (загальне)", "waves", this.#general()?.water?.seaState,
      ["canvas", "water", "seaState"], controls);
  }

  // TK-367: on — the water current held at the slider's speed; off — still water; «авто» — the location's own current.
  // A hold of the running game, not a config edit (the location's current is edited in «ВОДА» → «Течія»).
  #renderCurrentControl(controls) {
    const weather = this.#weather;
    if (!weather.holdCurrent) return;
    const speed = weather.getCurrentSpeed?.();
    if (speed === null || speed === undefined) return;
    const hold = weather.getCurrentHold?.() ?? null;
    const shown = Number(speed) > LIVE_EPSILON;
    this.#ui.createSwitcherRow("Течія", shown, controls, (on) => {
      weather.holdCurrent(on ? this.#levels.current : 0);
      this.#fill();
    }, ["WEATHER", "controls", "currentOn"]);
    if (shown) {
      const level = this.#liveLevel("current", speed, 1);
      this.#ui.addParameter(controls, { control: "range", label: this.#heldLabel("Течія: швидкість, px/с", hold !== null),
        value: clamp(level, 0, 60), min: 0, max: 60, step: 0.5, onCommit: (value) => {
          this.#levels.current = clamp(value, 0, 60);
          weather.holdCurrent(this.#levels.current);
        }, path: ["WEATHER", "controls", "current"] });
      this.#followLive(["WEATHER", "controls", "current"], () =>
        clamp(Math.round(Number(weather.getCurrentHold?.() ?? weather.getCurrentSpeed?.() ?? 0) * 2) / 2, 0, 60));
    }
    this.#renderAutoButton("current", hold !== null, controls, () => weather.holdCurrent(null));
    const id = this.#weather.locationId;
    if (shown) this.#renderSettings("Течія (локація)", "current", this.#locationsMap?.()?.[id]?.environment?.current,
      ["locations", "map", id, "environment", "current"], controls);
  }

  // TK-360 (owner): «Болід зараз» is the last row; on a phone the panel closes at once, so the bolide is seen falling.
  #renderBolide(controls) {
    const starfall = this.#weather.getStarfallModel?.() ?? null;
    if (!starfall) return;
    this.#ui.createButtonRow("Болід", controls, () => {
      starfall.bolideNow();
      this.#closeOnPhone();
    }, false, "", ["WEATHER", "controls", "bolide"]);
  }

  // TK-367 (owner: «Всі інші кнопки в самому низу»): the actions after every control.
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
      this.#ui.createButtonRow("Порив вітру", controls, () => {
        this.#weather.triggerWindGust();
        this.#fill();
      }, false, "", ["WEATHER", "controls", "gust"]);
    }
    this.#ui.createButtonRow("Блискавка", controls, () => {
      model.strike();
      this.#fill();
    }, false, "", ["WEATHER", "controls", "strike"]);
  }
}
