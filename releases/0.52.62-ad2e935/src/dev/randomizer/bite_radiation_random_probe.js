import { percent } from "./random_probe_report.js";

// DevTools «РАНДОМАЙЗЕР» (spec 179 stage G, TK-369; owner: «рандомайзером перевіряти як і шо клює при яких умовах»):
// what a bite of each species gives at radiation 0, 50 % and 100 % — through the game's own FishWeightSampler,
// FishAnomalyVariantResolver, FishRadiationBiteModifier and SeededRng on the current fish settings (DevTools edits
// included). Each sample takes a hook depth evenly across the species' depths, then the weight and the anomaly as a bite
// does. Rows: the bite-chance multiplier, unique share, mean weight and the top level's share; the histogram — the
// species' levels at full radiation.
const RADIATIONS = Object.freeze([0, 0.5, 1]);

function levelOf(fish, weightKg) {
  const ranges = fish.weightConfig?.levelWeightRanges ?? [];
  for (const range of ranges) if (weightKg <= range.max) return range.level;
  return ranges.length ? ranges[ranges.length - 1].level : 1;
}

export class BiteRadiationRandomProbe {
  #getFishes;
  #getLocationId;
  #createRng;
  #weights;
  #anomalies;
  #radiation;

  // getFishes() → FISH_DB; getLocationId() → the location the game runs; createRng(seed) → SeededRng; weightSampler,
  // anomalyResolver, radiation: the bite's own domain classes.
  constructor({ getFishes, getLocationId, createRng, weightSampler, anomalyResolver, radiation }) {
    for (const [name, value] of Object.entries({ getFishes, getLocationId, createRng })) {
      if (typeof value !== "function") throw new TypeError(`BiteRadiationRandomProbe requires ${name}`);
    }
    if (typeof weightSampler?.sample !== "function" || typeof anomalyResolver?.resolve !== "function" ||
      typeof radiation?.chanceMultiplier !== "function") throw new TypeError("BiteRadiationRandomProbe requires the bite's domain");
    this.#getFishes = getFishes;
    this.#getLocationId = getLocationId;
    this.#createRng = createRng;
    this.#weights = weightSampler;
    this.#anomalies = anomalyResolver;
    this.#radiation = radiation;
  }

  get id() { return "bite-radiation"; }
  get label() { return "Кльов: радіація"; }

  // count: bites per species and radiation; seed: a number for a repeatable run.
  run({ count, seed }) {
    const fishes = this.#getFishes() ?? [];
    const locationId = this.#getLocationId();
    const rows = [["сід", String(seed)], ["змодельовано", `${count} кльовів на вид для радіації 0 / 50 / 100 %`]];
    const histogram = [];
    for (const fish of fishes) {
      const maxLevel = fish.weightConfig?.maxLevel ?? 1;
      let peakLevels = null;
      for (const radiation of RADIATIONS) {
        const rng = this.#createRng(seed);
        const levels = new Array(maxLevel).fill(0);
        let unique = 0, weightSum = 0;
        const dc = fish.depthConfig;
        for (let index = 0; index < count; index += 1) {
          const depth = dc.minDepth + (dc.maxDepth - dc.minDepth) * rng.next();
          const weightKg = this.#weights.sample(fish, depth, rng.next(), radiation);
          const anomaly = this.#anomalies.resolve({ config: fish.anomalyVariant, locationId, roll: rng.next(),
            chanceScale: this.#radiation.anomalyChanceScale(fish, radiation) });
          if (anomaly.hasAnomaly) unique += 1;
          weightSum += weightKg;
          levels[Math.max(1, Math.min(maxLevel, levelOf(fish, weightKg))) - 1] += 1;
        }
        rows.push([`${fish.name} · радіація ${Math.round(radiation * 100)}%`,
          `кльов ×${this.#radiation.chanceMultiplier(fish, radiation).toFixed(2)} · унікальних ${percent(unique / count)}` +
          ` · вага ${(weightSum / count).toFixed(2)} кг · рівень ${maxLevel}: ${percent(levels[maxLevel - 1] / count)}`]);
        if (radiation === 1) peakLevels = levels;
      }
      for (let level = 1; level <= maxLevel; level += 1)
        histogram.push([`${fish.name} р.${level} (100%)`, peakLevels[level - 1] / count]);
    }
    if (!fishes.length) rows.push(["результат", "риби немає"]);
    return { rows, histogram };
  }
}
