// Spec 180 D16 (TK-326): an element's look at its current strength. A look's settings hold plain values and a `strength`
// block of [at 0, at 100] for the values that change with the element's strength (the rain's with the rain, the ash's
// with the emission). The end at 100 may be overridden per location (MAP_DB.<id>.weather.look.<kind>.<key>). resolve()
// writes one reused object per kind: every plain value as it is, every strength value mixed by the strength (integer
// keys rounded), and <key>Cap — the largest the value can get, so the renderers size their pools once, not per frame.
import { clampUnit, finiteOr } from "../../../engine/math/number_normalization.js";
const INTEGER_KEYS = Object.freeze(new Set(["maxDrops", "maxParticles", "maxRings"]));

export class WeatherLookResolver {
  #getLooks;
  #getOverrides;
  #resolved = new Map();

  // getLooks: () => { rain, ash } (the general settings); getOverrides: () => the location's look overrides or null.
  constructor({ getLooks, getOverrides }) {
    if (typeof getLooks !== "function") throw new TypeError("WeatherLookResolver requires getLooks");
    if (typeof getOverrides !== "function") throw new TypeError("WeatherLookResolver requires getOverrides");
    this.#getLooks = getLooks;
    this.#getOverrides = getOverrides;
  }

  // The end at 100 of one strength value: the location's override or the general one.
  endAt100(kind, key) {
    const range = this.#getLooks()?.[kind]?.strength?.[key];
    const override = this.#getOverrides()?.[kind]?.[key];
    return Number.isFinite(Number(override)) ? Number(override) : finiteOr(Array.isArray(range) ? range[1] : NaN, NaN);
  }

  // kind: "rain" | "ash"; strength 0…1. Returns the reused resolved settings (null without a look).
  resolve(kind, strength) {
    const look = this.#getLooks()?.[kind];
    if (!look) return null;
    let target = this.#resolved.get(kind);
    if (!target) {
      target = {};
      this.#resolved.set(kind, target);
    }
    for (const key in look) {
      if (key !== "strength") target[key] = look[key];
    }
    const ranges = look.strength;
    const level = clampUnit(finiteOr(strength, 0));
    if (ranges) {
      const overrides = this.#getOverrides()?.[kind] ?? null;
      for (const key in ranges) {
        const range = ranges[key];
        if (!Array.isArray(range)) continue;
        const atZero = finiteOr(range[0], 0);
        const override = overrides?.[key];
        const atFull = Number.isFinite(Number(override)) ? Number(override) : finiteOr(range[1], atZero);
        const value = atZero + (atFull - atZero) * level;
        target[key] = INTEGER_KEYS.has(key) ? Math.round(value) : value;
        target[`${key}Cap`] = Math.max(atZero, atFull);
      }
    }
    return target;
  }
}
