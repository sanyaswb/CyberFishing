import { HookPowerPolicy } from "../items/hook/hook_power_policy.js";
import { finiteOr } from "../../../engine/math/number_normalization.js";

export class Hook {
  #hookPowerGrade;
  #weight;
  #qualityGrade;
  #powerPolicy;
  #maxLoadKg;
  #durability;
  #durabilityMaxLoadLossPerPercent;

  constructor(stats = {}, { powerPolicy = new HookPowerPolicy() } = {}) {
    this.#hookPowerGrade = finiteOr(stats.hookPowerGrade, 1);
    this.#weight = finiteOr(stats.weight, 1);
    this.#qualityGrade = finiteOr(stats.quality, 1);
    this.#powerPolicy = powerPolicy;
    this.#maxLoadKg = finiteOr(stats.maxLoadKg, Infinity);
    this.#durability = finiteOr(stats.durability, 100);
    this.#durabilityMaxLoadLossPerPercent =
      finiteOr(stats.durabilityMaxLoadLossPerPercent, 0.001);
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
}
