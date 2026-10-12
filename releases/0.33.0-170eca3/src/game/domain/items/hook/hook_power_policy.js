import { HookQualityModifier } from "../quality/hook_quality_modifier.js";

export class HookPowerPolicy {
  #qualityModifier;

  constructor({ qualityModifier = new HookQualityModifier() } = {}) {
    if (!qualityModifier?.getPowerBonus) {
      throw new TypeError("HookPowerPolicy requires HookQualityModifier");
    }
    this.#qualityModifier = qualityModifier;
  }

  resolve({ hookPowerGrade = 1, weight = 1, qualityGrade = 1 } = {}) {
    const powerGrade = Math.max(0, Number(hookPowerGrade) || 0);
    const hookWeight = Math.max(0, Number(weight) || 0);
    return powerGrade * hookWeight * 0.01 +
      this.#qualityModifier.getPowerBonus(qualityGrade);
  }
}
