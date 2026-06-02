class LandingPolicy {
  getLandingDistanceMeters(_context = {}) {
    throw new Error("LandingPolicy.getLandingDistanceMeters() must be implemented");
  }

  isInLandingZone(context = {}) {
    const distanceMeters = Math.max(0, Number(context.lineDistanceMeters) || Infinity);
    return distanceMeters <= this.getLandingDistanceMeters(context);
  }
}

class ReelLandingPolicy extends LandingPolicy {
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

class PoleLandingPolicy extends LandingPolicy {
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
      rod?.lengthMeters ??
      rod?.engineStats?.lengthMeters;
    return Math.max(0, Number(value) || 0);
  }
}

function resolveFightPhysicsConfig(config) {
  if (config?.fightPhysicsConfig) return config.fightPhysicsConfig;
  if (typeof FightPhysicsConfigAdapter !== "undefined") {
    return new FightPhysicsConfigAdapter(config);
  }
  return null;
}

class LandingPolicyResolver {
  constructor({ reelPolicy = null, polePolicy = null } = {}) {
    this.reelPolicy = reelPolicy || new ReelLandingPolicy();
    this.polePolicy = polePolicy || new PoleLandingPolicy();
  }

  resolve({ rod, reel } = {}) {
    return this.#hasUsableReel({ rod, reel })
      ? this.reelPolicy
      : this.polePolicy;
  }

  #hasUsableReel({ rod, reel } = {}) {
    if (!rod) return true;
    const rodHasReel =
      (typeof rod?.hasReel === "function" ? rod.hasReel() : undefined) ??
      rod?.hasReel ??
      rod?.engineStats?.hasReel;
    if (rodHasReel === false) return false;
    if (!reel) return false;
    if (typeof reel.hasReel === "function") return reel.hasReel();

    const capacity = Number(reel.lineCapacityMeters ?? reel.engineStats?.lineCapacityMeters ?? 0);
    const power = Number(reel.basePower ?? reel.engineStats?.basePower ?? 0);
    return capacity > 0 || power > 0;
  }
}
