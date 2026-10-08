import { Equipment } from "./equipment.js";

export class Rod extends Equipment {
  #compensation;
  #variant;
  #maxDistance;
  #hasReel;
  #lengthMeters;
  #castPowerCoefficient;
  #maxLoadKg;
  #holdTensionRatio;
  #durability;
  #durabilityMaxLoadLossPerPercent;

  constructor(
    equipmentPowerLevel,
    power,
    compensation = 0,
    variant = "float_match",
    maxDistance = Infinity,
    hasReel = true,
    options = {},
  ) {
    super(equipmentPowerLevel, power);
    this.#compensation = compensation;
    this.#variant = variant;
    this.#maxDistance = maxDistance;
    this.#hasReel = hasReel;
    this.#lengthMeters = Rod.#numberOrDefault(options.lengthMeters, 2.0);
    this.#castPowerCoefficient = Rod.#nullableNumber(
      options.castPowerCoefficient,
    );
    this.#maxLoadKg = Rod.#numberOrDefault(options.maxLoadKg, 8.0);
    this.#holdTensionRatio = Rod.#numberOrDefault(options.holdTensionRatio, 1.0);
    this.#durability = Rod.#numberOrDefault(options.durability, 100);
    this.#durabilityMaxLoadLossPerPercent =
      Rod.#numberOrDefault(options.durabilityMaxLoadLossPerPercent, 0.001);
  }

  getMaxDistance() {
    return this.#maxDistance;
  }

  hasReel() {
    return this.#hasReel;
  }

  getLengthMeters() {
    return this.#lengthMeters;
  }

  getCastPowerCoefficient() {
    return this.#castPowerCoefficient;
  }

  getMaxLoadKg() {
    return this.#maxLoadKg;
  }

  getEffectiveMaxLoadKg() {
    const loss =
      (100 - Math.max(0, Math.min(100, this.#durability))) *
      this.#durabilityMaxLoadLossPerPercent;
    return this.#maxLoadKg * Math.max(0.1, 1 - loss);
  }

  getHoldTensionRatio() {
    return Math.max(0, Math.min(1, this.#holdTensionRatio));
  }

  static #numberOrDefault(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  static #nullableNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
