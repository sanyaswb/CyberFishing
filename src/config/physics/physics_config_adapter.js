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

  getCurrentInfluenceMultiplier() {
    return this.#number(
      this.#physics().environment?.water?.currentInfluenceMultiplier,
      1,
    );
  }

  getWaterConfig() {
    const water = this.#physics().water || {};
    return {
      tautBodyResistancePerKg: this.#number(
        water.tautBodyResistancePerKg,
        0.2,
      ),
      motionResistance: this.#number(water.motionResistance, 1000),
      speedMultiplier: this.#number(water.speedMultiplier, 64),
    };
  }

  getDirectionForceConfig() {
    const config = this.#physics().fight?.directionForce || {};
    return {
      towardPlayerMultiplier: this.#number(config.towardPlayerMultiplier, 0),
      sideMultiplier: this.#number(config.sideMultiplier, 1),
      awayMultiplier: this.#number(config.awayMultiplier, 2.5),
    };
  }

  getRodHoldConfig() {
    const config = this.#physics().fight?.rodHold || {};
    const anglePenalty = config.anglePenalty || {};
    return {
      chargeTimeSeconds: this.#number(config.chargeTimeSeconds, 0.35),
      distanceMultiplierByRodLength: this.#number(
        config.distanceMultiplierByRodLength,
        0.5,
      ),
      minStrokeMeters: this.#number(config.minStrokeMeters, 0.001),
      finalLandingDistanceMeters: this.#number(
        config.finalLandingDistanceMeters,
        0.5,
      ),
      anglePenalty: {
        enabled: anglePenalty.enabled !== false,
        noPenaltyAngleDeg: this.#number(anglePenalty.noPenaltyAngleDeg, 15),
        maxPenaltyAngleDeg: this.#number(anglePenalty.maxPenaltyAngleDeg, 75),
        maxPenaltyMultiplier: this.#number(
          anglePenalty.maxPenaltyMultiplier,
          0.9,
        ),
      },
    };
  }

  getRodStrokeConfig() {
    const stroke = this.#physics().fight?.rodStroke || {};
    const hold = this.getRodHoldConfig();
    return {
      capacityByRodLengthRatio: this.#number(
        stroke.capacityByRodLengthRatio,
        hold.distanceMultiplierByRodLength,
        0.5,
      ),
    };
  }

  getFightTensionConfig() {
    const config = this.#physics().fight?.tension || {};
    return {
      smoothingPerSecond: this.#number(config.smoothingPerSecond, 10),
      slackTensionKg: this.#number(config.slackTensionKg, 0),
      movableHoldTensionCapRatio: this.#number(
        config.movableHoldTensionCapRatio,
        1,
      ),
    };
  }

  getRodPullConfig() {
    const rodHold = this.getRodHoldConfig();
    const rodStroke = this.getRodStrokeConfig();
    return {
      ...rodHold,
      rodHold,
      rodStroke,
      strokeChargePerSecond:
        rodHold.chargeTimeSeconds > 0
          ? 1 / rodHold.chargeTimeSeconds
          : undefined,
      capacityByRodLengthRatio: rodStroke.capacityByRodLengthRatio,
      distanceMultiplierByRodLength: rodStroke.capacityByRodLengthRatio,
      minStrokeMeters: rodHold.minStrokeMeters,
      finalLandingDistanceMeters: rodHold.finalLandingDistanceMeters,
    };
  }

  // Kept for non-fight retrieve gameplay: lure depth, idle pole retrieve and bite fallback.
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

  getReelHoldConfig() {
    const fight = this.#physics().fight?.reelHold || {};
    const reel = this.#physics().tackle?.reel || {};
    return {
      enabled:
        fight.enabled !== false &&
        reel.holdRecoverAfterFullStrokeMs !== false,
      requireRodStrokeFull: fight.requireRodStrokeFull !== false,
      delayMs: this.#number(
        fight.delayMs,
        reel.holdRecoverAfterFullStrokeMs,
        0,
      ),
      strokeRatio: this.#number(
        fight.strokeRatio,
        reel.holdRecoverStrokeRatio,
        1,
      ),
      strokeToleranceMeters: this.#number(
        fight.strokeToleranceMeters,
        reel.holdRecoverStrokeToleranceMeters,
        this.getRodHoldConfig().minStrokeMeters,
        0.001,
      ),
    };
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

  getLandingLiftConfig() {
    const config = this.#physics().fight?.landing?.lift || {};
    return {
      enabled: config.enabled !== false,
      liftWeightTensionRatio: this.#number(
        config.liftWeightTensionRatio,
        1,
      ),
      liftTimeSeconds: this.#number(config.liftTimeSeconds, 0.35),
      releaseTimeSeconds: this.#number(config.releaseTimeSeconds, 0.2),
    };
  }

  getTensionConfig() {
    const config = this.#physics().tension || {};
    const displayConfig = this.#root().tension || {};
    const breaking = config.breaking || {};
    return {
      ...displayConfig,
      ...config,
      tackleStress: this.getTackleStressConfig(),
      breakThreshold: this.#number(breaking.thresholdPercent, 100),
      baseBreakTime: this.#number(breaking.baseBreakTimeMs, 1000),
      timePerEquipmentLevel: this.#number(
        breaking.timePerEquipmentLevelMs,
        100,
      ),
    };
  }

  getTackleStressConfig() {
    const config = this.#physics().tension?.tackleStress || {};
    return {
      enabled: config.enabled !== false,
      stress: {
        capacity: this.#number(config.stress?.capacity, 1),
        baseGainPerSecond: this.#number(
          config.stress?.baseGainPerSecond,
          0.45,
        ),
        recoveryPerSecond: this.#number(
          config.stress?.recoveryPerSecond,
          0.35,
        ),
        minStressToRoll: this.#number(config.stress?.minStressToRoll, 0.01),
      },
      failureRoll: {
        intervalMs: this.#number(config.failureRoll?.intervalMs, 500),
        chanceScale: this.#number(config.failureRoll?.chanceScale, 1),
      },
      failureSelection: {
        tieBreakPriority:
          config.failureSelection?.tieBreakPriority || ["leader", "line", "rod"],
      },
    };
  }

  getFloatMotionConfig() {
    return this.#physics().floatMotion || {};
  }

  getRodAnglePenaltyConfig() {
    return this.#physics().fight?.rodHold?.anglePenalty || {};
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

  getRodControlConfig() {
    const fight = this.#physics().fight || {};
    const config = fight.rodControl || {};
    return {
      ...config,
      pixelsPerMeter: this.getPixelsPerMeter(),
    };
  }

  getPlayerPullMotionConfig() {
    return this.#physics().fight?.playerPullMotion || {};
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
