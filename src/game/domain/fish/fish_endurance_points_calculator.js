import { FishPhysicsProfile } from "./fish_physics_profile.js";
import { nonNegativeFinite } from "../../../engine/math/number_normalization.js";

export class FishEndurancePointsCalculator {
  calculate({
    level,
    weightKg,
    staminaFishConfig = {},
    fishPhysics = null,
    maxLevel = null,
    levelAverageWeightKg = null,
  } = {}) {
    const physics = FishPhysicsProfile.toRuntimeConfig(fishPhysics || {});
    const staminaProfile = physics.staminaProfile || {};
    const baseStamina = this.#resolveBaseStamina(staminaProfile, staminaFishConfig);
    const levelMultiplier = this.#positiveLevel(level);
    const weightGrams = nonNegativeFinite(weightKg) * 1000;
    const bossMultiplier = this.#resolveBossMultiplier(
      staminaProfile,
      staminaFishConfig,
    );

    let points = baseStamina + weightGrams * levelMultiplier;
    if (this.#isBossFish({ level, weightKg, maxLevel, levelAverageWeightKg })) {
      points *= bossMultiplier;
    }

    return Math.max(0, points);
  }

  #resolveBaseStamina(staminaProfile, staminaFishConfig) {
    const profileBase = Number(staminaProfile?.baseStamina);
    if (Number.isFinite(profileBase)) return Math.max(0, profileBase);

    const configBase = Number(staminaFishConfig?.baseStamina);
    if (Number.isFinite(configBase)) return Math.max(0, configBase);

    const legacyFlatBonus = Number(staminaFishConfig?.flatBonus);
    return Number.isFinite(legacyFlatBonus) ? Math.max(0, legacyFlatBonus) : 500;
  }

  #resolveBossMultiplier(staminaProfile, staminaFishConfig) {
    const profileMultiplier = Number(staminaProfile?.staminaBossMultiplier);
    if (Number.isFinite(profileMultiplier)) return Math.max(0, profileMultiplier);

    const configMultiplier = Number(staminaFishConfig?.staminaBossMultiplier);
    return Number.isFinite(configMultiplier) ? Math.max(0, configMultiplier) : 1;
  }

  #isBossFish({ level, weightKg, maxLevel, levelAverageWeightKg }) {
    const currentLevel = this.#positiveLevel(level);
    const lastLevel = Number(maxLevel);
    const weight = Number(weightKg);
    const averageWeight = Number(levelAverageWeightKg);

    return (
      Number.isFinite(lastLevel) &&
      currentLevel === Math.max(1, Math.round(lastLevel)) &&
      Number.isFinite(weight) &&
      Number.isFinite(averageWeight) &&
      weight < averageWeight
    );
  }

  #positiveLevel(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(1, Math.round(parsed)) : 1;
  }
}
