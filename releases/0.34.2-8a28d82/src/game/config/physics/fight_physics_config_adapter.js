import { firstFinite } from "../../../engine/math/number_normalization.js";

export class FightPhysicsConfigAdapter {
  #revision;
  #cachedRevision;
  #cache = new Map();

  // revision: the runtime config's change counter (the override store revision). With it, each getter computes its
  // normalized result once per revision instead of on every call; every runtime config write goes through the
  // override store and advances it. Without it (plain config objects) every call recomputes.
  constructor(config, { revision = null } = {}) {
    this.config = config || {};
    this.#revision = revision;
  }

  // Getters take no arguments and only read config, so their results can be shared until the revision changes.
  static {
    const prototype = FightPhysicsConfigAdapter.prototype;
    for (const name of Object.getOwnPropertyNames(prototype)) {
      const compute = prototype[name];
      if (!name.startsWith("get") || typeof compute !== "function" || compute.length !== 0) continue;
      prototype[name] = function cachedConfigGetter() {
        return this.#cached(name, compute);
      };
    }
  }

  #cached(name, compute) {
    if (!this.#revision) return compute.call(this);
    const revision = this.#revision();
    if (revision !== this.#cachedRevision) {
      this.#cache.clear();
      this.#cachedRevision = revision;
    }
    if (this.#cache.has(name)) return this.#cache.get(name);
    const value = compute.call(this);
    this.#cache.set(name, value);
    return value;
  }

  getPixelsPerMeter() {
    return firstFinite(this.#physics().simulation?.pixelsPerMeter, 50);
  }

  getMaxDtMs() {
    return firstFinite(this.#physics().simulation?.maxDtMs, 50);
  }

  getCurrentInfluenceMultiplier() {
    return firstFinite(
      this.#physics().environment?.water?.currentInfluenceMultiplier,
      1,
    );
  }

  getWaterConfig() {
    const water = this.#physics().water || {};
    return {
      tautBodyResistancePerKg: firstFinite(water.tautBodyResistancePerKg, 0.2),
      motionResistance: firstFinite(water.motionResistance, 1000),
      speedMultiplier: firstFinite(water.speedMultiplier, 64),
    };
  }

  getDirectionForceConfig() {
    const config = this.#physics().fight?.directionForce || {};
    return {
      towardPlayerMultiplier: firstFinite(config.towardPlayerMultiplier, 0),
      sideMultiplier: firstFinite(config.sideMultiplier, 1),
      awayMultiplier: firstFinite(config.awayMultiplier, 2.5),
      towardPlayerHoldOppositionRatio: firstFinite(
        config.towardPlayerHoldOppositionRatio,
        0,
      ),
      sideHoldOppositionRatio: firstFinite(
        config.sideHoldOppositionRatio,
        0.35,
      ),
      awayHoldOppositionRatio: firstFinite(config.awayHoldOppositionRatio, 1),
    };
  }

  getRodHoldConfig() {
    const config = this.#physics().fight?.rodHold || {};
    const anglePenalty = config.anglePenalty || {};
    return {
      chargeTimeSeconds: firstFinite(config.chargeTimeSeconds, 0.35),
      tensionCeilingMultiplier: Math.max(
        0,
        firstFinite(config.tensionCeilingMultiplier, 1),
      ),
      minStrokeMeters: firstFinite(config.minStrokeMeters, 0.001),
      finalLandingDistanceMeters: firstFinite(
        config.finalLandingDistanceMeters,
        0.5,
      ),
      anglePenalty: {
        enabled: anglePenalty.enabled !== false,
        noPenaltyAngleDeg: firstFinite(anglePenalty.noPenaltyAngleDeg, 15),
        maxPenaltyAngleDeg: firstFinite(anglePenalty.maxPenaltyAngleDeg, 75),
        maxPenaltyMultiplier: firstFinite(
          anglePenalty.maxPenaltyMultiplier,
          0.9,
        ),
      },
    };
  }

  getRodStrokeConfig() {
    const stroke = this.#physics().fight?.rodStroke || {};
    return {
      capacityByRodLengthRatio: firstFinite(
        stroke.capacityByRodLengthRatio,
        1,
      ),
      capacityByLineLengthRatio: firstFinite(
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
          Math.min(1, firstFinite(control.maxBudgetShare, 0.5)),
        ),
        minInputRatio: Math.max(0, firstFinite(control.minInputRatio, 0.001)),
      },
      tensionCeiling: {
        holdMultiplier: Math.max(
          0,
          firstFinite(tensionCeiling.holdMultiplier, 1.0),
        ),
        controlMultiplier: Math.max(
          0,
          firstFinite(tensionCeiling.controlMultiplier, 1.0),
        ),
        maxCombinedMultiplier: Math.max(
          1,
          firstFinite(tensionCeiling.maxCombinedMultiplier, 1.0),
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
        firstFinite(config.rodControlBuildPerSecond, 4.0),
      ),
      inputThresholds: {
        holdForceKg: Math.max(
          0,
          firstFinite(inputThresholds.holdForceKg, 0.01),
        ),
        controlInputRatio: Math.max(
          0,
          Math.min(1, firstFinite(inputThresholds.controlInputRatio, 0.05)),
        ),
        controlForceKg: Math.max(
          0,
          firstFinite(inputThresholds.controlForceKg, 0.01),
        ),
      },
      multipliers: {
        holdOnly: Math.max(0, firstFinite(multipliers.holdOnly, 1.0)),
        controlOnly: Math.max(0, firstFinite(multipliers.controlOnly, 1.0)),
        holdAndControl: Math.max(
          0,
          firstFinite(multipliers.holdAndControl, 1.5),
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
          firstFinite(inputThresholds.holdForceKg, 0.01),
        ),
        controlForceKg: Math.max(
          0,
          firstFinite(inputThresholds.controlForceKg, 0.01),
        ),
        holdInputRatio: Math.max(
          0,
          Math.min(1, firstFinite(inputThresholds.holdInputRatio, 0.05)),
        ),
        controlInputRatio: Math.max(
          0,
          Math.min(1, firstFinite(inputThresholds.controlInputRatio, 0.05)),
        ),
      },
      multipliers: {
        none: Math.max(0, firstFinite(multipliers.none, 1.0)),
        holdOnly: Math.max(0, firstFinite(multipliers.holdOnly, 1.0)),
        controlOnly: Math.max(0, firstFinite(multipliers.controlOnly, 1.0)),
        holdAndControl: Math.max(
          0,
          firstFinite(multipliers.holdAndControl, 1.5),
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
        firstFinite(config.pressureThresholdKg, 0.01),
      ),
      graceDurationMs: Math.max(
        0,
        firstFinite(config.graceDurationMs, 3000),
      ),
      fatigueDurationMs: Math.max(
        0,
        firstFinite(config.fatigueDurationMs, 6000),
      ),
      minEfficiency: Math.max(
        0,
        Math.min(1, firstFinite(config.minEfficiency, 0.45)),
      ),
      curvePower: Math.max(0, firstFinite(config.curvePower, 1.2)),
      controlBreak: {
        enabled: controlBreak.enabled === true,
        fatigueProgressThreshold: Math.max(
          0,
          Math.min(
            1,
            firstFinite(
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
            firstFinite(
              controlBreak.fatigueProgressThreshold ??
                controlBreak.fatigueRatioThreshold,
              0.9,
            ),
          ),
        ),
        minContinuousPressureMs: Math.max(
          0,
          firstFinite(controlBreak.minContinuousPressureMs, 8000),
        ),
      },
      recovery: {
        delayAfterPressureMs: Math.max(
          0,
          firstFinite(recovery.delayAfterPressureMs, 400),
        ),
        recoveryPerSecond: Math.max(
          0,
          firstFinite(recovery.recoveryPerSecond, 0.8),
        ),
        holdCompleteVisibleMs: Math.max(
          0,
          firstFinite(recovery.holdCompleteVisibleMs, 500),
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
          offsetX: Math.max(0, firstFinite(position.offsetX, 24)),
          offsetY: Math.max(0, firstFinite(position.offsetY, 24)),
        },
        radius: Math.max(1, firstFinite(visual.radius, 16)),
        ringWidth: Math.max(1, firstFinite(visual.ringWidth, 4)),
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
      smoothingPerSecond: firstFinite(config.smoothingPerSecond, 10),
      slackTensionKg: firstFinite(config.slackTensionKg, 0),
      movableHoldTensionCapRatio: firstFinite(
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
      passiveRetrievePowerRatio: firstFinite(
        config.passiveRetrievePowerRatio,
        config.power,
        1,
      ),
      power: firstFinite(config.passiveRetrievePowerRatio, config.power, 1),
      multiplier: firstFinite(config.multiplier, 35),
      waterFriction: firstFinite(config.waterFriction, 0.35),
      depthRiseSpeed: firstFinite(config.depthRiseSpeed, 0.15),
    };
  }

  getLureRetrieveConfig() {
    const config = this.#physics().retrieve?.lure || {};
    return {
      multiplier: firstFinite(config.multiplier, 50),
      idleSpinningBiteChance: firstFinite(
        config.idleSpinningBiteChance,
        0.005,
      ),
      defaultSurfaceDepthMeters: firstFinite(
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
      minRatio: firstFinite(config.minRatio, 0),
      maxRatio: firstFinite(config.maxRatio, 1),
      tensionGrowthPower: firstFinite(config.tensionGrowthPower, 1.6),
      autoRetrieveEnabled: config.autoRetrieveEnabled ?? true,
      creepReleaseRatio: firstFinite(config.creepReleaseRatio, 0),
      pointerControlEnabled: config.pointerControl?.enabled ?? true,
      powerSwipePx: firstFinite(config.pointerControl?.powerSwipePx, 200),
      powerDeadzoneRatio: firstFinite(
        config.pointerControl?.powerDeadzoneRatio,
        0.25,
      ),
      powerAnchorReturnPxPerSecond: firstFinite(
        config.pointerControl?.powerAnchorReturnPxPerSecond,
        1200,
      ),
      changeSpeedPerSec: firstFinite(
        config.keyboardControl?.changeSpeedPerSec,
        0.35,
      ),
    };
  }

  getReelConfig() {
    const config = this.#physics().tackle?.reel || {};
    return {
      ...config,
      bearingRetrieveSpeedBonusMetersPerSec: firstFinite(
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
      delayMs: firstFinite(fight.delayMs, 0),
      strokeRatio: firstFinite(fight.strokeRatio, 1),
      strokeRatioTolerance: firstFinite(
        fight.strokeRatioTolerance,
        0.001,
      ),
      strokeToleranceMeters: firstFinite(
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
        firstFinite(config.fishSpeedMultiplier, 0.5),
      ),
    };
  }

  getCatchZoneConfig() {
    const config = this.#physics().fight?.landing?.catchZone || {};
    return {
      ...config,
      landingDistanceMeters: firstFinite(
        config.reel?.landingDistanceMeters,
        1,
      ),
      reel: {
        landingDistanceMeters: firstFinite(
          config.reel?.landingDistanceMeters,
          1,
        ),
      },
      pole: {
        landingDistanceByRodLength: firstFinite(
          config.pole?.landingDistanceByRodLength,
          1,
        ),
        minLandingDistanceMeters: firstFinite(
          config.pole?.minLandingDistanceMeters,
          1,
        ),
        maxLandingDistanceMeters: firstFinite(
          config.pole?.maxLandingDistanceMeters,
          2,
        ),
      },
      maxLoadWeightRatio: firstFinite(config.maxLoadWeightRatio, 1),
    };
  }

  getLandingLiftConfig() {
    const config = this.#physics().fight?.landing?.lift || {};
    return {
      enabled: config.enabled !== false,
      liftWeightTensionRatio: firstFinite(config.liftWeightTensionRatio, 1),
      fastLiftTimeSeconds: firstFinite(
        config.fastLiftTimeSeconds ?? config.liftTimeSeconds,
        0.25,
      ),
      releaseTimeSeconds: firstFinite(config.releaseTimeSeconds, 0.2),
      slowdownStartRatio: firstFinite(config.slowdownStartRatio, 0.75),
      endSpeedRatio: firstFinite(config.endSpeedRatio, 0.08),
      slowdownCurvePower: firstFinite(config.slowdownCurvePower, 2.5),
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
      breakThreshold: firstFinite(breaking.thresholdPercent, 100),
      baseBreakTime: firstFinite(breaking.baseBreakTimeMs, 1000),
      timePerEquipmentLevel: firstFinite(
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
        capacity: firstFinite(config.stress?.capacity, 1),
        baseGainPerSecond: firstFinite(config.stress?.baseGainPerSecond, 0.45),
        recoveryPerSecond: firstFinite(config.stress?.recoveryPerSecond, 0.35),
        minStressToRoll: firstFinite(config.stress?.minStressToRoll, 0.01),
      },
      failureRoll: {
        intervalMs: firstFinite(config.failureRoll?.intervalMs, 500),
        chanceScale: firstFinite(config.failureRoll?.chanceScale, 1),
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
    return firstFinite(
      this.#physics().fight?.playerControl?.steering?.xAxisMultiplier,
      1.5,
    );
  }

  getInputSteeringBlend() {
    return firstFinite(
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
        firstFinite(config.tensionCeilingMultiplier, 1),
      ),
      pixelsPerMeter: this.getPixelsPerMeter(),
      water: this.getWaterConfig(),
      lineConstraint: {
        tautThresholdRatio: firstFinite(
          lineConstraint.tautThresholdRatio,
          0.995,
        ),
        epsilonMeters: firstFinite(lineConstraint.epsilonMeters, 0.001),
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
          Math.abs(firstFinite(config.maxAngleFromCenterDeg, 60)),
        ),
      ),
      shoreOpeningWidthMeters: Math.max(
        0,
        firstFinite(config.shoreOpeningWidthMeters, 1),
      ),
    };
  }

  #root() {
    return this.config?.raw || this.config || {};
  }

  #physics() {
    return this.#root().physics || {};
  }
}
