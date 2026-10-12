import { LandingPolicy } from "./landing_policy.js";
import { resolveFightPhysicsConfig } from "./resolve_fight_physics_config.js";

export class PoleLandingPolicy extends LandingPolicy {
  getLandingDistanceMeters({ rod, config } = {}) {
    const catchZone =
      resolveFightPhysicsConfig(config)?.getCatchZoneConfig?.() ||
      {};
    const poleConfig = catchZone.pole || {};
    const rodLengthMeters = this.#getRodLengthMeters(rod);
    const multiplier = Math.max(
      0,
      Number(poleConfig.landingDistanceByRodLength) || 1,
    );
    const minMeters = Math.max(
      0,
      Number(poleConfig.minLandingDistanceMeters) || 0,
    );
    const maxMeters = Math.max(
      minMeters,
      Number(poleConfig.maxLandingDistanceMeters) || Infinity,
    );
    const fallbackMeters = Math.max(
      0,
      Number(catchZone.landingDistanceMeters) || 1,
    );
    const rawMeters = rodLengthMeters > 0
      ? rodLengthMeters * multiplier
      : fallbackMeters;

    return Math.max(minMeters, Math.min(maxMeters, rawMeters));
  }

  #getRodLengthMeters(rod) {
    const value =
      (typeof rod?.getLengthMeters === "function"
        ? rod.getLengthMeters()
        : undefined) ??
      rod?.effectiveStats?.lengthMeters;
    return Math.max(0, Number(value) || 0);
  }
}
