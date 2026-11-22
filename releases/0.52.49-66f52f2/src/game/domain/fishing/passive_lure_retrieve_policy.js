import { RetrievePolicy } from "./retrieve_policy.js";
import { resolveFightPhysicsConfig } from "./resolve_fight_physics_config.js";

export class PassiveLureRetrievePolicy extends RetrievePolicy {
  getRetrieveParams({ config } = {}) {
    const physics = resolveFightPhysicsConfig(config);
    const passive = physics?.getPassiveRetrieveConfig?.() || {};
    return {
      power: passive.passiveRetrievePowerRatio ?? passive.power ?? 1.0,
      multiplier: passive.multiplier ?? 35,
      waterFriction: passive.waterFriction ?? 0.35,
    };
  }
}
