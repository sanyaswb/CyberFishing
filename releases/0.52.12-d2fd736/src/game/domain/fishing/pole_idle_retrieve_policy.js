import { RetrievePolicy } from "./retrieve_policy.js";
import { resolveFightPhysicsConfig } from "./resolve_fight_physics_config.js";

export class PoleIdleRetrievePolicy extends RetrievePolicy {
  getRetrieveParams({ config } = {}) {
    const physics = resolveFightPhysicsConfig(config);
    const pole = physics?.getPoleIdleRetrieveConfig?.() || {};
    const pixelsPerMeter = Math.max(
      1,
      Number(physics?.getPixelsPerMeter?.()) || 50,
    );
    const speedMetersPerSecond = Math.max(
      0,
      Number(pole.speedMetersPerSecond) || 1.2,
    );
    return {
      targetSpeedPxPerSec: speedMetersPerSecond * pixelsPerMeter,
      waterFrictionMultiplier: Math.max(
        0,
        Number(pole.waterFrictionMultiplier) || 0.15,
      ),
    };
  }
}
