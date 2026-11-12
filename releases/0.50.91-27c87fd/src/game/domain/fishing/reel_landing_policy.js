import { LandingPolicy } from "./landing_policy.js";
import { resolveFightPhysicsConfig } from "./resolve_fight_physics_config.js";

export class ReelLandingPolicy extends LandingPolicy {
  getLandingDistanceMeters({ config } = {}) {
    const catchZone =
      resolveFightPhysicsConfig(config)?.getCatchZoneConfig?.() ||
      {};
    return Math.max(
      0,
      Number(catchZone.reel?.landingDistanceMeters ?? catchZone.landingDistanceMeters) || 1,
    );
  }
}
