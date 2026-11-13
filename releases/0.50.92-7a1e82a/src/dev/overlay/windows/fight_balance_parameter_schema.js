// Slider limits of the fight balance windows (spec 168 D6): min / max / step for the known keys of fish and rod
// parameters; other numbers get 0 .. max(2 x value, 1) with a step by their order of magnitude. The number field beside
// a slider takes values outside these limits too.
const KNOWN = Object.freeze({
  weight: { min: 0, max: 100, step: 1 },
  level: { min: 1, max: 12, step: 1 },
  basePower: { min: 0, max: 10, step: 0.05 },
  levelBasePower: { min: 0, max: 10, step: 0.05 },
  baseStamina: { min: 0, max: 10000, step: 10 },
  staminaWeightMultiplier: { min: 0, max: 5, step: 0.05 },
  staminaBossMultiplier: { min: 0, max: 5, step: 0.05 },
  staminaRatioFromEndurance: { min: 0, max: 1, step: 0.01 },
  minStaminaActivityMultiplier: { min: 0, max: 1, step: 0.01 },
  exhaustedSpeedRatio: { min: 0, max: 1, step: 0.01 },
  baseSpeed: { min: 0, max: 5, step: 0.05 },
  agility: { min: 0, max: 2, step: 0.01 },
  forceMultiplier: { min: 0, max: 5, step: 0.05 },
  speedMultiplier: { min: 0, max: 5, step: 0.05 },
  chance: { min: 0, max: 1, step: 0.01 },
  catchZoneMultiplier: { min: 0, max: 5, step: 0.1 },
  compensation: { min: 0, max: 2, step: 0.01 },
  maxLoadKg: { min: 0, max: 50, step: 0.1 },
  holdTensionRatio: { min: 0, max: 3, step: 0.05 },
  lengthMeters: { min: 0.5, max: 10, step: 0.1 },
  castPowerCoefficient: { min: 0, max: 2, step: 0.01 },
  accuracy: { min: 0, max: 100, step: 1 },
  quality: { min: 0, max: 10, step: 1 },
  durability: { min: 0, max: 100, step: 1 },
  equipmentPowerLevel: { min: 0, max: 10, step: 1 },
});
// Keys ending in these suffixes: durations and ranges of directions.
const SUFFIXES = Object.freeze([
  ["Ms", { min: 0, max: 10000, step: 50 }],
  ["Time", { min: 0, max: 10000, step: 50 }],
  ["Range", { min: -1, max: 1, step: 0.05 }],
]);

export class FightBalanceParameterSchema {
  // key: the parameter's own key (for an array element, the array's key); value: its current number.
  limitsFor(key, value) {
    const known = KNOWN[key] ?? SUFFIXES.find(([suffix]) => String(key).endsWith(suffix))?.[1];
    const number = Number(value);
    if (known) {
      const max = Number.isFinite(number) && number > known.max ? FightBalanceParameterSchema.#roundUp(number) : known.max;
      const min = Number.isFinite(number) && number < known.min ? number : known.min;
      return Object.freeze({ min, max, step: known.step });
    }
    const magnitude = Math.abs(Number.isFinite(number) ? number : 0);
    const max = Math.max(1, FightBalanceParameterSchema.#roundUp(magnitude * 2));
    const min = Number.isFinite(number) && number < 0 ? -max : 0;
    return Object.freeze({ min, max, step: FightBalanceParameterSchema.#stepFor(max) });
  }

  // The weight slider of a fish reaches twice its weight (at least 1 kg).
  weightLimits(weightKg) {
    const weight = Math.max(0, Number(weightKg) || 0);
    return Object.freeze({ min: 0, max: Math.max(1, FightBalanceParameterSchema.#roundUp(weight * 2)), step: 0.01 });
  }

  static #roundUp(value) {
    if (!(value > 0)) return 0;
    const order = 10 ** Math.floor(Math.log10(value));
    return Math.ceil(value / order) * order;
  }

  static #stepFor(max) {
    if (max <= 1) return 0.01;
    if (max <= 10) return 0.05;
    if (max <= 100) return 0.5;
    return 10 ** Math.max(0, Math.floor(Math.log10(max)) - 2);
  }
}
