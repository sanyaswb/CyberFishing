import { duration, intervalReport, percent } from "./random_probe_report.js";

// DevTools «РАНДОМАЙЗЕР» (spec 180 stage F, TK-335): one weather event — rain, storm or fog — run through the game's own
// WeatherModel and SeededRng many times in a row on the location's current settings and the general ones (DevTools
// edits included), the way the game runs it: the storm raises the rain's chance and strength; fog lives in game time
// (CONFIG.debug.timeScale), more likely in its hour windows and after rains (D17). The location's initial weather (D14)
// is left out, so the report shows the random course only.
// 15 s: a check comes every minute or more and an event lasts minutes, so the shares and spreads stay the same while
// a thousand storms (~3300 hours of play) take a second or two in the browser.
const STEP_SEC = 15;
// Fog runs in game time: a step of at most 5 game minutes, so its checks (every 10 game minutes) and hour windows hold.
const FOG_STEP_GAME_SEC = 300;
const LABELS = Object.freeze({ rain: "Дощ", storm: "Шторм", fog: "Туман" });

export class WeatherEventRandomProbe {
  #kind;
  #createModel;
  #createRng;
  #getSettings;
  #getGeneral;
  #getTime;

  // kind: "rain" | "storm" | "fog"; createModel({ rng, getSettings, getGeneralSettings }) → WeatherModel;
  // createRng(seed) → SeededRng; getSettings() → MAP_DB.<id>.weather; getGeneral() → CONFIG.weather;
  // getTime() → { timeScale, initialHours } (the game's clock).
  constructor({ kind, createModel, createRng, getSettings, getGeneral, getTime }) {
    if (!LABELS[kind]) throw new TypeError(`WeatherEventRandomProbe: unknown kind ${kind}`);
    for (const [name, value] of Object.entries({ createModel, createRng, getSettings, getGeneral, getTime })) {
      if (typeof value !== "function") throw new TypeError(`WeatherEventRandomProbe requires ${name}`);
    }
    this.#kind = kind;
    this.#createModel = createModel;
    this.#createRng = createRng;
    this.#getSettings = getSettings;
    this.#getGeneral = getGeneral;
    this.#getTime = getTime;
  }

