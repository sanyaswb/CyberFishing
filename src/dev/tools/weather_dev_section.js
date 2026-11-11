// DevTools «🌦 ПОГОДА» (spec 172 stage A, TK-261): the weather model's state (precipitation and fog states, their
// intensities and targets, the time left, lightning strikes), forcing a state with an intensity and a transition time,
// a lightning strike now, freezing the weather, and the live editor of the location's weather settings
// (CONFIG.locations.map.<id>.weather). The status is read when the section is drawn and after every action
// («↻ Оновити» reads it again).
const PRECIPITATION_LABELS = Object.freeze({ clear: "ясно", rain: "дощ", storm: "гроза" });
const FOG_LABELS = Object.freeze({ none: "немає", fog: "туман" });
const FORCE_BUTTONS = Object.freeze([
  Object.freeze({ label: "☀ Ясно", process: "precipitation", state: "clear" }),
  Object.freeze({ label: "🌧 Дощ", process: "precipitation", state: "rain" }),
  Object.freeze({ label: "⛈ Гроза", process: "precipitation", state: "storm" }),
  Object.freeze({ label: "🌫 Туман", process: "fog", state: "fog" }),
  Object.freeze({ label: "Без туману", process: "fog", state: "none" }),
]);

const percent = (value) => `${Math.round((Number(value) || 0) * 100)}%`;
const seconds = (value) => `${Math.round(Number(value) || 0)} с`;

export class WeatherDevSection {
  #ui;
  #weather;
  #config;
  #sky;
  #createSection;
  #renderConfigTree;
  #content = null;
  #intensity = 70;
  #fadeSec = 5;

  // weather: { getModel() → WeatherModel | null, locationId }; createSection(label, parent, path) and
  // renderConfigTree(value, parent, path) come from DevTools; config: () => the location's weather settings; sky: () =>
  // the location's sun and moon positions for the water's glints (MAP_DB.<id>.sky, spec 172 D2) or null.
  constructor({ ui, weather, config, sky = () => null, createSection, renderConfigTree }) {
    this.#ui = ui;
    this.#weather = weather;
    this.#config = config;
    this.#sky = sky;
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
    const weather = model.snapshot;
    this.#ui.createInfoRow("опади", `${PRECIPITATION_LABELS[weather.precipitation] ?? weather.precipitation} · ще ${
      seconds(weather.precipitationLeftSec)}`, content);
    this.#ui.createInfoRow("дощ", `${percent(weather.rain)} → ${percent(weather.rainTarget)}`, content);
    this.#ui.createInfoRow("гроза", `${percent(weather.storm)} → ${percent(weather.stormTarget)}`, content);
    this.#ui.createInfoRow("туман", `${FOG_LABELS[weather.fogState] ?? weather.fogState} · ${percent(weather.fog)} → ${
      percent(weather.fogTarget)} · ще ${seconds(weather.fogLeftSec)}`, content);
    this.#ui.createInfoRow("хмарність", percent(weather.cloud), content);
    this.#ui.createInfoRow("блискавки", `${weather.strikeSerial} · остання: варіант ${weather.strikeVariant + 1}, відстань ${
      percent(weather.strikeDistance)}`, content);
    this.#ui.createButtonRow("↻ Оновити", content, () => this.#fill());

    const force = this.#createSection("Примусово", content, ["WEATHER", "force"]);
    this.#ui.createRangeRow("сила, %", this.#intensity, force, (value) => { this.#intensity = Number(value) || 0; });
    this.#ui.createInputRow("перехід, с", this.#fadeSec, force, "number", (value) => {
      this.#fadeSec = Math.max(0, Number(value) || 0);
    });
    for (const { label, process, state } of FORCE_BUTTONS) {
      this.#ui.createButtonRow(label, force, () => {
        model.force(process, state, { intensity: this.#intensity / 100, fadeSec: this.#fadeSec });
        this.#fill();
      });
    }
    this.#ui.createButtonRow("⚡ Удар блискавки зараз", force, () => {
      model.strike();
      this.#fill();
    });
    this.#ui.createSwitcherRow("заморозити погоду", weather.frozen === true, force, (frozen) => {
      model.setFrozen(frozen);
      this.#fill();
    }, ["WEATHER", "frozen"]);

    const settings = this.#config();
    if (settings) {
      this.#renderConfigTree(settings, this.#createSection("Параметри локації", content, ["WEATHER", "config"]),
        ["CONFIG", "locations", "map", this.#weather.locationId, "weather"]);
    }
    const sky = this.#sky();
    if (sky) {
      this.#renderConfigTree(sky, this.#createSection("Світила (відблиски на воді)", content, ["WEATHER", "sky"]),
        ["CONFIG", "locations", "map", this.#weather.locationId, "sky"]);
    }
  }
}
