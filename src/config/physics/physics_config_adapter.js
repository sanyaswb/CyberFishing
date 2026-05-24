class FightPhysicsConfigAdapter {
  constructor(config) {
    this.config = config || {};
  }

  getPixelsPerMeter() {
    return this.#number(this.#physics().simulation?.pixelsPerMeter, 50);
  }

  getFixedDtMs() {
    return this.#number(this.#physics().simulation?.fixedDtMs, 16.666);
  }

  getMaxDtMs() {
    return this.#number(this.#physics().simulation?.maxDtMs, 50);
  }

  isFishMotionDynamicLoadEnabled() {
    return (
      this.#physics().fight?.fishForce?.dynamicLoadFromMotion?.enabled !== false
    );
  }

  getFishMotionSpeedLoadKgPerKgPerMps() {
    return this.#number(
      this.#physics().environment?.water?.fishMotionLoad
        ?.speedLoadKgPerKgPerMps,
      1,
    );
  }

  getCurrentInfluenceMultiplier() {
    return this.#number(
      this.#physics().environment?.water?.currentInfluenceMultiplier,
      1,
    );
  }

  getDirectionMultiplierConfig() {
    const config =
      this.#physics().fight?.fishForce?.dynamicLoadFromMotion
        ?.directionMultiplier || {};
    return {
      sameDirection: this.#number(config.sameDirection, 0.4),
      sideDirection: this.#number(config.sideDirection, 1),
      oppositeDirection: this.#number(config.oppositeDirection, 1.8),
    };
  }

  getMinPowerRatioFallback() {
    return this.#number(
      this.#physics().fight?.fishForce?.exhaustion?.minPowerRatioFallback,
      0.25,
    );
  }

  getFishRetrieveSettings() {
    const config = this.#physics().fight?.fishRetrieve || {};
    if (typeof FishRetrievePhysicsSettings !== "undefined") {
      return FishRetrievePhysicsSettings.from(config);
    }

    return config;
  }

  getFishRetrieveConfig() {
    const settings = this.getFishRetrieveSettings();
    if (settings?.toLegacyConfig) return settings.toLegacyConfig();

    const config = settings || {};
    return {
      tautBodyResistanceKgPerKg: this.#number(
        config.passiveBodyResistance?.tautBodyResistanceKgPerKg,
        config.tautBodyResistanceKgPerKg,
        config.staticBodyResistanceKgPerKg,
        0,
      ),
      activeAwayForceMultiplier: this.#number(
        config.activeFishResistance?.activeAwayForceMultiplier,
        config.activeAwayForceMultiplier,
        1,
      ),
      referencePullSpeedMetersPerSecond: this.#number(
        config.waterDragWhilePulling?.referencePullSpeedMetersPerSecond,
        config.referencePullSpeedMetersPerSecond,
        1,
      ),
      waterDragKgPerKgAtReferenceSpeed: this.#number(
        config.waterDragWhilePulling?.dragKgPerKgAtReferenceSpeed,
        config.waterDragKgPerKgAtReferenceSpeed,
        1,
      ),
      playerPressureTransferReferenceWeightKg: this.#number(
        config.playerPressureTransfer?.referenceWeightKg,
        config.playerPressureTransferReferenceWeightKg,
        1,
      ),
      minPlayerPressureTransferRatio: this.#number(
        config.playerPressureTransfer?.minTransferRatio,
        config.minPlayerPressureTransferRatio,
        0,
      ),
      blockedPlayerPressureTransferRatio: this.#number(
        config.playerPressureTransfer?.blockedTransferRatio,
        config.blockedPlayerPressureTransferRatio,
        1,
      ),
    };
  }

  getRodPullConfig() {
    return this.#physics().fight?.rodPull || {};
  }

  getPassiveRetrieveConfig() {
    const config = this.#physics().retrieve?.passive || {};
    return {
      passiveRetrievePowerRatio: this.#number(
        config.passiveRetrievePowerRatio,
        config.power,
        1,
      ),
      power: this.#number(
        config.passiveRetrievePowerRatio,
        config.power,
        1,
      ),
      multiplier: this.#number(config.multiplier, 35),
      waterFriction: this.#number(config.waterFriction, 0.35),
      depthRiseSpeed: this.#number(config.depthRiseSpeed, 0.15),
    };
  }

  getLureRetrieveConfig() {
    const config = this.#physics().retrieve?.lure || {};
    return {
      multiplier: this.#number(config.multiplier, 50),
      idleSpinningBiteChance: this.#number(
        config.idleSpinningBiteChance,
        0.005,
      ),
      defaultDepthNoSinker: this.#number(config.defaultDepthNoSinker, 0.1),
      guaranteedBiteCooldownMs: config.guaranteedBiteCooldownMs || [0, 0],
    };
  }

  getPoleIdleRetrieveConfig() {
    return this.#physics().retrieve?.poleIdle || {};
  }

  getBaitLossChanceConfig() {
    return this.#physics().retrieve?.biteFallback?.baitLossChance || {};
  }

  getCastingPowerConfig() {
    return this.#physics().castingPower || {};
  }

  getLineConfig() {
    return this.#physics().tackle?.line || {};
  }

  getLineSystemConfig() {
    return {
      pixelsPerMeter: this.getPixelsPerMeter(),
      line: this.getLineConfig(),
      castingPower: this.getCastingPowerConfig(),
    };
  }

  getDistanceConfig() {
    return {
      pixelsPerMeter: this.getPixelsPerMeter(),
    };
  }

  getReelDragConfig() {
    const config = this.#physics().tackle?.reelDrag || {};
    return {
      minRatio: this.#number(config.minRatio, 0),
      maxRatio: this.#number(config.maxRatio, 1),
      yEscapeSpeedAtFullDrag: this.#number(
        config.yEscapeSpeedAtFullDrag,
        0.02,
      ),
      tensionGrowthPower: this.#number(config.tensionGrowthPower, 1.6),
      autoRetrieveEnabled: config.autoRetrieveEnabled ?? true,
      creepReleaseRatio: this.#number(config.creepReleaseRatio, 0),
      pointerControlEnabled: config.pointerControl?.enabled ?? true,
      powerSwipePx: this.#number(config.pointerControl?.powerSwipePx, 200),
      powerDeadzoneRatio: this.#number(
        config.pointerControl?.powerDeadzoneRatio,
        0.25,
      ),
      powerAnchorReturnPxPerSecond: this.#number(
        config.pointerControl?.powerAnchorReturnPxPerSecond,
        1200,
      ),
      changeSpeedPerSec: this.#number(
        config.keyboardControl?.changeSpeedPerSec,
        0.35,
      ),
    };
  }

  getReelConfig() {
    return this.#physics().tackle?.reel || {};
  }

  getCatchZoneConfig() {
    const config = this.#physics().fight?.landing?.catchZone || {};
    return {
      ...config,
      landingDistanceMeters: this.#number(
        config.reel?.landingDistanceMeters,
        1,
      ),
      reel: {
        landingDistanceMeters: this.#number(
          config.reel?.landingDistanceMeters,
          1,
        ),
      },
      pole: {
        landingDistanceByRodLength: this.#number(
          config.pole?.landingDistanceByRodLength,
          1,
        ),
        minLandingDistanceMeters: this.#number(
          config.pole?.minLandingDistanceMeters,
          1,
        ),
        maxLandingDistanceMeters: this.#number(
          config.pole?.maxLandingDistanceMeters,
          2,
        ),
      },
      maxLoadWeightRatio: this.#number(config.maxLoadWeightRatio, 1),
    };
  }

  getTensionConfig() {
    const config = this.#physics().tension || {};
    const displayConfig = this.#root().tension || {};
    const breaking = config.breaking || {};
    return {
      ...displayConfig,
      ...config,
      breakThreshold: this.#number(breaking.thresholdPercent, 100),
      baseBreakTime: this.#number(breaking.baseBreakTimeMs, 1000),
      timePerEquipmentLevel: this.#number(
        breaking.timePerEquipmentLevelMs,
        100,
      ),
    };
  }

  getFloatMotionConfig() {
    return this.#physics().floatMotion || {};
  }

  getRodAnglePenaltyConfig() {
    return this.#physics().fight?.playerControl?.rodAnglePenalty || {};
  }

  getPlayerSteeringMultiplier() {
    return this.#number(
      this.#physics().fight?.playerControl?.steering?.xAxisMultiplier,
      1.5,
    );
  }

  getInputSteeringBlend() {
    return this.#number(
      this.#physics().fight?.playerControl?.steering?.inputSteeringBlend,
      0.35,
    );
  }

  getDistanceXMultiplier() {
    return (
      this.#physics().fight?.playerControl?.steering?.distanceXMultiplier || [
        1,
        1,
      ]
    );
  }

  #root() {
    return this.config?.raw || this.config || {};
  }

  #physics() {
    return this.#root().physics || {};
  }

  #number(...values) {
    for (const value of values) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
  }
}
