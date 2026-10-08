import { HookPowerPolicy } from "../items/hook/hook_power_policy.js";

export class Hook {
  #hookPowerGrade;
  #weight;
  #qualityGrade;
  #powerPolicy;
  #maxLoadKg;
  #durability;
  #durabilityMaxLoadLossPerPercent;

  constructor(stats = {}, { powerPolicy = new HookPowerPolicy() } = {}) {
    this.#hookPowerGrade = Hook.#numberOrDefault(stats.hookPowerGrade, 1);
    this.#weight = Hook.#numberOrDefault(stats.weight, 1);
    this.#qualityGrade = Hook.#numberOrDefault(stats.quality, 1);
    this.#powerPolicy = powerPolicy;
    this.#maxLoadKg = Hook.#numberOrDefault(stats.maxLoadKg, Infinity);
    this.#durability = Hook.#numberOrDefault(stats.durability, 100);
    this.#durabilityMaxLoadLossPerPercent =
      Hook.#numberOrDefault(stats.durabilityMaxLoadLossPerPercent, 0.001);
  }

  getPower() {
    return this.#powerPolicy.resolve({
      hookPowerGrade: this.#hookPowerGrade,
      weight: this.#weight,
      qualityGrade: this.#qualityGrade,
    });
  }

  getMaxLoadKg() {
    return this.#maxLoadKg;
  }

  getEffectiveMaxLoadKg() {
    if (!Number.isFinite(this.#maxLoadKg)) return Infinity;
    const loss =
      (100 - Math.max(0, Math.min(100, this.#durability))) *
      this.#durabilityMaxLoadLossPerPercent;
    return this.#maxLoadKg * Math.max(0.1, 1 - loss);
  }

  static #numberOrDefault(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
}