  get id() { return `weather-${this.#kind}`; }
  get label() { return LABELS[this.#kind]; }

  // count: events to collect; seed: a number for a repeatable run.
  run({ count, seed }) {
    const settings = JSON.parse(JSON.stringify(this.#getSettings() ?? {}));
    delete settings.initial;
    const general = JSON.parse(JSON.stringify(this.#getGeneral() ?? {}));
    const time = this.#getTime();
    const model = this.#createModel({ rng: this.#createRng(seed), getSettings: () => settings, getGeneralSettings: () => general });
    const kind = this.#kind;
    const event = model.snapshot.events[kind];
    const starts = [], lengths = [], peaks = [];
    const limitSec = count * 24 * 3600;
    const timeScale = Math.max(0, Number(time.timeScale) || 1);
    const hoursPerSec = timeScale / 3600;
    const step = kind === "fog" ? Math.min(STEP_SEC, FOG_STEP_GAME_SEC / timeScale) : STEP_SEC;
    const clock = { hour: 0, timeScale };
    let serial = event.serial, startedAt = null, elapsed = 0, activeSec = 0;
    let stormSec = 0, rainInStormSec = 0, rainOutsideSec = 0, withLightning = 0;
    let fogSerial = event.serial, lastBoost = 1;
    const fogStartHours = [], fogStartBoosts = [];
    while (starts.length < count && elapsed < limitSec) {
      clock.hour = ((Number(time.initialHours) || 0) + elapsed * hoursPerSec) % 24;
      model.update(step * 1000, clock);
      elapsed += step;
      const snapshot = model.snapshot;
      if (event.serial !== serial) {
        serial = event.serial;
        starts.push(elapsed);
        peaks.push(event.peakStrength);
        if (startedAt !== null) lengths.push(elapsed - startedAt);
        startedAt = elapsed;
        if (kind === "storm" && snapshot.lightning.has) withLightning += 1;
      } else if (startedAt !== null && !event.active) {
        lengths.push(elapsed - startedAt);
        startedAt = null;
      }
      if (event.active) activeSec += step;
      const storming = snapshot.events.storm.active;
      if (storming) stormSec += step;
      if (snapshot.events.rain.active) {
        if (storming) rainInStormSec += step;
        else rainOutsideSec += step;
      }
      if (kind === "fog" && event.serial !== fogSerial) {
        fogSerial = event.serial;
        fogStartHours.push(clock.hour);
        fogStartBoosts.push(lastBoost);
      }
      lastBoost = snapshot.fogRainBoost;
    }
    const block = settings[kind] ?? {};
    const rows = [
      ["сід", String(seed)],
      ["налаштування", `перевірка ${block.checkIntervalSec ?? 60} с · шанс ${block.chancePerCheck ?? 0}` +
        ` + ${block.chanceGrowthPerCheck ?? 0} за невдалу · пауза ${duration(block.cooldownSec ?? 0)}` +
        `${block.enabled === false ? " · вимкнено" : ""}`],
      ["змодельовано", `${starts.length} з ${count} за ${(elapsed / 3600).toFixed(1)} год гри (початкова погода не діє)`],
    ];
    if (kind === "fog") {
      const windows = (block.hours ?? []).map((window) => `${window.fromHour}–${window.toHour} ×${window.chanceMult}`).join(", ");
      rows.push(["вікна годин", `${windows || "немає"} · після дощу +${block.rainBoost?.perRain ?? 0} (до ×${block.rainBoost?.max ?? 1})`]);
      rows.push(["час", `ігровий, темп ×${timeScale} (перевірка, тривалість і пауза — ігрові секунди)`]);
    }
    if (!starts.length) {
      rows.push(["результат", "жодної події"]);
      return { rows, histogram: [] };
    }
    rows.push(["частка часу", percent(activeSec / elapsed)]);
    rows.push(["подій за годину", (starts.length / (elapsed / 3600)).toFixed(2)]);
    rows.push(["перша після старту", duration(starts[0])]);
    if (lengths.length) rows.push(["тривалість: середня", duration(lengths.reduce((a, b) => a + b, 0) / lengths.length)]);
    rows.push(["сила піку: середня", percent(peaks.reduce((a, b) => a + b, 0) / peaks.length)]);
    if (kind === "rain") {
      const clearSec = elapsed - stormSec;
      rows.push(["дощить у шторм", stormSec > 0 ? percent(rainInStormSec / stormSec) : "шторму не було"]);
      rows.push(["дощить без шторму", clearSec > 0 ? percent(rainOutsideSec / clearSec) : "—"]);
    }
    if (kind === "storm") rows.push(["з блискавками", percent(withLightning / starts.length)]);
    if (kind === "fog") {
      const inWindow = fogStartHours.filter((hour) => (block.hours ?? []).some((window) =>
        (window.fromHour <= window.toHour ? hour >= window.fromHour && hour < window.toHour : hour >= window.fromHour || hour < window.toHour))).length;
      rows.push(["почався у вікні годин", percent(inWindow / fogStartHours.length)]);
      rows.push(["почався після дощу", percent(fogStartBoosts.filter((boost) => boost > 1).length / fogStartBoosts.length)]);
      rows.push(["тривалість в ігрових годинах", `${(lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length) * hoursPerSec).toFixed(1)} год`]);
    }
    const intervals = [];
    for (let index = 1; index < starts.length; index += 1) intervals.push(starts[index] - starts[index - 1]);
    const spread = intervalReport(intervals);
    return { rows: [...rows, ...spread.rows], histogram: spread.histogram };
  }
}
