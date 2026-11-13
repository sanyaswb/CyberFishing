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

// DevTools «🌦 ПОГОДА» (spec 172 stage A TK-261, rain controls TK-271, saving/export spec 175 TK-286): the weather
// model's state; rain, storm and fog switched on by hand with live strength sliders (a switched-on state freezes the
// weather's timers, so it stays until switched off; all off returns to the automatic weather); the wind's direction
// (automatic, left, calm, right); the transition time; a lightning strike now; the rain's look (CONFIG.canvas.rain,
// live), the location's weather settings (CONFIG.locations.map.<id>.weather, live), and saving (status vs code,
// export/import JSON, reset to code). The status is read when the section is drawn and after every action.
const PRECIPITATION_LABELS = Object.freeze({ clear: "ясно", rain: "дощ", storm: "гроза" });
const FOG_LABELS = Object.freeze({ none: "немає", fog: "туман" });
const WIND_CHOICES = Object.freeze([
  Object.freeze({ label: "авто", direction: null }),
  Object.freeze({ label: "← вліво", direction: -1 }),
  Object.freeze({ label: "немає", direction: 0 }),
  Object.freeze({ label: "вправо →", direction: 1 }),
]);
const WIND_NAMES = Object.freeze({ "-1": "вліво", 0: "немає", 1: "вправо" });
const PART_LABELS = Object.freeze({ rain: "Вигляд дощу", locationWeather: "Параметри локації" });

const percent = (value) => `${Math.round((Number(value) || 0) * 100)}%`;
const seconds = (value) => `${Math.round(Number(value) || 0)} с`;

export class WeatherDevSection {
  #ui;
  #weather;
  #config;
  #rainConfig;
  #createSection;
  #renderConfigTree;
  #updateConfig;
  #files;
  #getBaseRain;
  #getBaseLocationWeather;
  #resetWeather;
  #gameVersion;
  #now;
  #content = null;
  #saving = null;
  #savingStatus = null;
  #exportedFile = null;
  #listening = false;
  #rain = 70;
  #storm = 80;
  #fog = 60;
  #fadeSec = 5;
  #onConfigUpdated = (event) => {
    if (!this.#savingStatus) return;
    const path = event?.detail?.path;
    if (!Array.isArray(path) || path[0] !== "CONFIG") return;
    const isRain = path[1] === "canvas" && path[2] === "rain";
    const isLocation = path[1] === "locations" && path[2] === "map" && path[3] === this.#weather.locationId && path[4] === "weather";
    if (isRain || isLocation) this.#showSavingStatus();
  };

