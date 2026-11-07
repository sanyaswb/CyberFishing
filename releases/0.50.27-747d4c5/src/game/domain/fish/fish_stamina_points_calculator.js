import { FishPhysicsProfile } from "./fish_physics_profile.js";
import { nonNegativeFinite } from "../../../engine/math/number_normalization.js";

export class FishStaminaPointsCalculator {
  calculate({ endurancePoints, staminaFishConfig = {}, fishPhysics = null } = {}) {
    const physics = FishPhysicsProfile.toRuntimeConfig(fishPhysics || {});
    const staminaProfile = physics.staminaProfile || {};
    const ratio = this.#resolveRatio(staminaProfile, staminaFishConfig);
    return Math.max(0, nonNegativeFinite(endurancePoints) * ratio);
  }

  #resolveRatio(staminaProfile, staminaFishConfig) {
    const profileRatio = Number(staminaProfile?.staminaRatioFromEndurance);
    if (Number.isFinite(profileRatio)) return Math.max(0, profileRatio);

    const configRatio = Number(staminaFishConfig?.staminaRatioFromEndurance);
    return Number.isFinite(configRatio) ? Math.max(0, configRatio) : 0.1;
  }
}
