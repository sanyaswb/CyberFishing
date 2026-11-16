import { duration, intervalReport } from "./random_probe_report.js";

// DevTools «РАНДОМАЙЗЕР» (spec 180 stage F, TK-335): the wind's gusts, run through the game's own WeatherModel,
// WindModel and SeededRng on the location's current settings and the general ones (DevTools edits included). The weather
// runs beside the wind as in the game, so rain and storms make gusts more frequent; the report counts gusts per hour in
// clear weather, in rain and in a storm. The location's initial weather (D14) is left out.
const STEP_SEC = 0.25;

export class WindGustRandomProbe {
  #createWeather;
  #createWind;
  #createRng;
  #getSettings;
  #getGeneral;

  // createWeather({ rng, getSettings, getGeneralSettings }) → WeatherModel; createWind({ rng, getSettings,
  // getGeneralSettings }) → WindModel; createRng(seed) → SeededRng; getSettings() → MAP_DB.<id>.weather;
  // getGeneral() → CONFIG.weather.
  constructor({ createWeather, createWind, createRng, getSettings, getGeneral }) {
    for (const [name, value] of Object.entries({ createWeather, createWind, createRng, getSettings, getGeneral })) {
      if (typeof value !== "function") throw new TypeError(`WindGustRandomProbe requires ${name}`);
    }
    this.#createWeather = createWeather;
    this.#createWind = createWind;
    this.#createRng = createRng;
    this.#getSettings = getSettings;
    this.#getGeneral = getGeneral;
  }

  get id() { return "wind-gust"; }
  get label() { return "Пориви"; }

  // count: gusts to collect; seed: a number for a repeatable run (the weather's and the wind's streams derive from it).
  run({ count, seed }) {
    const settings = JSON.parse(JSON.stringify(this.#getSettings() ?? {}));
    delete settings.initial;
    const general = JSON.parse(JSON.stringify(this.#getGeneral() ?? {}));
    const weather = this.#createWeather({ rng: this.#createRng(`${seed}:weather`), getSettings: () => settings,
      getGeneralSettings: () => general });
    const wind = this.#createWind({ rng: this.#createRng(`${seed}:wind`), getSettings: () => settings.wind ?? null,
      getGeneralSettings: () => general });
    const starts = [], lengths = [];
    const time = { clear: 0, rain: 0, storm: 0 };
    const gusts = { clear: 0, rain: 0, storm: 0 };
    const limitSec = count * 3600;
    const stepMs = STEP_SEC * 1000;
    let elapsed = 0, gusting = false, startedAt = 0;
    while (starts.length < count && elapsed < limitSec) {
      weather.update(stepMs, "day");
      const snapshot = weather.snapshot;
      wind.update(stepMs, snapshot);
      elapsed += STEP_SEC;
      const kind = snapshot.events.storm.active ? "storm" : snapshot.events.rain.active ? "rain" : "clear";
      time[kind] += STEP_SEC;
      const now = wind.snapshot.isGusting;
      if (now && !gusting) {
        starts.push(elapsed);
        gusts[kind] += 1;
        startedAt = elapsed;
      } else if (!now && gusting) {
        lengths.push(elapsed - startedAt);
      }
      gusting = now;
    }
    const perHour = (part) => (time[part] > 0 ? (gusts[part] / (time[part] / 3600)).toFixed(1) : "—");
    const rows = [
      ["сід", String(seed)],
      ["налаштування", `шанс ${settings.wind?.gust?.chancePerSec ?? 0.14} за секунду (× сила вітру, дощ ×` +
        `${general.wind?.rain?.gustChanceMult ?? 1.5}, шторм ×${general.storm?.gustChanceMult ?? 2.5})`],
      ["змодельовано", `${starts.length} з ${count} поривів за ${(elapsed / 3600).toFixed(1)} год гри (початкова погода не діє)`],
    ];
    if (!starts.length) {
      rows.push(["результат", "жодного пориву"]);
      return { rows, histogram: [] };
    }
    rows.push(["поривів за годину", (starts.length / (elapsed / 3600)).toFixed(1)]);
    rows.push(["у ясну погоду", `${perHour("clear")} за год`]);
    rows.push(["у дощ", `${perHour("rain")} за год`]);
    rows.push(["у шторм", `${perHour("storm")} за год`]);
    if (lengths.length) rows.push(["тривалість пориву: середня", duration(lengths.reduce((a, b) => a + b, 0) / lengths.length)]);
    const intervals = [];
    for (let index = 1; index < starts.length; index += 1) intervals.push(starts[index] - starts[index - 1]);
    const spread = intervalReport(intervals);
    return { rows: [...rows, ...spread.rows], histogram: spread.histogram };
  }
}
