import { percent } from "./random_probe_report.js";

// DevTools «РАНДОМАЙЗЕР» (spec 182 stage B, TK-351): the starfall's nights run through the game's own StarfallNight and
// SeededRng many nights in a row on the location's current settings (DevTools edits included), a game minute a step:
// how many nights fall, their periods and quiet stretches, the strength over the night's hours (the histogram) and the
// bolides. Game time only: the starfall reads the game hour, not the frame's seconds.
const STEP_HOURS = 1 / 60;

export class StarfallRandomProbe {
  #createModel;
  #createRng;
  #getSettings;

  // createModel({ rng, getSettings }) → StarfallNight; createRng(seed) → SeededRng; getSettings() → MAP_DB.<id>.weather.
  constructor({ createModel, createRng, getSettings }) {
    for (const [name, value] of Object.entries({ createModel, createRng, getSettings })) {
      if (typeof value !== "function") throw new TypeError(`StarfallRandomProbe requires ${name}`);
    }
    this.#createModel = createModel;
    this.#createRng = createRng;
    this.#getSettings = getSettings;
  }

  get id() { return "starfall"; }
  get label() { return "Зорепад"; }

  // count: nights to run; seed: a number for a repeatable run.
  run({ count, seed }) {
    const settings = JSON.parse(JSON.stringify(this.#getSettings()?.starfall ?? {}));
    const model = this.#createModel({ rng: this.#createRng(seed), getSettings: () => settings });
    const snapshot = model.snapshot;
    const clock = { hour: 12 };
    const windowHours = Math.max(1, Math.round(((Number(settings.toHour ?? 5) - Number(settings.fromHour ?? 21)) % 24 + 24) % 24 || 24));
    const sums = new Array(windowHours).fill(0);
    let nights = 0, active = 0, periods = 0, quiet = 0, bolides = 0, lastSerial = snapshot.nightSerial;
    let strengthSum = 0, strengthSteps = 0;
    for (let step = 0; nights < count && step < count * 24 * 60 + 24 * 60; step += 1) {
      clock.hour = (12 + step * STEP_HOURS) % 24;
      const bolideSerial = snapshot.bolideSerial;
      model.update(clock, false);
      if (snapshot.nightSerial !== lastSerial) {
        lastSerial = snapshot.nightSerial;
        nights += 1;
        if (snapshot.active) {
          active += 1;
          periods += snapshot.periodCount;
          quiet += snapshot.periodLevels.filter((level) => level === 0).length;
        }
      }
      if (snapshot.bolideSerial !== bolideSerial) bolides += 1;
      if (snapshot.inWindow && snapshot.active) {
        sums[Math.min(windowHours - 1, Math.floor(snapshot.positionHours))] += snapshot.strength;
        strengthSum += snapshot.strength;
        strengthSteps += 1;
      }
    }
    const rows = [
      ["сід", String(seed)],
      ["налаштування", `${settings.fromHour ?? 21}:00–${settings.toHour ?? 5}:00 · шанс ночі ${settings.nightChance ?? 0}` +
        ` · періодів ${(settings.periods ?? []).join("–")} · тиша ${settings.quietChance ?? 0} · болід ${settings.bolideChance ?? 0}` +
        `${settings.enabled === false ? " · вимкнено" : ""}`],
      ["змодельовано", `${nights} ночей (одна перевірка на ніч, о ${settings.fromHour ?? 21}:00)`],
    ];
    if (!active) {
      rows.push(["результат", "жодної зорепадної ночі"]);
      return { rows, histogram: [] };
    }
    rows.push(["зорепадних ночей", `${active} (${percent(active / Math.max(1, nights))})`]);
    rows.push(["періодів за ніч: середнє", (periods / active).toFixed(1)]);
    rows.push(["тихих періодів (сила 0)", percent(quiet / Math.max(1, periods))]);
    rows.push(["сила зорепадної ночі: середня", percent(strengthSum / Math.max(1, strengthSteps))]);
    rows.push(["болідів", `${bolides} (${percent(bolides / active)} зорепадних ночей)`]);
    // The mean strength by the night's hour over the starfall nights.
    const stepsPerHour = Math.round(1 / STEP_HOURS);
    const histogram = sums.map((sum, index) => [`${(Number(settings.fromHour ?? 21) + index) % 24}:00`,
      sum / (active * stepsPerHour)]);
    return { rows, histogram };
  }
}
