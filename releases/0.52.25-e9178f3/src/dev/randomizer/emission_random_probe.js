// DevTools «РАНДОМАЙЗЕР» (TK-321.1): the emission's start, run through the game's own EmissionModel and SeededRng many
// times in a row on the location's current settings (DevTools edits included), with a short report. The model and the
// rng come from the game's code, so the report shows how the game's random behaves, not a copy of its formula.
const STEP_SEC = 1;
const BUCKET_MIN = 10;
const BUCKETS = 12;
const TARGET_MIN = Object.freeze([30, 60]);

const minutes = (value) => `${(value / 60).toFixed(1)} хв`;
const percent = (share) => `${(share * 100).toFixed(1)}%`;
const quantile = (sorted, share) => sorted[Math.min(sorted.length - 1, Math.floor(share * (sorted.length - 1)))];

export class EmissionRandomProbe {
  #createModel;
  #createRng;
  #getSettings;

  // createModel({ rng, getSettings }) → EmissionModel; createRng(seed) → SeededRng; getSettings() → the location's live
  // MAP_DB.<id>.weather (copied once per run, so an edit during the run changes nothing).
  constructor({ createModel, createRng, getSettings }) {
    if (typeof createModel !== "function" || typeof createRng !== "function" || typeof getSettings !== "function") {
      throw new TypeError("EmissionRandomProbe requires createModel, createRng and getSettings");
    }
    this.#createModel = createModel;
    this.#createRng = createRng;
    this.#getSettings = getSettings;
  }

  get id() { return "emission"; }
  get label() { return "Викид: початок"; }

  // count: emissions to collect; seed: a number for a repeatable run (the report names the seed it used).
  run({ count, seed }) {
    const settings = JSON.parse(JSON.stringify(this.#getSettings() ?? {}));
    const model = this.#createModel({ rng: this.#createRng(seed), getSettings: () => settings });
    const starts = [];
    const lengths = [];
    const limitSec = count * 24 * 3600;
    let time = 0;
    let serial = model.snapshot.serial;
    let startedAt = null;
    model.update(0);
    while (starts.length < count && time < limitSec) {
      model.update(STEP_SEC * 1000);
      time += STEP_SEC;
      const snapshot = model.snapshot;
      if (snapshot.serial !== serial) {
        serial = snapshot.serial;
        starts.push(time);
        startedAt = time;
      } else if (startedAt !== null && snapshot.phase === "idle") {
        lengths.push(time - startedAt);
        startedAt = null;
      }
    }
    return this.#report({ seed, settings, starts, lengths, time, count });
  }

  #report({ seed, settings, starts, lengths, time, count }) {
    const emission = settings.emission ?? {};
    const rows = [
      ["сід", String(seed)],
      ["налаштування", `перевірка ${emission.checkIntervalSec ?? 60} с · шанс ${emission.chancePerCheck ?? 0}` +
        ` + ${emission.chanceGrowthPerCheck ?? 0} за невдалу · пауза ${minutes(emission.cooldownSec ?? 0)}` +
        `${emission.enabled === false ? " · вимкнено" : ""}`],
      ["змодельовано", `${starts.length} з ${count} викидів за ${(time / 3600).toFixed(1)} год гри`],
    ];
    if (!starts.length) {
      rows.push(["результат", "жодного викиду"]);
      return { rows, histogram: [] };
    }
    rows.push(["перший після старту", minutes(starts[0])]);
    rows.push(["викидів за годину", (starts.length / (time / 3600)).toFixed(2)]);
    const intervals = [];
    for (let index = 1; index < starts.length; index += 1) intervals.push(starts[index] - starts[index - 1]);
    if (lengths.length) rows.push(["тривалість викиду", minutes(lengths.reduce((a, b) => a + b, 0) / lengths.length)]);
    if (!intervals.length) return { rows, histogram: [] };
    const sorted = [...intervals].sort((a, b) => a - b);
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const within = intervals.filter((value) => value >= TARGET_MIN[0] * 60 && value <= TARGET_MIN[1] * 60).length;
    rows.push(["між початками: середнє", minutes(mean)]);
    rows.push(["медіана", minutes(quantile(sorted, 0.5))]);
    rows.push(["10% … 90%", `${minutes(quantile(sorted, 0.1))} … ${minutes(quantile(sorted, 0.9))}`]);
    rows.push(["мін … макс", `${minutes(sorted[0])} … ${minutes(sorted[sorted.length - 1])}`]);
    rows.push([`у проміжку ${TARGET_MIN[0]}–${TARGET_MIN[1]} хв`, percent(within / intervals.length)]);
    const histogram = [];
    for (let bucket = 0; bucket <= BUCKETS; bucket += 1) {
      const from = bucket * BUCKET_MIN * 60;
      const to = bucket === BUCKETS ? Infinity : from + BUCKET_MIN * 60;
      const hits = intervals.filter((value) => value >= from && value < to).length;
      const label = bucket === BUCKETS ? `${BUCKETS * BUCKET_MIN}+ хв` : `${bucket * BUCKET_MIN}–${(bucket + 1) * BUCKET_MIN} хв`;
      histogram.push([label, hits / intervals.length]);
    }
    return { rows, histogram };
  }
}
