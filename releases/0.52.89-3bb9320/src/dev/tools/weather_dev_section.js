import { DevSavingSection } from "./export/dev_saving_section.js";
import {
  GENERAL_WEATHER_PART_IDS,
  GENERAL_WEATHER_PARTS,
  LOCATION_WEATHER_PART_IDS,
  LOCATION_WEATHER_PARTS,
  WEATHER_FILE_VERSION,
  applyLeafChanges,
  buildWeatherFile,
  canonicalGeneralPart,
  canonicalLocationWeather,
  changedWeatherParts,
  readWeatherFile,
  validateWeatherFile,
  weatherFileName,
  weatherPartSpec,
} from "../weather/weather_export_format.js";
import { VISIBLE_STRENGTH, lookOverrideEnds, strengthValue } from "../../game/presentation/weather/weather_look_resolver.js";

// DevTools «ПОГОДА» (spec 172, 175, 179; spec 180 stage C, TK-327).
// - On top: the selector «Загальні» | «Всі» | a location (spec 180 D4, D11; TK-333): «Загальні» — the general settings,
//   a location — only what belongs to it, «Всі» — both together in every section (the location picked last).
// - «Керування» (TK-360; was «Стан і керування») of the location the game runs (D10). TK-367 (owner): «Оновити» on top,
//   «Автоматична погода» under it, the live state of every process; then every element (rain, storm, fog, emission,
//   starfall, ash, wind, waves, current) as a switch that follows its live state, the wind's direction while it
//   blows, «перехід, с»; the actions («Порив вітру | Блискавка», «Болід» last — on a phone it closes the panel, so
//   the bolide is seen) two to a line (TK-367.1, DevToolsUI.createButtonGrid).
//   Spec 187 (owner) — replaces TK-398's «off: everything goes out»:
//   - A: no sliders and no settings here; each element's «Сила, %» is on top of its own section (ВОДА: the waves'
//     height and the current's speed), for the location the game runs, holding the running game.
//   - D11: «Автоматична погода» on — nothing is set by hand: the switches, the direction and the sliders show the live
//     state but require the automatic weather off (DevToolsUI `requires`), the actions are not there; turning it on
//     releases every hold. D12–D14: off — the weather freezes where it is (each model holds its own level); a switch
//     on holds its element at its last level, off at 0 (no random event, no timeline, no «авто»); the chances within
//     a level (gusts, strikes, falling stars) still act.
// - TK-360: the switches follow the live state. While the panel is open, refreshLive() (each live update) compares
//   which elements are on — one integer — with what the section shows, and redraws it only when that changed: a fog
//   that started by itself shows at once, not at the next redraw caused by another control.
// - TK-400 (owner): the section's own «i» — the automatic weather, the states on now and a short line for each (strength,
//   phase, time left), the radiation; its texts follow the live updates while it is open.
// - Sections by element: ДОЩ, ШТОРМ, ВІТЕР, ТУМАН, ВИКИД, РАДІАЦІЯ (TK-337), ПОПІЛ, ВОДА, ПОЧАТОК І ПОРОГИ — general and location parts by
//   the selector; a section with edits not in the code is marked «· змінено» and has «Скинути розділ до коду» (D8).
//   Spec 187 D16 (TK-403): a parameter of one element that acts on another is edited in the section of the element whose
//   strength drives it (the rain's effect on the wind — ДОЩ); the other section shows a link with its value now.
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
// Spec 187 D11: the switch «Автоматична погода» — every manual control requires it off.
const AUTO_PATH = Object.freeze(["WEATHER", "controls", "auto"]);
// TK-367 (owner): the wind's direction as buttons «← вліво | авто | вправо →»; calm is the wind's switch off.
const WIND_CHOICES = Object.freeze([
  Object.freeze({ value: "left", label: "← вліво", direction: -1 }),
  Object.freeze({ value: "auto", label: "авто", direction: null }),
  Object.freeze({ value: "right", label: "вправо →", direction: 1 }),
]);
const WIND_NAMES = Object.freeze({ "-1": "вліво", 0: "немає", 1: "вправо" });
const WIND_STATE_LABELS = Object.freeze({ calm: "штиль", light: "слабкий", moderate: "середній", strong: "сильний" });
// D16, spec 187 B: the names of the values that change with an element's strength (the look's [від, до] pairs).
const STRENGTH_LABELS = Object.freeze({ maxDrops: "густота", lengthPx: "довжина краплі", widthPx: "ширина краплі",
  speedPx: "швидкість падіння", minScale: "глибина (далекі)", lengthJitter: "розкид довжини", slantJitterDeg: "розкид нахилу",
  maxParticles: "іскор на екрані", opacity: "непрозорість", riseSpeedPx: "підйом", wanderPx: "хаотичність" });
