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
      tautBodyResistancePerKg: this.#number(water.tautBodyResistancePerKg, 0.2),
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
      towardPlayerHoldOppositionRatio: this.#number(
        config.towardPlayerHoldOppositionRatio,
        0,
      ),
      sideHoldOppositionRatio: this.#number(
        config.sideHoldOppositionRatio,
        0.35,
      ),
      awayHoldOppositionRatio: this.#number(config.awayHoldOppositionRatio, 1),
    };
  }

  getRodHoldConfig() {
    const config = this.#physics().fight?.rodHold || {};
    const anglePenalty = config.anglePenalty || {};
    return {
      chargeTimeSeconds: this.#number(config.chargeTimeSeconds, 0.35),
      tensionCeilingMultiplier: Math.max(
        0,
        this.#number(config.tensionCeilingMultiplier, 1),
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
    return {
      capacityByRodLengthRatio: this.#number(
        stroke.capacityByRodLengthRatio,
        1,
      ),
      capacityByLineLengthRatio: this.#number(
        stroke.capacityByLineLengthRatio,
        1,
      ),
    };
  }

  getPlayerForceBudgetConfig() {
    const config = this.#physics().fight?.playerForceBudget || {};
    const control = config.control || {};
    const tensionCeiling = config.tensionCeiling || {};
    return {
      enabled: config.enabled !== false,
      allocationMode:
        config.allocationMode === "split" ? "split" : "independent",
      control: {
        maxBudgetShare: Math.max(
          0,
          Math.min(1, this.#number(control.maxBudgetShare, 0.5)),
        ),
        minInputRatio: Math.max(0, this.#number(control.minInputRatio, 0.001)),
      },
      tensionCeiling: {
        holdMultiplier: Math.max(
          0,
          this.#number(tensionCeiling.holdMultiplier, 1.0),
        ),
        controlMultiplier: Math.max(
          0,
          this.#number(tensionCeiling.controlMultiplier, 1.0),
        ),
        maxCombinedMultiplier: Math.max(
          1,
          this.#number(tensionCeiling.maxCombinedMultiplier, 1.0),
        ),
      },
    };
  }

  getPlayerPressureGainConfig() {
    const config = this.#physics().fight?.playerPressureGain || {};
    const inputThresholds = config.inputThresholds || {};
    const multipliers = config.multipliers || {};
    return {
      enabled: config.enabled === true,
      rodControlBuildPerSecond: Math.max(
        0,
        this.#number(config.rodControlBuildPerSecond, 4.0),
      ),
      inputThresholds: {
        holdForceKg: Math.max(
          0,
          this.#number(inputThresholds.holdForceKg, 0.01),
        ),
        controlInputRatio: Math.max(
          0,
          Math.min(1, this.#number(inputThresholds.controlInputRatio, 0.05)),
        ),
        controlForceKg: Math.max(
          0,
          this.#number(inputThresholds.controlForceKg, 0.01),
        ),
      },
      multipliers: {
        holdOnly: Math.max(0, this.#number(multipliers.holdOnly, 1.0)),
        controlOnly: Math.max(0, this.#number(multipliers.controlOnly, 1.0)),
        holdAndControl: Math.max(
          0,
          this.#number(multipliers.holdAndControl, 1.5),
        ),
      },
    };
  }

  getPlayerTensionBuildRateConfig() {
    const config = this.#physics().fight?.playerTensionBuildRate || {};
    const inputThresholds = config.inputThresholds || {};
    const multipliers = config.multipliers || {};
    const applyTo = config.applyTo || {};
    return {
      enabled: config.enabled === true,
      inputThresholds: {
        holdForceKg: Math.max(
          0,
          this.#number(inputThresholds.holdForceKg, 0.01),
        ),
        controlForceKg: Math.max(
          0,
          this.#number(inputThresholds.controlForceKg, 0.01),
        ),
        holdInputRatio: Math.max(
          0,
          Math.min(1, this.#number(inputThresholds.holdInputRatio, 0.05)),
        ),
        controlInputRatio: Math.max(
          0,
          Math.min(1, this.#number(inputThresholds.controlInputRatio, 0.05)),
        ),
      },
      multipliers: {
        none: Math.max(0, this.#number(multipliers.none, 1.0)),
        holdOnly: Math.max(0, this.#number(multipliers.holdOnly, 1.0)),
        controlOnly: Math.max(0, this.#number(multipliers.controlOnly, 1.0)),
        holdAndControl: Math.max(
          0,
          this.#number(multipliers.holdAndControl, 1.5),
        ),
      },
      applyTo: {
        rodHoldCharge: applyTo.rodHoldCharge !== false,
        rodControlBuild: applyTo.rodControlBuild !== false,
      },
    };
  }

  getPlayerPressureFatigueConfig() {
    const config = this.#physics().fight?.playerPressureFatigue || {};
    const recovery = config.recovery || {};
    const channels = config.channels || {};
    const controlBreak = config.controlBreak || {};
    const visual = config.visual || {};
    const position = visual.position || {};
    const colors = visual.colors || {};
    return {
      enabled: config.enabled === true,
      source: {
        mode: config.source?.mode || "reel_hold_session",
      },
      pressureThresholdKg: Math.max(
        0,
        this.#number(config.pressureThresholdKg, 0.01),
      ),
      graceDurationMs: Math.max(
        0,
        this.#number(config.graceDurationMs, 3000),
      ),
      fatigueDurationMs: Math.max(
        0,
        this.#number(config.fatigueDurationMs, 6000),
      ),
      minEfficiency: Math.max(
        0,
        Math.min(1, this.#number(config.minEfficiency, 0.45)),
      ),
      curvePower: Math.max(0, this.#number(config.curvePower, 1.2)),
      controlBreak: {
        enabled: controlBreak.enabled === true,
        fatigueProgressThreshold: Math.max(
          0,
          Math.min(
            1,
            this.#number(
              controlBreak.fatigueProgressThreshold ??
                controlBreak.fatigueRatioThreshold,
              0.9,
            ),
          ),
        ),
        fatigueRatioThreshold: Math.max(
          0,
          Math.min(
            1,
            this.#number(
              controlBreak.fatigueProgressThreshold ??
                controlBreak.fatigueRatioThreshold,
              0.9,
            ),
          ),
        ),
        minContinuousPressureMs: Math.max(
          0,
          this.#number(controlBreak.minContinuousPressureMs, 8000),
        ),
      },
      recovery: {
        delayAfterPressureMs: Math.max(
          0,
          this.#number(recovery.delayAfterPressureMs, 400),
        ),
        recoveryPerSecond: Math.max(
          0,
          this.#number(recovery.recoveryPerSecond, 0.8),
        ),
        holdCompleteVisibleMs: Math.max(
          0,
          this.#number(recovery.holdCompleteVisibleMs, 500),
        ),
      },
      channels: {
        rodHold: channels.rodHold !== false,
        rodControl: channels.rodControl !== false,
      },
      visual: {
        enabled: visual.enabled === true,
        position: {
          anchor: position.anchor || "top_right",
          offsetX: Math.max(0, this.#number(position.offsetX, 24)),
          offsetY: Math.max(0, this.#number(position.offsetY, 24)),
        },
        radius: Math.max(1, this.#number(visual.radius, 16)),
        ringWidth: Math.max(1, this.#number(visual.ringWidth, 4)),
        idleVisible: visual.idleVisible === true,
        colors: {
          grace: colors.grace || "#ffffff",
          ready: colors.ready || "#2ecc71",
          warning: colors.warning || "#f1c40f",
          danger: colors.danger || "#e74c3c",
          background: colors.background || "rgba(0, 0, 0, 0.35)",
          ringBackground:
            colors.ringBackground || "rgba(255, 255, 255, 0.18)",
        },
      },
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
      capacityByRodLengthRatio: rodStroke.capacityByRodLengthRatio,
      capacityByLineLengthRatio: rodStroke.capacityByLineLengthRatio,
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
      power: this.#number(config.passiveRetrievePowerRatio, config.power, 1),
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
      defaultSurfaceDepthMeters: this.#number(
        config.defaultSurfaceDepthMeters ?? config.defaultDepthNoSinker,
        0.1,
      ),
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
    const config = this.#physics().tackle?.reel || {};
    return {
      ...config,
      bearingRetrieveSpeedBonusMetersPerSec: this.#number(
        config.bearingRetrieveSpeedBonusMetersPerSec,
        0,
      ),
    };
  }

  getReelHoldConfig() {
    const fight = this.#physics().fight?.reelHold || {};
    return {
      enabled: fight.enabled !== false,
      requireRodStrokeFull: fight.requireRodStrokeFull !== false,
      delayMs: this.#number(fight.delayMs, 0),
      strokeRatio: this.#number(fight.strokeRatio, 1),
      strokeRatioTolerance: this.#number(
        fight.strokeRatioTolerance,
        0.001,
      ),
      strokeToleranceMeters: this.#number(
        fight.strokeToleranceMeters,
        this.getRodHoldConfig().minStrokeMeters,
        0.001,
      ),
    };
  }

  getReelRecoveryConfig() {
    const config = this.#physics().fight?.reelRecovery || {};
    return {
      fishSpeedMultiplier: Math.max(
        0,
        this.#number(config.fishSpeedMultiplier, 0.5),
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
      liftWeightTensionRatio: this.#number(config.liftWeightTensionRatio, 1),
      fastLiftTimeSeconds: this.#number(
        config.fastLiftTimeSeconds ?? config.liftTimeSeconds,
        0.25,
      ),
      releaseTimeSeconds: this.#number(config.releaseTimeSeconds, 0.2),
      slowdownStartRatio: this.#number(config.slowdownStartRatio, 0.75),
      endSpeedRatio: this.#number(config.endSpeedRatio, 0.08),
      slowdownCurvePower: this.#number(config.slowdownCurvePower, 2.5),
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
        baseGainPerSecond: this.#number(config.stress?.baseGainPerSecond, 0.45),
        recoveryPerSecond: this.#number(config.stress?.recoveryPerSecond, 0.35),
        minStressToRoll: this.#number(config.stress?.minStressToRoll, 0.01),
      },
      failureRoll: {
        intervalMs: this.#number(config.failureRoll?.intervalMs, 500),
        chanceScale: this.#number(config.failureRoll?.chanceScale, 1),
      },
      failureSelection: {
        tieBreakPriority: config.failureSelection?.tieBreakPriority || [
          "leader",
          "line",
          "hook",
          "rod",
          "reel",
        ],
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
        1, 1,
      ]
    );
  }

  getRodControlConfig() {
    const fight = this.#physics().fight || {};
    const config = fight.rodControl || {};
    const lineConstraint = config.lineConstraint || {};
    return {
      ...config,
      tensionCeilingMultiplier: Math.max(
        0,
        this.#number(config.tensionCeilingMultiplier, 1),
      ),
      pixelsPerMeter: this.getPixelsPerMeter(),
      water: this.getWaterConfig(),
      lineConstraint: {
        tautThresholdRatio: this.#number(
          lineConstraint.tautThresholdRatio,
          0.995,
        ),
        epsilonMeters: this.#number(lineConstraint.epsilonMeters, 0.001),
        projectLockedMovementToArc:
          lineConstraint.projectLockedMovementToArc !== false,
      },
    };
  }

  getPlayerPullMotionConfig() {
    return this.#physics().fight?.playerPullMotion || {};
  }

  getPoleFightSectorConfig() {
    const config = this.#physics().fight?.poleFightSector || {};
    return {
      enabled: config.enabled !== false,
      maxAngleFromCenterDeg: Math.max(
        0,
        Math.min(
          89.9,
          Math.abs(this.#number(config.maxAngleFromCenterDeg, 60)),
        ),
      ),
      shoreOpeningWidthMeters: Math.max(
        0,
        this.#number(config.shoreOpeningWidthMeters, 1),
      ),
    };
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
