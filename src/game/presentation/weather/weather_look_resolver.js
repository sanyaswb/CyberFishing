// Spec 180 D16 (TK-326): an element's look at its current strength. A look's settings hold plain values and a `strength`
// block of [від, до] for the values that change with the element's strength (the rain's with the rain, the ash's with
// the emission). Spec 187 D8, D15: a location may override either end (MAP_DB.<id>.weather.look.<kind>.<key>:
// [від, до], a null end — the general one; a plain number — the old override of «до»); «від» is the value at the least
// visible strength (VISIBLE_STRENGTH), «до» at full strength, mixed linearly between (below — «від»; at 0 the element is
// off). resolve() writes one reused object per kind: every plain value as it is, every strength value mixed by the
// strength (integer keys rounded), and <key>Cap — the largest the value can get, so the renderers size their pools once,
// not per frame.
import { finiteOr } from "../../../engine/math/number_normalization.js";
import { VISIBLE_STRENGTH, strengthValue } from "../../../engine/math/strength_value.js";
const INTEGER_KEYS = Object.freeze(new Set(["maxDrops", "maxParticles", "maxRings"]));
// Spec 187 D15: the DEV section reads the same rule.
export { VISIBLE_STRENGTH, strengthValue };

// A location's override of one strength value → { from, to } (null: that end not overridden).
export function lookOverrideEnds(override) {
  if (Array.isArray(override)) {
    return { from: Number.isFinite(Number(override[0])) && override[0] !== null ? Number(override[0]) : null,
      to: Number.isFinite(Number(override[1])) && override[1] !== null ? Number(override[1]) : null };
  }
  return { from: null, to: override !== null && override !== undefined && Number.isFinite(Number(override)) ? Number(override) : null };
}

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
    return this.ends(kind, key).to;
  }

  // Spec 187: both ends of one strength value — the location's overrides or the general ones ({ from, to }, NaN: none).
  ends(kind, key) {
    const range = this.#getLooks()?.[kind]?.strength?.[key];
    const own = lookOverrideEnds(this.#getOverrides()?.[kind]?.[key]);
    const from = own.from ?? finiteOr(Array.isArray(range) ? range[0] : NaN, NaN);
    return { from, to: own.to ?? finiteOr(Array.isArray(range) ? range[1] : NaN, from) };
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
    if (ranges) {
      const overrides = this.#getOverrides()?.[kind] ?? null;
      for (const key in ranges) {
        const range = ranges[key];
        if (!Array.isArray(range)) continue;
        const own = overrides ? lookOverrideEnds(overrides[key]) : NO_OVERRIDE;
        const atFrom = own.from ?? finiteOr(range[0], 0);
        const atFull = own.to ?? finiteOr(range[1], atFrom);
        const value = strengthValue(atFrom, atFull, strength);
        target[key] = INTEGER_KEYS.has(key) ? Math.round(value) : value;
        target[`${key}Cap`] = Math.max(atFrom, atFull);
      }
    }
    return target;
  }
}

const NO_OVERRIDE = Object.freeze({ from: null, to: null });
