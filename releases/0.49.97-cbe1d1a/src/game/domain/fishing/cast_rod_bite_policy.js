import { clampUnitFinite } from "../../../engine/math/number_normalization.js";

export class CastRodBitePolicy {
  resolveResponse({ rodMoved, isGuaranteed, config } = {}) {
    if (config?.enabled !== true || config.biteReaction?.enabled !== true || !rodMoved) return "none";
    if (isGuaranteed) return config.biteReaction.hookGuaranteedBite ? "hook" : "none";
    return config.biteReaction.releaseNormalBite ? "release" : "none";
  }

  resolveChance({ chance, floatMoved, isSpinning, config } = {}) {
    const normal = clampUnitFinite(chance);
    const rule = config?.movingFloatBite;
    if (normal <= 0 || config?.enabled !== true || rule?.enabled !== true || !floatMoved ||
      (isSpinning && rule.excludeSpinning)) return normal;
    return clampUnitFinite(rule.chance);
  }
}
