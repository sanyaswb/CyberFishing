class RetrievePolicy {
  getRetrieveParams(_context = {}) {
    return null;
  }
}

class PassiveLureRetrievePolicy extends RetrievePolicy {
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

class PoleIdleRetrievePolicy extends RetrievePolicy {
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

function resolveFightPhysicsConfig(config) {
  if (config?.fightPhysicsConfig) return config.fightPhysicsConfig;
  if (typeof FightPhysicsConfigAdapter !== "undefined") {
    return new FightPhysicsConfigAdapter(config);
  }
  return null;
}

class IdleRetrievePolicyResolver {
  constructor({
    polePolicy = null,
    defaultPolicy = null,
  } = {}) {
    this.polePolicy = polePolicy || new PoleIdleRetrievePolicy();
    this.defaultPolicy = defaultPolicy || new PassiveLureRetrievePolicy();
  }

  resolve({ rod, reel } = {}) {
    return this.#hasUsableReel({ rod, reel })
      ? this.defaultPolicy
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

    const capacity = Number(
      reel.lineCapacityMeters ?? reel.engineStats?.lineCapacityMeters ?? 0,
    );
    const power = Number(reel.basePower ?? reel.engineStats?.basePower ?? 0);
    return capacity > 0 || power > 0;
  }
}
