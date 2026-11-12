// DevTools «🌦 ПОГОДА» (spec 172 stage A TK-261, rain controls TK-271): the weather model's state; rain, storm and fog
// switched on by hand with live strength sliders (a switched-on state freezes the weather's timers, so it stays until
// switched off; all off returns to the automatic weather); the wind's direction (automatic, left, calm, right); the
// transition time; a lightning strike now; the rain's look (CONFIG.canvas.rain, live) and the location's weather
// settings (CONFIG.locations.map.<id>.weather, live). The status is read when the section is drawn and after every
// action («↻ Оновити» reads it again).
const PRECIPITATION_LABELS = Object.freeze({ clear: "ясно", rain: "дощ", storm: "гроза" });
const FOG_LABELS = Object.freeze({ none: "немає", fog: "туман" });
const WIND_CHOICES = Object.freeze([
  Object.freeze({ label: "авто", direction: null }),
  Object.freeze({ label: "← вліво", direction: -1 }),
  Object.freeze({ label: "немає", direction: 0 }),
  Object.freeze({ label: "вправо →", direction: 1 }),
]);
const WIND_NAMES = Object.freeze({ "-1": "вліво", 0: "немає", 1: "вправо" });

const percent = (value) => `${Math.round((Number(value) || 0) * 100)}%`;
const seconds = (value) => `${Math.round(Number(value) || 0)} с`;

export class WeatherDevSection {
  #ui;
  #weather;
  #config;
  #rainConfig;
  #createSection;
  #renderConfigTree;
  #content = null;
  #rain = 70;
  #storm = 80;
  #fog = 60;
  #fadeSec = 5;

  // weather: { getModel() → WeatherModel | null, getWind() → { direction, forced } | null, setWind(direction | null),
  // locationId }; config: () => the location's weather settings; rainConfig: () => CONFIG.canvas.rain;
  // createSection(label, parent, path) and renderConfigTree(value, parent, path) come from DevTools.
  constructor({ ui, weather, config, rainConfig = () => null, createSection, renderConfigTree }) {
    this.#ui = ui;
    this.#weather = weather;
    this.#config = config;
    this.#rainConfig = rainConfig;
    this.#createSection = createSection;
    this.#renderConfigTree = renderConfigTree;
  }

  render(parent) {
    this.#content = this.#createSection("🌦 ПОГОДА", parent, ["WEATHER"]);
    this.#fill();
  }

  #fill() {
    const content = this.#content;
    if (!content) return;
    content.replaceChildren();
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