  // weather: { getModel() → WeatherModel | null, getWind() → { direction, forced } | null, setWind(direction | null),
  // locationId }; config: () => the location's weather settings; rainConfig: () => CONFIG.canvas.rain;
  // files: { download(name, text), pickFile(), hashText(text) }; getBaseRain() / getBaseLocationWeather(id): base
  // code values; resetWeather(id): drops session overrides of rain look and the location's weather.
  constructor({
    ui,
    weather,
    config,
    rainConfig = () => null,
    createSection,
    renderConfigTree,
    updateConfig = null,
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
    this.#rainConfig = rainConfig;
    this.#createSection = createSection;
    this.#renderConfigTree = renderConfigTree;
    this.#updateConfig = updateConfig;
    this.#files = files;
    this.#getBaseRain = getBaseRain;
    this.#getBaseLocationWeather = getBaseLocationWeather;
    this.#resetWeather = resetWeather;
    this.#gameVersion = gameVersion;
    this.#now = now;
  }

  render(parent) {
    this.#content = this.#createSection("🌦 ПОГОДА", parent, ["WEATHER"]);
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
    this.#content = null;
    this.#saving = null;
    this.#savingStatus = null;
  }

  #fill() {
    const content = this.#content;
    if (!content) return;
    this.#ui.releaseValueBindings?.(content);
    content.replaceChildren();
    this.#saving = null;
    this.#savingStatus = null;
    const model = this.#weather.getModel();
    if (!model) {
      this.#ui.createInfoRow("стан", "погода не створена", content);
      return;
    }
    this.#renderStatus(model.snapshot, content);
    this.#renderControls(model, content);
    const rain = this.#rainConfig();
    if (rain) {
      this.#renderConfigTree(rain, this.#createSection("Вигляд дощу", content, ["WEATHER", "rain"]), ["CONFIG", "canvas", "rain"]);
    }
    const settings = this.#config();
    if (settings) {
      this.#renderConfigTree(settings, this.#createSection("Параметри локації", content, ["WEATHER", "config"]),
        ["CONFIG", "locations", "map", this.#weather.locationId, "weather"]);
    }
    this.#saving = this.#createSection("Збереження", content, ["WEATHER", "saving"]);
    this.#fillSaving();
  }

  #fillSaving() {
    const list = this.#saving;
    if (!list) return;
    const ui = this.#ui;
    ui.releaseValueBindings?.(list);
    list.replaceChildren();
    this.#savingStatus = ui.createTextRow
      ? ui.createTextRow("Стан погоди", "", list)
      : ui.createInfoRow("Стан погоди", "", list);
    this.#showSavingStatus();
    if (this.#files) {
      ui.createButtonRow("Експорт погоди", list, () => { void this.#exportWeather(); });
      ui.createButtonRow("Імпорт погоди", list, () => { void this.#importWeather(); });
    }
    if (this.#resetWeather) {
      ui.createButtonRow("Скинути зміни погоди до коду", list, () => {
        this.#resetWeather(this.#weather.locationId);
        this.#fill();
      });
    }
    ui.createInfoRow("Збереження", "Експорт погоди завантажує файл вигляду дощу й погоди цієї локації. У код зміни переносить команда npm run apply:weather -- <файл> (перевірка, конфлікти, підтвердження, бекап); після неї перезавантажте сторінку або скиньте зміни погоди до коду. Імпорт погоди відкриває такий файл тут, щоб продовжити редагування. Без експорту зміни зникають при перезавантаженні.", list);
    if (this.#exportedFile) this.#showExportCommand(list, this.#exportedFile);
  }

  #showSavingStatus(message = null) {
    const status = this.#savingStatus;
    if (!status) return;
    if (message) { status.innerText = message; return; }
    const id = this.#weather.locationId;
    const liveRain = this.#rainConfig(), liveWeather = this.#config();
    const baseRain = this.#getBaseRain?.(), baseWeather = this.#getBaseLocationWeather?.(id);
    if (!liveRain || !liveWeather || !baseRain || !baseWeather) {
      status.innerText = "Параметри погоди завантажено.";
      return;
    }
    const changed = changedWeatherParts(baseRain, liveRain, baseWeather, liveWeather);
    status.innerText = changed.length
      ? `Змінено (ще не в коді): ${changed.map((part) => PART_LABELS[part] ?? part).join(", ")}.`
      : "Погода збігається з кодом.";
  }

  #showExportCommand(host, fileName) {
    this.#exportedFile = fileName;
    this.#ui.showExportCommand?.(host, {
      fileName,
      command: `npm run apply:weather -- ${fileName}`,
      onClose: () => { this.#exportedFile = null; },
    });
  }

  async #exportWeather() {
    const id = this.#weather.locationId;
    const liveRain = this.#rainConfig(), liveWeather = this.#config();
    if (!liveRain || !liveWeather) { this.#showSavingStatus("Немає параметрів погоди для експорту."); return null; }
    try {
      const hashText = (text) => this.#files.hashText(text);
      const baseRain = this.#getBaseRain?.() ?? liveRain;
      const baseWeather = this.#getBaseLocationWeather?.(id) ?? liveWeather;
      const moment = this.#now();
      const file = buildWeatherFile({
        locationId: id,
        rain: liveRain,
        locationWeather: liveWeather,
        rainBaseHash: await rainHash(baseRain, hashText),
        locationWeatherBaseHash: await locationWeatherHash(baseWeather, hashText),
        gameVersion: this.#gameVersion,
        exportedAt: moment.toISOString(),
      });
      const name = weatherFileName(id, this.#gameVersion, moment);
      this.#files.download(name, `${JSON.stringify(file, null, 2)}\n`);
      this.#showSavingStatus(`Збережено файл ${name}.`);
      if (this.#saving) this.#showExportCommand(this.#saving, name);
      return name;
    } catch (error) {
      this.#showSavingStatus(`Експорт не вдався: ${error?.message || error}`);
      return null;
    }
  }

  async #importWeather() {
    const text = await this.#files.pickFile();
    if (text === null) return;
    const id = this.#weather.locationId;
    let file;
    try { file = JSON.parse(text); } catch { this.#showSavingStatus("Файл не є JSON."); return; }
    if (file?.locationId && file.locationId !== id) {
      this.#showSavingStatus(`Файл для локації ${file.locationId}; зараз відкрито ${id}.`);
      return;
    }
    const errors = validateWeatherFile(file, {
      rainTemplate: this.#getBaseRain?.() ?? this.#rainConfig(),
      locationWeatherTemplate: this.#getBaseLocationWeather?.(id) ?? this.#config(),
    });
    if (errors.length) {
      this.#showSavingStatus(`Файл не прийнято: ${errors.slice(0, 3).join("; ")}`);
      return;
    }
    this.#updateConfig?.(["CONFIG", "canvas", "rain"], canonicalRain(file.rain));
    this.#updateConfig?.(["CONFIG", "locations", "map", id, "weather"], canonicalLocationWeather(file.locationWeather));
    this.#fill();
  }

  #renderStatus(weather, content) {
    const wind = this.#weather.getWind?.() ?? null;
    this.#ui.createInfoRow("опади", `${PRECIPITATION_LABELS[weather.precipitation] ?? weather.precipitation} · ${
      weather.frozen ? "вручну" : `ще ${seconds(weather.precipitationLeftSec)}`}`, content);
    this.#ui.createInfoRow("дощ", `${percent(weather.rain)} → ${percent(weather.rainTarget)}`, content);
    this.#ui.createInfoRow("гроза", `${percent(weather.storm)} → ${percent(weather.stormTarget)}`, content);
    this.#ui.createInfoRow("туман", `${FOG_LABELS[weather.fogState] ?? weather.fogState} · ${percent(weather.fog)} → ${
      percent(weather.fogTarget)}`, content);
    this.#ui.createInfoRow("вітер", wind ? `${WIND_NAMES[wind.direction] ?? wind.direction}${wind.forced ? " (вручну)" : ""}`
      : "—", content);
    this.#ui.createInfoRow("блискавки", `${weather.strikeSerial} · остання: варіант ${weather.strikeVariant + 1}, відстань ${
      percent(weather.strikeDistance)}`, content);
    this.#ui.createButtonRow("↻ Оновити", content, () => this.#fill());
  }

  #renderControls(model, content) {
    const weather = model.snapshot;
    const controls = this.#createSection("Керування", content, ["WEATHER", "controls"]);
    const raining = weather.precipitation !== "clear";
    this.#ui.createSwitcherRow("🌧 Дощ", raining, controls, (on) => {
      if (on) this.#hold(model, "precipitation", "rain", this.#rain);
      else this.#release(model, "precipitation", "clear");
    }, ["WEATHER", "controls", "rain"]);
    this.#ui.createRangeRow("сила дощу, %", this.#rain, controls, (value) => {
      this.#rain = Number(value) || 0;
      if (model.snapshot.precipitation !== "clear") model.setIntensity("rain", this.#rain / 100);
    });
    this.#ui.createSwitcherRow("⛈ Гроза", weather.precipitation === "storm", controls, (on) => {
      if (on) this.#hold(model, "precipitation", "storm", this.#storm);
      else this.#hold(model, "precipitation", "rain", this.#rain);
    }, ["WEATHER", "controls", "storm"]);
    this.#ui.createRangeRow("сила грози, %", this.#storm, controls, (value) => {
      this.#storm = Number(value) || 0;
      if (model.snapshot.precipitation === "storm") model.setIntensity("storm", this.#storm / 100);
    });
    this.#ui.createSwitcherRow("🌫 Туман", weather.fogState === "fog", controls, (on) => {
      if (on) this.#hold(model, "fog", "fog", this.#fog);
      else this.#release(model, "fog", "none");
    }, ["WEATHER", "controls", "fog"]);
    this.#ui.createRangeRow("сила туману, %", this.#fog, controls, (value) => {
      this.#fog = Number(value) || 0;
      if (model.snapshot.fogState === "fog") model.setIntensity("fog", this.#fog / 100);
    });
    if (this.#weather.setWind) {
      const wind = this.#weather.getWind?.() ?? null;
      const current = WIND_CHOICES.find((choice) => wind?.forced && choice.direction === wind.direction) ?? WIND_CHOICES[0];
      this.#ui.createSelectRow("напрям вітру", WIND_CHOICES.map((choice) => choice.label), current.label, controls,
        (label) => {
          this.#weather.setWind(WIND_CHOICES.find((choice) => choice.label === label)?.direction ?? null);
          this.#fill();
        });
    }
    this.#ui.createInputRow("перехід, с", this.#fadeSec, controls, "number", (value) => {
      this.#fadeSec = Math.max(0, Number(value) || 0);
    });
    this.#ui.createButtonRow("⚡ Удар блискавки зараз", controls, () => {
      model.strike();
      this.#fill();
    });
    this.#ui.createSwitcherRow("заморозити погоду", weather.frozen === true, controls, (frozen) => {
      model.setFrozen(frozen);
      this.#fill();
    }, ["WEATHER", "frozen"]);
    this.#ui.createButtonRow("↺ Автоматична погода", controls, () => {
      model.setFrozen(false);
      this.#weather.setWind?.(null);
      this.#fill();
    });
  }

  // A state switched on by hand: forced with its slider's strength and held (the weather's timers stop).
  #hold(model, process, state, strength) {
    model.force(process, state, { intensity: strength / 100, fadeSec: this.#fadeSec });
    model.setFrozen(true);
    this.#fill();
  }

  // Switched off: the state ends with the transition time; with nothing else held, the weather runs on its own again.
  #release(model, process, state) {
    model.force(process, state, { fadeSec: this.#fadeSec });
    const weather = model.snapshot;
    if (weather.precipitation === "clear" && weather.fogState === "none") model.setFrozen(false);
    this.#fill();
  }
}