// D2: each event's chance per check, in its own section.
const CHANCES = Object.freeze({
  rain: Object.freeze(["Дощ: шанс перевірки", "rainChance", ["rain", "chancePerCheck"]]),
  storm: Object.freeze(["Шторм: шанс перевірки", "stormChance", ["storm", "chancePerCheck"]]),
  fog: Object.freeze(["Туман: шанс перевірки", "fogChance", ["fog", "chancePerCheck"]]),
});
// Spec 187 D16 (TK-403): a parameter of one element that acts on another is edited in the section of the element whose
// strength drives it; the other section shows a link (its key and «i» as the parameter's own row — TK-403.2 — its value
// now and a button to it): [CONFIG path, section].
const WIND_LINKS = Object.freeze([
  Object.freeze([Object.freeze(["weather", "wind", "rain", "minStrength"]), "ДОЩ"]),
  Object.freeze([Object.freeze(["weather", "wind", "rain", "bonus"]), "ДОЩ"]),
  Object.freeze([Object.freeze(["weather", "wind", "rain", "gustChanceMult"]), "ДОЩ"]),
  Object.freeze([Object.freeze(["weather", "storm", "windMinStrength"]), "ШТОРМ"]),
  Object.freeze([Object.freeze(["weather", "storm", "gustChanceMult"]), "ШТОРМ"]),
]);
const RAIN_LINKS = Object.freeze([
  Object.freeze([Object.freeze(["weather", "storm", "rainChanceMult"]), "ШТОРМ"]),
  Object.freeze([Object.freeze(["weather", "storm", "rainStrengthMult"]), "ШТОРМ"]),
  Object.freeze([Object.freeze(["weather", "storm", "rainDropsShare"]), "ШТОРМ"]),
  Object.freeze([Object.freeze(["weather", "storm", "rainSlantDeg"]), "ШТОРМ"]),
  Object.freeze([Object.freeze(["weather", "wind", "rainSlantDeg"]), "ВІТЕР"]),
]);
const ASH_LINKS = Object.freeze([
  Object.freeze([Object.freeze(["weather", "wind", "ashDriftPx"]), "ВІТЕР"]),
]);
// Spec 187 D16 (TK-405): the general effect pairs [від, до] and the element whose strength drives each (CONFIG path →
// kind); with that element's slider shown, the pair is one field at the slider's level (#renderEffects).
const EFFECT_DRIVERS = Object.freeze({
  "weather.storm.gustChanceMult": "storm", "weather.storm.rainChanceMult": "storm", "weather.storm.rainDropsShare": "storm",
  "weather.storm.rainSlantDeg": "storm", "weather.storm.rainStrengthMult": "storm", "weather.storm.windMinStrength": "storm",
  "weather.wind.rainSlantDeg": "wind", "weather.wind.ashDriftPx": "wind",
  "weather.wind.rain.minStrength": "rain", "weather.wind.rain.bonus": "rain", "weather.wind.rain.gustChanceMult": "rain",
  "canvas.water.seaState.normal.windAmplitude": "wind", "canvas.water.seaState.normal.windSpeed": "wind",
  "canvas.water.seaState.storm.amplitude": "storm", "canvas.water.seaState.storm.speed": "storm",
  "canvas.water.seaState.storm.wavelength": "storm",
});
// A pair [від, до] as «від / до»; a number as it is.
const linkText = (value) => (Array.isArray(value) ? value.join(" / ") : value == null ? "—" : String(value));
// The «Збереження» status names the parts by these (spec 189: every part of the export).
const PART_LABELS = Object.freeze({ "general.rain": "Дощ", "general.ash": "Попіл", "general.storm": "Шторм",
  "general.wind": "Вітер", "general.lightning": "Блискавка", "general.starfall": "Зорепад", "general.water": "Вода",
  "general.emissionScreen": "Екран викиду", "general.radiationGrain": "Шипіння радіації", "general.geiger": "Лічильник Гейгера",
  "location.weather": "Параметри локації", "location.current": "Течія локації" });
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
  #readConfig;
  #readBaseConfig;
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
  // Spec 187 B: per element, the strength slider's level now (0…1) — the look values in its section stand at it.
  #levelReaders = new Map();
  // Spec 187 D16 (TK-403): the link rows' values: { value (element), read: () => the parameter now }.
  #links = [];
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
    this.#refreshLinks();
    if (!this.#savingSection.hasStatusElement) return;
    const rest = path.slice(1);
    const isGeneral = GENERAL_WEATHER_PART_IDS.some((part) => samePath(rest, GENERAL_WEATHER_PARTS[part].configPath));
    const id = this.#locationId();
    const isLocation = LOCATION_WEATHER_PART_IDS.some((part) => samePath(rest, LOCATION_WEATHER_PARTS[part].configPath(id)));
    if (isGeneral || isLocation) this.#savingSection.refreshStatus();
  };

  // weather: the DEV port { getModel(), isAutomatic(), setAutomatic(on), getWindModel(), getEmissionModel(), getWind(), setWind(dir | null),
  //   setWindStrength(0…1 | null), triggerWindGust(), holdAsh(0…1 | null), holdWaves(scale | null), requestImage(id),
  //   sessionSeed, locationId }; config: () => the active location's weather; locationConfig(id) / locationsMap();
  //   general: () => { rain, ash, water, storm, wind, screen } (the general settings); edits: { hasOverrides(parts),
  //   resetTree(parts) } (the «змінено» mark and the section reset); spec 189: readConfig(path) / readBaseConfig(path) —
  //   a CONFIG value as it runs now / as in the code (path without "CONFIG"; every part of the export reads through
  //   them); resetWeather({ general, locationId }) drops the session's edits of the general parts (general: true) and /
  //   or of that location's parts (spec 180 stage D).
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
    readConfig = null,
    readBaseConfig = null,
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
    this.#readConfig = readConfig;
    this.#readBaseConfig = readBaseConfig;
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
          "Експорт погоди завантажує файл того, що показує вибір нагорі: «Загальні» — усе загальне (дощ, попіл, шторм, вітер, блискавка, зорепад, вода, екран викиду, шипіння радіації, лічильник Гейгера); локація — її погода й течія; «Всі» — обидва. Файл несе лише змінені параметри (було → стало), тому його можна застосувати й після змін коду. У код зміни переносить команда npm run apply:weather -- <файл> (перевірка, конфлікт лише параметрів, змінених у коді після експорту, підтвердження, бекап); після неї перезавантажте сторінку або скиньте зміни погоди до коду. Імпорт погоди відкриває такий файл тут, щоб продовжити редагування; скидання скидає те саме, що йде в експорт. «Автоматична погода» й утримання в «Керування» в експорт не входять. Без експорту зміни зникають при перезавантаженні.",
      },
      readStatus: () => this.#readSavingStatus(),
      buildExport: () => this.#buildExport(),
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
    this.#links.length = 0;
    this.#summary.length = 0;
    this.#liveSliders.length = 0;
    this.#levelReaders.clear();
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
      this.#links.length = 0;
      this.#summary.length = 0;
      this.#liveSliders.length = 0;
      this.#levelReaders.clear();
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
    // Spec 187 D16 (TK-403): the rain's effect on the wind (weather.wind.rain) belongs to the rain — its strength drives it.
    if (mode.general) parts.push(["canvas", "rain"], ["weather", "wind", "rain"]);
    if (mode.location) parts.push(this.#locationParts(mode.location, "rain"), this.#locationParts(mode.location, "look", "rain"));
    this.#elementSection("ДОЩ", "rain", content, parts, (section) => {
      this.#renderStrength("rain", section, mode);
      if (mode.general) {
        this.#tree(general, this.#group("Вигляд (загальний)", section, ["WEATHER", "rain", "look"]), ["canvas", "rain"]);
        this.#renderEffects(this.#general()?.wind?.rain, ["weather", "wind", "rain"],
          this.#group("Що робить дощ з вітром (загальне)", section, ["WEATHER", "rain", "wind"]));
        this.#renderLinks(RAIN_LINKS, this.#group("Що робить з дощем шторм і вітер (загальне)", section,
          ["WEATHER", "rain", "byOthers"]), ["WEATHER", "rain", "byOthers"]);
      }
      if (!mode.location) return;
      const weather = this.#locationWeather(mode.location);
      this.#chanceRow("rain", mode.location, section);
      this.#tree(weather?.rain, this.#group("Подія дощу (локація)", section, ["WEATHER", "rain", "event"]),
        this.#locationParts(mode.location, "rain"));
      this.#renderLookValues("rain", mode.location, this.#group("Від сили: від (5 %) і до (100 %) (локація)", section, ["WEATHER", "rain", "lookValues"]));
    });
  }

  #renderStorm(content, mode) {
    const parts = [];
    if (mode.general) parts.push(["weather", "storm"], ["canvas", "lightning"]);
    if (mode.location) parts.push(this.#locationParts(mode.location, "storm"));
    this.#elementSection("ШТОРМ", "storm", content, parts, (section) => {
      this.#renderStrength("storm", section, mode);
      if (mode.general) {
        this.#renderEffects(this.#general()?.storm, ["weather", "storm"],
          this.#group("Що робить шторм (загальне)", section, ["WEATHER", "storm", "effects"]));
        // Spec 188 D9: the procedural lightning's look, edited live (its strikes: the location's «Подія шторму й блискавки»).
        this.#tree(this.#general()?.lightning, this.#group("Блискавка — вигляд (загальне)", section,
          ["WEATHER", "storm", "lightning"]), ["canvas", "lightning"]);
      }
      if (!mode.location) return;
      this.#chanceRow("storm", mode.location, section);
      this.#tree(this.#locationWeather(mode.location)?.storm, this.#group("Подія шторму й блискавки (локація)", section,
        ["WEATHER", "storm", "event"]), this.#locationParts(mode.location, "storm"));
    });
  }

  #renderWind(content, mode) {
    // Spec 187 D16 (TK-403): the rain's effect on the wind (weather.wind.rain) is edited in ДОЩ — the wind's mark and
    // reset cover the wind's own keys only.
    const { rain: _rainEffects, ...windOwn } = this.#general()?.wind ?? {};
    const parts = [];
    if (mode.general) parts.push(...Object.keys(windOwn).map((key) => ["weather", "wind", key]));
    if (mode.location) parts.push(this.#locationParts(mode.location, "wind"));
    this.#elementSection("ВІТЕР", "wind", content, parts, (section) => {
      this.#renderStrength("wind", section, mode);
      if (mode.general) {
        this.#renderEffects(windOwn, ["weather", "wind"],
          this.#group("Як діє вітер і порив (загальне)", section, ["WEATHER", "wind", "effects"]));
        const events = this.#group("Вплив подій на вітер (загальне)", section, ["WEATHER", "wind", "events"]);
        this.#renderLinks(WIND_LINKS, events, ["WEATHER", "wind", "events"]);
        // The emission acts through its storm, set by the location (ВИКИД → «Подія викиду» → storm).
        if (mode.location) {
          this.#renderLinks([[this.#locationParts(mode.location, "emission", "storm", "storm"), "ВИКИД"]],
            events, ["WEATHER", "wind", "events"]);
        } else {
          this.#ui.createInfoRow("Викид", "діє на вітер через шторм локації (ВИКИД → «Подія викиду» → storm)", events);
        }
      }
      if (!mode.location) return;
      this.#tree(this.#locationWeather(mode.location)?.wind, this.#group("Стани вітру й частота поривів (локація)", section,
        ["WEATHER", "wind", "states"]), this.#locationParts(mode.location, "wind"));
    });
  }

  // Spec 187 D16 (TK-403): parameters of another element that act on this one — a row each with the value now (read
  // only, follows config-updated: #refreshLinks) and a button that reveals the parameter in the section it is edited in.
  // links: [CONFIG path parts, the section's title]; the row's path: [...path, the parameter's key, its owner].
  #renderLinks(links, parent, path) {
    for (const [parts, place] of links) {
      const read = () => this.#readConfig?.(parts);
      const value = this.#ui.createLinkRow(linkText(read()), parent,
        { path: [...path, parts.at(-1), parts.at(-2)], target: ["CONFIG", ...parts], place });
      this.#links.push({ value, read });
    }
  }

  #refreshLinks() {
    for (const link of this.#links) {
      const text = linkText(link.read());
      if (link.value.innerText !== text) link.value.innerText = text;
    }
  }

  // Spec 187 D16 (TK-405; stage B for the effects): a general part (node at CONFIG.<parts>) whose effect pairs have their
  // element's strength slider shown (the running location): each such pair is one field (#effectField); a nested object
  // holding one is drawn here as its own group; everything else — and every pair without a slider («Загальні», another
  // location) — stays the config tree, as before.
  #renderEffects(node, parts, parent) {
    if (!node || typeof node !== "object") return;
    const handled = new Set();
    for (const key of Object.keys(node)) {
      const child = node[key];
      const at = [...parts, key];
      const driver = EFFECT_DRIVERS[at.join(".")];
      if (Array.isArray(child) && child.length === 2 && driver && this.#levelReaders.has(driver)) {
        this.#effectField(parent, at, driver);
        handled.add(key);
      } else if (child && typeof child === "object" && !Array.isArray(child) && this.#holdsEffectField(at)) {
        this.#renderEffects(child, at, this.#createSection(key, parent, ["CONFIG", ...at], { inline: true }));
        handled.add(key);
      }
    }
    if (handled.size === Object.keys(node).length) return;
    // The tree's entry paths are ["CONFIG", ...parts, key]: hide the keys drawn above.
    const visibilityPolicy = handled.size
      ? { isVisible: (path) => path.length !== parts.length + 2 || !handled.has(path.at(-1)) } : undefined;
    this.#renderConfigTree(node, parent, ["CONFIG", ...parts], { inlineSections: true, visibilityPolicy });
  }

  #holdsEffectField(parts) {
    const prefix = `${parts.join(".")}.`;
    return Object.keys(EFFECT_DRIVERS).some((path) => path.startsWith(prefix) && this.#levelReaders.has(EFFECT_DRIVERS[path]));
  }

  // One effect pair at its element's slider level (spec 187 B's rule, D15): the field shows the value there and follows
  // the slider live; at 5 % or less it edits «від», at 100 % «до», between it only shows (its prerequisite points at the
  // slider); moved by the slider since drawn, or changed from the code — marked, its reset returns the code's pair. Its
  // row has the parameter's own path (links and the overlay reveal it; the key and «i» as in the tree); the value is
  // bound to a path of its own, so an edit of the pair never writes a pair into the number field.
  #effectField(parent, parts, driver) {
    const cfgPath = ["CONFIG", ...parts];
    const bindingPath = ["WEATHER", "effects", ...parts];
    const level = this.#levelReaders.get(driver);
    const ends = () => {
      // TK-405.1: by path through readConfig (no record built per live refresh).
      const pair = this.#readConfig?.(parts);
      return [Number(pair?.[0]), Number(pair?.[1])];
    };
    const valueNow = () => {
      const [from, to] = ends();
      return Math.round(strengthValue(from, to, level()) * 1e4) / 1e4;
    };
    const editableEnd = () => {
      const now = level();
      return now <= VISIBLE_STRENGTH + 1e-6 ? 0 : now >= 1 - 1e-6 ? 1 : null;
    };
    const drawn = valueNow();
    const overridden = () => this.#edits?.isOverridden?.(cfgPath) === true;
    this.#ui.addParameter(parent, { control: "number", label: parts.at(-1), value: drawn, path: cfgPath, bindingPath,
      configPath: cfgPath, onCommit: (next) => {
        const end = editableEnd();
        if (end === null || !Number.isFinite(Number(next))) return;
        const pair = ends();
        pair[end] = Number(next);
        this.#updateConfig?.(cfgPath, pair);
        this.#ui.showLiveValue(bindingPath, valueNow());
      },
      requires: [{ path: ["WEATHER", driver, "strength"], isEnabled: () => editableEnd() !== null }],
      isChanged: () => valueNow() !== drawn || overridden(),
      onReset: () => {
        this.#edits?.resetParameter?.(cfgPath);
        this.#ui.showLiveValue(bindingPath, valueNow());
      } });
    this.#liveSliders.push({ path: bindingPath, read: valueNow, shown: drawn });
  }

  #renderFog(content, mode) {
    this.#elementSection("ТУМАН", "fog", content, [this.#locationParts(mode.location, "fog")], (section) => {
      this.#renderStrength("fog", section, mode);
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
      this.#renderStrength("emission", section, mode);
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
      this.#renderStrength("starfall", section, mode);
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
      this.#renderStrength("ash", section, mode);
      if (mode.general) {
        this.#tree(this.#general()?.ash ?? this.#ashConfig(), this.#group("Вигляд (загальний)", section,
          ["WEATHER", "ash", "look"]), ["canvas", "ash"]);
        // Spec 187 D16 (TK-403): the wind's drift of the ash is the wind's (ВІТЕР).
        this.#renderLinks(ASH_LINKS, this.#group("Що робить з попелом вітер (загальне)", section, ["WEATHER", "ash", "byOthers"]),
          ["WEATHER", "ash", "byOthers"]);
      }
      if (mode.location) this.#renderLookValues("ash", mode.location, this.#group("Від сили: від (5 %) і до (100 %) (локація)", section, ["WEATHER", "ash", "lookValues"]));
    });
  }

  #renderWater(content, mode) {
    const water = this.#general()?.water;
    const parts = [];
    if (mode.general) parts.push(["canvas", "water"]);
    if (mode.location) parts.push(["locations", "map", mode.location, "environment", "current"]);
    this.#elementSection("ВОДА", "water", content, parts, (section) => {
      this.#renderWaterStrength(section, mode);
      if (mode.general) {
        const testOn = this.#general()?.debug?.waveTestBackground === true;
        const waveTestPath = ["CONFIG", "debug", "waveTestBackground"];
        this.#ui.addParameter(section, { control: "switch", label: "Тестовий фон хвиль (смуги)", value: testOn,
          onCommit: (on) => {
            const id = this.#locationsMap?.()?.[this.#weather.locationId]?.waveTestBackground;
            if (on && id) this.#weather.requestImage?.(id);
            this.#updateConfig?.(waveTestPath, on === true);
          }, path: ["WEATHER", "water", "testBackground"], bindingPath: waveTestPath, ...this.#changeTracking(waveTestPath) });
        // Spec 187 D4 (TK-404): the waves' look, how the weather changes them, and the float's rocking — three groups of
        // the same parameters (their paths unchanged).
        const { seaState, floatRocking, ...waves } = water ?? {};
        this.#tree(waves, this.#group("Вигляд хвиль (загальне)", section, ["WEATHER", "water", "waves"]), ["canvas", "water"]);
        this.#renderEffects(seaState, ["canvas", "water", "seaState"],
          this.#group("Стан моря — як погода міняє хвилі (загальне)", section, ["WEATHER", "water", "seaState"]));
        this.#tree(floatRocking, this.#group("Покачування поплавка (загальне)", section, ["WEATHER", "water", "floatRocking"]),
          ["canvas", "water", "floatRocking"]);
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

  // Spec 187 D8: the general look of the rain or the ash (its `strength` holds the [від, до] pairs).
  #generalLook(kind) {
    return this.#general()?.[kind] ?? (kind === "rain" ? this.#rainConfig() : this.#ashConfig());
  }

  // Both ends of one strength value for a location: its own override, else the general end.
  #lookEnds(kind, id, key) {
    const range = this.#generalLook(kind)?.strength?.[key];
    const own = lookOverrideEnds(this.#locationWeather(id)?.look?.[kind]?.[key]);
    return { from: own.from ?? (Array.isArray(range) ? Number(range[0]) : NaN),
      to: own.to ?? (Array.isArray(range) ? Number(range[1]) : NaN) };
  }

  // Writes one end of a location's [від, до]; the other end keeps what the location had (null — the general one).
  #setLookEnd(kind, id, key, end, value) {
    const weather = this.#locationWeather(id);
    if (!weather) return;
    if (!weather.look) this.#updateConfig?.(["CONFIG", ...this.#locationParts(id, "look")], { rain: {}, ash: {} });
    if (!this.#locationWeather(id)?.look?.[kind]) this.#updateConfig?.(["CONFIG", ...this.#locationParts(id, "look", kind)], {});
    const own = lookOverrideEnds(this.#locationWeather(id)?.look?.[kind]?.[key]);
    this.#updateConfig?.(["CONFIG", ...this.#locationParts(id, "look", kind, key)],
      end === "from" ? [value, own.to] : [own.from, value]);
  }

  // Spec 187 stage B (owner: «коли я кручу повзунок то і відповідні числа в параметрах замінюються в реальному часі
  // щоб я бачив які параметри при 0 і які значення при 100%»; D9, D15, D17). For the location the game runs: one field
  // per strength value, standing at the value at the strength slider's level and following it; «від» is edited with the
  // slider at 5 % or less, «до» at 100 %, between the field only shows (its prerequisite points at the slider); a value
  // the slider moved since the section was drawn, or the location's own override, is marked like a changed parameter
  // (a dot, «Змінені»), its reset drops the location's override. Another location (no slider): «від» and «до» as a pair.
  #renderLookValues(kind, id, parent) {
    const strength = this.#generalLook(kind)?.strength;
    if (!strength || typeof strength !== "object") return;
    const level = id === this.#weather.locationId ? this.#levelReaders.get(kind) ?? null : null;
    for (const key of Object.keys(strength)) {
      if (!Array.isArray(strength[key])) continue;
      const cfgPath = ["CONFIG", ...this.#locationParts(id, "look", kind, key)];
      const path = ["WEATHER", kind, "look", key];
      const label = STRENGTH_LABELS[key] ?? key;
      const overridden = () => this.#edits?.isOverridden?.(cfgPath) === true;
      if (!level) {
        const ends = this.#lookEnds(kind, id, key);
        this.#ui.addParameter(parent, { control: "numberPair", label: `${label}: від / до`, value: [ends.from, ends.to], path,
          configPath: cfgPath, onCommit: (next) => {
            if (!Array.isArray(next) || next.length !== 2 || !next.every((end) => Number.isFinite(Number(end)))) return;
            this.#setLookEnd(kind, id, key, "from", Number(next[0]));
            this.#setLookEnd(kind, id, key, "to", Number(next[1]));
          }, isChanged: overridden, onReset: () => this.#edits?.resetParameter?.(cfgPath) });
        continue;
      }
      const valueNow = () => {
        const ends = this.#lookEnds(kind, id, key);
        return Math.round(strengthValue(ends.from, ends.to, level()) * 1000) / 1000;
      };
      const editableEnd = () => {
        const now = level();
        return now <= VISIBLE_STRENGTH + 1e-6 ? "from" : now >= 1 - 1e-6 ? "to" : null;
      };
      const drawn = valueNow();
      this.#ui.addParameter(parent, { control: "number", label, value: drawn, path, configPath: cfgPath,
        onCommit: (next) => {
          const end = editableEnd();
          if (!end || !Number.isFinite(Number(next))) return;
          this.#setLookEnd(kind, id, key, end, Number(next));
          this.#ui.showLiveValue(path, valueNow());
        },
        requires: [{ path: ["WEATHER", kind, "strength"], isEnabled: () => editableEnd() !== null }],
        isChanged: () => valueNow() !== drawn || overridden(),
        onReset: () => {
          this.#edits?.resetParameter?.(cfgPath);
          this.#ui.showLiveValue(path, valueNow());
        } });
      this.#liveSliders.push({ path, read: valueNow, shown: drawn });
    }
  }

  // Spec 189 D1: the export's parts as they run now (base false) or as in the code (base true) — every general part and
  // the location's parts (its weather, its current); a part the ports cannot read is null.
  #exportParts(base, id) {
    const read = base ? this.#readBaseConfig : this.#readConfig;
    const general = {}, location = {};
    for (const part of GENERAL_WEATHER_PART_IDS) general[part] = read?.(GENERAL_WEATHER_PARTS[part].configPath) ?? null;
    for (const part of LOCATION_WEATHER_PART_IDS) location[part] = read?.(LOCATION_WEATHER_PARTS[part].configPath(id)) ?? null;
    return { general, location };
  }

  // Spec 180 stage D, spec 189: every part of both levels that differs from the code, and — when the export would leave
  // some of them out (the selector shows the other level) — where to export them from.
  #readSavingStatus() {
    const id = this.#locationId();
    if (!this.#readConfig || !this.#readBaseConfig) return "Параметри погоди завантажено.";
    const live = this.#exportParts(false, id), base = this.#exportParts(true, id);
    const changed = changedWeatherParts({ baseGeneral: base.general, liveGeneral: live.general, baseLocation: base.location,
      liveLocation: live.location });
    if (!changed.length) return "Погода збігається з кодом.";
    const labels = changed.map((part) => (part.startsWith("location.") ? `${PART_LABELS[part]} ${id}` : PART_LABELS[part]));
    const mode = this.#mode();
    const generalLeft = !mode.general && changed.some((part) => part.startsWith("general."));
    const locationLeft = !mode.location && changed.some((part) => part.startsWith("location."));
    const hint = generalLeft ? " Загальні не ввійдуть в експорт: оберіть «Загальні» або «Всі»."
      : locationLeft ? ` Погода ${id} не ввійде в експорт: оберіть локацію ${id} або «Всі».` : "";
    return `Змінено (ще не в коді): ${labels.join(", ")}.${hint}`;
  }

  // Spec 189 D2: format v3 — the levels the selector shows, in full, and every change against the code.
  async #buildExport() {
    const mode = this.#mode();
    const id = mode.location;
    const moment = this.#now();
    if (!this.#readConfig || !this.#readBaseConfig) return { error: "Немає доступу до параметрів погоди для експорту." };
    const live = this.#exportParts(false, id), base = this.#exportParts(true, id);
    if (mode.general && GENERAL_WEATHER_PART_IDS.some((part) => !live.general[part])) {
      return { error: "Немає загальних параметрів погоди для експорту." };
    }
    if (id && !live.location.weather) return { error: `Немає погоди локації ${id} для експорту.` };
    return {
      fileName: weatherFileName({ general: mode.general, locationId: id }, this.#gameVersion, moment),
      data: buildWeatherFile({
        general: mode.general ? live.general : null, generalBase: base.general,
        locationId: id, location: id ? live.location : null, locationBase: base.location,
        gameVersion: this.#gameVersion,
        exportedAt: moment.toISOString(),
      }),
    };
  }

  // Spec 189 D3: a v3 file's changes go onto the running config parameter by parameter (a parameter the code no longer
  // has is skipped and named in the status); a v2 file brings its whole levels, a v1 file the rain and a location, as
  // before. A location must be the one the selector names (or the game's, with «Загальні»).
  #applyImport(file, setStatus) {
    const id = this.#locationId();
    const read = readWeatherFile(file);
    if (read?.locationId && read.locationId !== id) {
      setStatus(`Файл для локації ${read.locationId}; зараз відкрито ${id}.`);
      return;
    }
    if (read?.version === WEATHER_FILE_VERSION) {
      this.#importChanges(file, read, id, setStatus);
      return;
    }
    const base = this.#exportParts(true, id);
    const errors = validateWeatherFile(file, { generalTemplates: base.general, locationWeatherTemplate: base.location.weather });
    if (errors.length) {
      setStatus(`Файл не прийнято: ${errors.slice(0, 3).join("; ")}`);
      return;
    }
    for (const part of Object.keys(read.general ?? {})) {
      this.#updateConfig?.(["CONFIG", ...GENERAL_WEATHER_PARTS[part].configPath], canonicalGeneralPart(read.general[part]));
    }
    if (read.locationId) {
      this.#updateConfig?.(["CONFIG", ...LOCATION_WEATHER_PARTS.weather.configPath(id)], canonicalLocationWeather(read.locationWeather));
    }
    this.#fill();
  }

  #importChanges(file, read, id, setStatus) {
    const base = this.#exportParts(true, id);
    const partValue = (key) => {
      const part = weatherPartSpec(key);
      return part ? base[part.level][part.id] : null;
    };
    const errors = validateWeatherFile(file, { currentValue: partValue });
    if (errors.length) {
      setStatus(`Файл не прийнято: ${errors.slice(0, 3).join("; ")}`);
      return;
    }
    // TK-408.1: the same merge as apply:weather (renames, a parameter the code no longer has); each parameter is written
    // on its own path, so its «змінено» mark and reset work as for an edit by hand.
    const skipped = [];
    for (const key of new Set(read.changes.map((change) => change.part))) {
      const part = weatherPartSpec(key);
      const merge = applyLeafChanges(key, partValue(key), read.changes);
      for (const missing of merge.missing) skipped.push(`${key}.${missing.path}`);
      const root = part.level === "general" ? part.spec.configPath : part.spec.configPath(id);
      for (const change of [...merge.applied, ...merge.conflicts]) {
        this.#updateConfig?.(["CONFIG", ...root, ...change.path.split(".")], JSON.parse(JSON.stringify(change.to)));
      }
    }
    this.#fill();
    if (skipped.length) setStatus(`Імпортовано; пропущено (немає в коді): ${skipped.join(", ")}`);
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

  // TK-367 (owner): «Оновити» on top and «Автоматична погода» (TK-398: a switch) under it, then the state; then every
  // element as a switch that follows its live state (R26); the actions at the bottom, «Болід зараз» last.
  // Spec 187 D11–D14 (owner): with the automatic weather on nothing is set by hand — the switches, the wind's direction
  // and the strength sliders show the live state but need the automatic weather off (DevToolsUI `requires`), and the
  // actions are not there; off — the weather is frozen and changed only here: a switch on holds its element at its last
  // level, off at 0 (no random event, no timeline).
  #renderControls(model, content) {
    const weather = model.snapshot;
    const controls = this.#createSection("Керування", content, ["WEATHER", "controls"]);
    this.#shownLive = this.#liveState();
    // TK-367.1 (owner): the buttons two to a line with short labels.
    const top = this.#ui.createButtonGrid(controls);
    this.#ui.createButtonRow("Оновити", top, () => this.#fill(), false, "", ["WEATHER", "controls", "refresh"],
      { icon: "refresh" });
    // TK-398 (owner): one switch for the whole automatic weather. Spec 187 D11, D12: on — every hold is released and
    // the weather runs by itself; off — it freezes where it is (the models hold their levels), nothing is released.
    if (this.#weather.setAutomatic) {
      this.#ui.createSwitcherRow("Автоматична погода", this.#weather.isAutomatic?.() !== false, controls, (on) => {
        this.#weather.setAutomatic(on === true);
        if (on === true) this.#releaseHolds();
        this.#fill();
      }, AUTO_PATH);
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
    this.#renderActions(model, actions);
    this.#renderBolide(actions);
  }

  // Spec 187 D11: setting the weather by hand needs the automatic weather off (no automatic port: always allowed).
  #manualAllowed() {
    return !this.#weather.setAutomatic || this.#weather.isAutomatic?.() === false;
  }

  // The prerequisite of every manual control (DevToolsUI `requires`: inactive, and a press points at the switch).
  #manualRequires() {
    if (!this.#weather.setAutomatic) return [];
    return [{ path: AUTO_PATH, isEnabled: () => this.#manualAllowed() }];
  }

  // D10, TK-398: every hold released — each element back to its own course (the automatic weather turned on).
  // TK-402.2: the models' holds are released by the environment itself (setAutomatic(true)); here the views' own.
  #releaseHolds() {
    this.#weather.holdAsh?.(null);
    this.#weather.holdWaves?.(null);
    this.#weather.holdCurrent?.(null);
  }

  // TK-367: a slider's label says when the element is held by hand.
  #heldLabel(label, held) {
    return held ? `${label} · вручну` : label;
  }

  // A switch of «Керування» that needs the automatic weather off (spec 187 D11).
  #manualSwitch(label, value, controls, onChange, path) {
    this.#ui.createSwitcherRow(label, value, controls, onChange, path, path, { requires: this.#manualRequires() });
  }

  // A live share 0…1 as the slider's percent; remembered as the level a switch turns on with when above zero.
  #liveLevel(key, share, scale = 100) {
    const value = Math.round(Math.max(0, Number(share) || 0) * scale * 10) / 10;
    if (value > 0) this.#levels[key] = value;
    return value;
  }

  // Spec 187 D12, D13: on holds the event at its last level, off at 0 — no random event, no timeline.
  #renderEventControl(model, kind, label, event, controls) {
    this.#manualSwitch(label, this.#eventOn(event), controls, (on) => {
      model.hold(kind, on ? this.#levels[kind] / 100 : 0, { fadeSec: this.#fadeSec });
      this.#fill();
    }, ["WEATHER", "controls", kind]);
  }

  // Spec 187 A (owner: «повзунки там повинні бути відсутні взагалі, всі повзунки перенести у відповідні розділи»): an
  // element's strength slider on top of its own section, only for the location the game runs (it holds the running
  // game, Q1); it stands at the live value and follows it (TK-401); D11: moving it needs the automatic weather off.
  #renderStrength(kind, section, mode) {
    if (!mode.location || mode.location !== this.#weather.locationId) return;
    const weather = this.#weather;
    const path = ["WEATHER", kind, "strength"];
    const percentRow = (held, live, hold, read) => {
      const level = Math.round(this.#liveLevel(kind, live));
      this.#ui.addParameter(section, { control: "range", label: this.#heldLabel("Сила, %", held), value: level,
        onCommit: (value) => {
          this.#levels[kind] = clamp(value, 0, 100);
          hold(this.#levels[kind] / 100);
        }, path, requires: this.#manualRequires() });
      this.#followLive(path, () => Math.round(Number(read()) * 100) || 0);
      // Spec 187 B: the look values of this section stand at the slider's level (the live or held strength).
      this.#levelReaders.set(kind, () => Number(read()) || 0);
    };
    if (kind === "rain" || kind === "storm" || kind === "fog") {
      const model = weather.getModel();
      if (!model) return;
      const eventNow = () => model.snapshot?.events?.[kind];
      const event = eventNow();
      percentRow(event?.held === true, event?.held ? event.target : event?.strength,
        (share) => model.hold(kind, share, { fadeSec: this.#fadeSec }),
        () => (eventNow()?.held ? eventNow().target : eventNow()?.strength));
    } else if (kind === "emission") {
      const emission = weather.getEmissionModel?.() ?? null;
      if (!emission) return;
      percentRow(emission.snapshot.intensityHeld === true, emission.snapshot.intensity,
        (share) => emission.holdIntensity(share), () => emission.snapshot.intensity);
    } else if (kind === "ash") {
      if (!weather.holdAsh) return;
      const hold = weather.getAshHold?.() ?? null;
      percentRow(hold !== null, hold ?? weather.getAshStrength?.(),
        (share) => weather.holdAsh(share), () => weather.getAshHold?.() ?? weather.getAshStrength?.() ?? 0);
    } else if (kind === "starfall") {
      const starfall = weather.getStarfallModel?.() ?? null;
      if (!starfall) return;
      percentRow(starfall.snapshot.held === true, starfall.snapshot.strength,
        (share) => starfall.hold(share), () => starfall.snapshot.strength);
    } else if (kind === "wind") {
      if (!weather.setWindStrength) return;
      const wind = weather.getWind?.() ?? null;
      // TK-401: the wind's own strength with its gusts; a strength held by hand shows that value. A wind held calm
      // (its switch off) blows again once the slider is moved.
      percentRow(wind?.forcedStrength != null, wind?.forcedStrength ?? wind?.strength, (share) => {
        if ((weather.getWind?.()?.forcedDirection ?? null) === 0) weather.setWind(this.#windDirectionOn(weather.getWind?.()));
        weather.setWindStrength(share);
      }, () => weather.getWind?.()?.forcedStrength ?? weather.getWind?.()?.strength ?? 0);
    }
  }

  // Spec 187 A: the waves' height and the current's speed on top of ВОДА (the running location only).
  #renderWaterStrength(section, mode) {
    if (!mode.location || mode.location !== this.#weather.locationId) return;
    const weather = this.#weather;
    if (weather.holdWaves) {
      const hold = weather.getWavesHold?.() ?? null;
      const level = Math.round(this.#liveLevel("waves", hold ?? weather.getWavesScale?.() ?? 1) / 5) * 5;
      const path = ["WEATHER", "water", "wavesHeight"];
      this.#ui.addParameter(section, { control: "range", label: this.#heldLabel("Хвилі: висота, % від звичайної", hold !== null),
        value: clamp(level, 0, 300), min: 0, max: 300, step: 5, onCommit: (value) => {
          this.#levels.waves = clamp(value, 0, 300);
          weather.holdWaves(this.#levels.waves / 100);
        }, path, requires: this.#manualRequires() });
      this.#followLive(path, () =>
        clamp(Math.round(Number(weather.getWavesHold?.() ?? weather.getWavesScale?.() ?? 1) * 100 / 5) * 5, 0, 300));
    }
    const speed = weather.getCurrentSpeed?.();
    if (weather.holdCurrent && speed !== null && speed !== undefined) {
      const hold = weather.getCurrentHold?.() ?? null;
      const path = ["WEATHER", "water", "currentSpeed"];
      this.#ui.addParameter(section, { control: "range", label: this.#heldLabel("Течія: швидкість, px/с", hold !== null),
        value: clamp(this.#liveLevel("current", speed, 1), 0, 60), min: 0, max: 60, step: 0.5, onCommit: (value) => {
          this.#levels.current = clamp(value, 0, 60);
          weather.holdCurrent(this.#levels.current);
        }, path, requires: this.#manualRequires() });
      this.#followLive(path, () =>
        clamp(Math.round(Number(weather.getCurrentHold?.() ?? weather.getCurrentSpeed?.() ?? 0) * 2) / 2, 0, 60));
    }
  }

  // Spec 187 D12, D13: the emission held at its last strength (its phase then «пік») or at 0 — no phases pass.
  #renderEmissionControl(emission, controls) {
    if (!emission) return;
    this.#manualSwitch("Викид", emission.snapshot.phase !== "idle", controls, (on) => {
      emission.holdIntensity(on ? this.#levels.emission / 100 : 0);
      this.#fill();
    }, ["WEATHER", "controls", "emission"]);
  }

  // TK-354.1 (owner): «Зорепад» for a test — on: the game clock jumps to the night (unless it is already inside the
  // starfall's window) and the starfall is held at its last strength; off: released (no night plan without the
  // automatic weather: none).
  #renderStarfallControls(controls) {
    const starfall = this.#weather.getStarfallModel?.() ?? null;
    if (!starfall) return;
    const snapshot = starfall.snapshot;
    if (snapshot.held) this.#starfallLevel = Math.round(snapshot.strength * 100);
    this.#manualSwitch("Зорепад (ніч)", snapshot.held === true, controls, (on) => {
      if (on) {
        if (!snapshot.inWindow) this.#weather.setGameHour?.(STARFALL_TEST_HOUR);
        starfall.hold(this.#starfallLevel / 100);
      } else starfall.hold(null);
      this.#fill();
    }, ["WEATHER", "controls", "starfall"]);
  }

  // TK-367 (owner: «попіл … з'являється з викидом але керувати я повинен ним і окремо»): on — the ash held at its last
  // level; off — held at 0 even during an emission.
  #renderAshControl(controls) {
    const weather = this.#weather;
    if (!weather.holdAsh) return;
    const hold = weather.getAshHold?.() ?? null;
    this.#manualSwitch("Попіл", (weather.getAshStrength?.() ?? hold ?? 0) > LIVE_EPSILON, controls, (on) => {
      weather.holdAsh(on ? this.#levels.ash / 100 : 0);
      this.#fill();
    }, ["WEATHER", "controls", "ash"]);
  }

  // TK-367 (owner): on — the wind blows at its last strength in a direction (the one held, or the live one, or to the
  // right); off — calm. The direction «← вліво | авто | вправо →» while it blows.
  #renderWindControls(controls) {
    const weather = this.#weather;
    if (!weather.setWind) return;
    const wind = weather.getWind?.() ?? null;
    const shown = this.#windOn(wind);
    const forcedDirection = wind?.forcedDirection ?? null;
    this.#manualSwitch("Вітер", shown, controls, (on) => {
      if (on) {
        weather.setWind(this.#windDirectionOn(weather.getWind?.() ?? null));
        weather.setWindStrength?.(this.#levels.wind / 100);
      } else weather.setWind(0);
      this.#fill();
    }, ["WEATHER", "controls", "wind"]);
    if (!shown) return;
    const choice = WIND_CHOICES.find((option) => option.direction === forcedDirection) ?? WIND_CHOICES[1];
    this.#ui.addParameter(controls, { control: "segments", label: "Вітер: напрям",
      options: WIND_CHOICES.map((option) => ({ value: option.value, label: option.label })), value: choice.value,
      onCommit: (next) => {
        weather.setWind(WIND_CHOICES.find((option) => option.value === next)?.direction ?? null);
        this.#fill();
      }, path: ["WEATHER", "controls", "windDirection"], requires: this.#manualRequires() });
  }

  // The direction a wind turned on by hand blows in: the one held, else the live one, else to the right.
  #windDirectionOn(wind) {
    const held = wind?.forcedDirection ?? null;
    if (held === -1 || held === 1) return held;
    const live = Math.sign(Number(wind?.direction) || 0);
    return live === -1 || live === 1 ? live : 1;
  }

  #windOn(wind) {
    return !!wind && wind.direction !== 0 && Number(wind.strength) > LIVE_EPSILON;
  }

  // TK-367: on — the waves' height held at its last level (% of the usual); off — flat water.
  #renderWavesControl(controls) {
    const weather = this.#weather;
    if (!weather.holdWaves) return;
    this.#manualSwitch("Хвилі", this.#wavesOn(), controls, (on) => {
      weather.holdWaves(on ? this.#levels.waves / 100 : 0);
      this.#fill();
    }, ["WEATHER", "controls", "wavesOn"]);
  }

  // TK-367: on — the water current held at its last speed; off — still water. A hold of the running game, not a config
  // edit (the location's current is edited in «ВОДА» → «Течія»).
  #renderCurrentControl(controls) {
    const weather = this.#weather;
    if (!weather.holdCurrent) return;
    const speed = weather.getCurrentSpeed?.();
    if (speed === null || speed === undefined) return;
    this.#manualSwitch("Течія", Number(speed) > LIVE_EPSILON, controls, (on) => {
      weather.holdCurrent(on ? this.#levels.current : 0);
      this.#fill();
    }, ["WEATHER", "controls", "currentOn"]);
  }

  // TK-360 (owner): «Болід зараз» is the last row; on a phone the panel closes at once, so the bolide is seen falling.
  #renderBolide(controls) {
    const starfall = this.#weather.getStarfallModel?.() ?? null;
    if (!starfall) return;
    this.#ui.createButtonRow("Болід", controls, () => {
      starfall.bolideNow();
      this.#closeOnPhone();
    }, false, "", ["WEATHER", "controls", "bolide"], { requires: this.#manualRequires() });
  }

  // TK-367 (owner: «Всі інші кнопки в самому низу»): the actions after every control — they need the automatic weather
  // off (spec 187 D11, D14: a gust or a strike now, beside the ones its level's chances give).
  #renderActions(model, controls) {
    const requires = this.#manualRequires();
    if (this.#weather.triggerWindGust) {
      this.#ui.createButtonRow("Порив вітру", controls, () => {
        this.#weather.triggerWindGust();
        this.#fill();
      }, false, "", ["WEATHER", "controls", "gust"], { requires });
    }
    // Spec 188 D9: on a phone the panel closes, so the strike is seen (like «Болід»).
    this.#ui.createButtonRow("Блискавка", controls, () => {
      model.strike();
      this.#fill();
      this.#closeOnPhone();
    }, false, "", ["WEATHER", "controls", "strike"], { requires });
  }
}
