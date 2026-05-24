class FishPullResistanceModel {
  #configSource;
  #retrieveResistanceCalculator = new FishRetrieveResistanceCalculator();
  #waterDragCalculator = new PullWaterDragCalculator();
  #pressureTransferCalculator = new PlayerPressureTransferCalculator();

  constructor(configSource = {}) {
    this.#configSource = configSource || {};
  }

  calculate({
    dtSec,
    holdRatio,
    playerPullPressureKg,
    fishWeightKg,
    totalFishForceKg,
    awayFromPlayerRatio,
    fishConfig,
    fishCondition,
    lineDistanceMeters,
    landingDistanceMeters,
    movementBlocked,
    actualSlackMeters = 0,
    lineTaut = true,
  } = {}) {
    const dt = Math.max(0, Number(dtSec) || 0);
    const weight = Math.max(0, Number(fishWeightKg) || 0);
    const globalRetrieveConfig = this.#resolveRetrieveConfig();
    const retrieveConfig = fishConfig?.fishRetrieve || {};
    const modifiers = this.#resolvePullResistanceModifiers(fishConfig);
    const clampedHold = this.#clamp01(holdRatio);
    const playerPullPressure = this.#positive(playerPullPressureKg);
    const referencePullSpeed = this.#referencePullSpeed({
      modifiers,
      retrieveConfig,
      globalRetrieveConfig,
    });
    const looseLineMeters = this.#positive(actualSlackMeters);
    const isLineTaut =
      lineTaut !== false &&
      looseLineMeters <=
        this.#looseLineToleranceMeters({ retrieveConfig, globalRetrieveConfig });
    const landingLift = this.#resolveLandingLift({
      lineDistanceMeters,
      landingDistanceMeters,
      fishCondition,
    });

    const settingReader = (overrideConfig, key, defaultValue, globalConfig) =>
      this.#setting(overrideConfig, key, defaultValue, globalConfig);
    const resistance = this.#retrieveResistanceCalculator.calculate({
      fishWeightKg: weight,
      totalFishForceKg,
      awayFromPlayerRatio,
      isLineTaut,
      landingLift,
      retrieveConfig,
      globalRetrieveConfig,
      modifiers,
      settingReader,
    });
    const waterBodyResistance = resistance.waterBodyResistanceKg;
    const tautBodyResistance = resistance.tautBodyResistanceKg;
    const activeAwayForce = resistance.activeAwayForceKg;
    const fishOpposition = resistance.fishOppositionKg;
    const surplusPull = isLineTaut
      ? Math.max(0, playerPullPressure - fishOpposition)
      : 0;
    const waterDragKgPerKgAtReferenceSpeed =
      this.#resolveWaterDragAtReferenceSpeed({
        retrieveConfig,
        globalRetrieveConfig,
      });
    const waterDragFrame = this.#waterDragCalculator.calculate({
      fishWeightKg: weight,
      surplusPullKg: movementBlocked ? 0 : surplusPull,
      referencePullSpeedMetersPerSecond: referencePullSpeed,
      waterDragKgPerKgAtReferenceSpeed,
      waterDragMultiplier: modifiers.waterDragMultiplier ?? 1,
      landingLift,
    });
    const waterDragCapacity = waterDragFrame.waterDragCapacityKg;
    const targetFishPullSpeed = waterDragFrame.targetFishPullSpeedMetersPerSecond;
    const actualFishPullSpeed = targetFishPullSpeed;
    const pullSpeedRatio = waterDragFrame.pullSpeedRatio;
    const waterDrag = waterDragFrame.waterDragKg;
    const positiveAcceleration = 0;
    const accelerationRatio = 0;
    const accelerationLoad = 0;
    const pressureTransfer = this.#pressureTransferCalculator.calculate({
      fishWeightKg: weight,
      fishOppositionKg: fishOpposition,
      playerPullPressureKg: playerPullPressure,
      movementBlocked,
      isLineTaut,
      landingLift,
      retrieveConfig,
      globalRetrieveConfig,
      settingReader,
    });
    const pressureTransferRatio = pressureTransfer.pressureTransferRatio;
    const effectivePlayerPressure = pressureTransfer.effectivePlayerPressureKg;
    const blockedSurplusForce = pressureTransfer.blockedSurplusForceKg;
    const passiveRetrieveTension =
      tautBodyResistance +
      effectivePlayerPressure +
      accelerationLoad +
      blockedSurplusForce;
    const lineTension = passiveRetrieveTension + activeAwayForce;
    const movementControlRatio =
      playerPullPressure > 0.001
        ? this.#clamp01(surplusPull / playerPullPressure)
        : 0;

    return new FishRetrieveResult({
      holdRatio: clampedHold,
      playerPullPressureKg: playerPullPressure,
      effectivePlayerPressureKg: effectivePlayerPressure,
      pressureTransferRatio,
      desiredPullSpeedMetersPerSecond: targetFishPullSpeed,
      actualPullSpeedMetersPerSecond: actualFishPullSpeed,
      pullIntentSpeedMetersPerSecond: 0,
      actualFishPullSpeedMetersPerSecond: actualFishPullSpeed,
      targetFishPullSpeedMetersPerSecond: targetFishPullSpeed,
      pullSpeedRatio,
      intentPullSpeedRatio: 0,
      movementAuthorityLoadKg: playerPullPressure,
      potentialWaterDragKg: waterDragCapacity,
      potentialAccelerationLoadKg: accelerationLoad,
      bodyResistanceKg: tautBodyResistance,
      landingLiftRatio: landingLift.ratio,
      landingLiftLoadKg: Math.max(0, tautBodyResistance - waterBodyResistance),
      landingZoneActive: landingLift.inZone,
      landingFullyExhausted: landingLift.fullyExhausted,
      tautBodyResistanceKg: tautBodyResistance,
      bodyStaticResistanceKg: tautBodyResistance,
      fishStaticResistanceKg: tautBodyResistance,
      waterDragKg: waterDrag,
      waterDragCapacityKg: waterDragCapacity,
      waterDragKgPerKgAtReferenceSpeed,
      accelerationLoadKg: accelerationLoad,
      accelerationRatio,
      positiveAccelerationMetersPerSecond2: positiveAcceleration,
      activeAwayForceKg: activeAwayForce,
      fishActiveForceAwayKg: activeAwayForce,
      passiveRetrieveTensionKg: passiveRetrieveTension,
      fishOppositionKg: fishOpposition,
      usefulPullForceKg: effectivePlayerPressure,
      movementControlRatio,
      retrieveSpeedMetersPerSecond: actualFishPullSpeed,
      terminalRetrieveSpeedMetersPerSecond: targetFishPullSpeed,
      terminalSpeedReached:
        targetFishPullSpeed > 0 &&
        actualFishPullSpeed >= targetFishPullSpeed - 0.001,
      surplusForceKg: surplusPull,
      blockedSurplusForceKg: blockedSurplusForce,
      lineTensionKg: lineTension,
      desiredMoveMeters: Math.max(0, actualFishPullSpeed * dt),
      movementBlocked: !!movementBlocked,
      actualSlackMeters: looseLineMeters,
      lineTaut: isLineTaut,
      balanceState: this.#resolveBalanceState({
        playerPullPressure,
        fishOpposition,
        surplusPull,
        retrieveConfig,
        globalRetrieveConfig,
      }),
    });
  }

  #resolveRetrieveConfig() {
    const source =
      typeof this.#configSource === "function"
        ? this.#configSource()
        : this.#configSource;

    const settings = source?.getFishRetrieveSettings?.() ?? source;
    const config = settings?.getFishRetrieveConfig?.() ?? settings;

    if (config?.toLegacyConfig) return config.toLegacyConfig();
    if (typeof FishRetrievePhysicsSettings !== "undefined") {
      return FishRetrievePhysicsSettings.from(config || {}).toLegacyConfig();
    }
    return config || {};
  }

  #resolvePullResistanceModifiers(fishConfig) {
    const profile = fishConfig?.retrieveProfile || {};
    const legacy = fishConfig?.pullResistance || {};
    const modifiers = {};

    // New structured retrieveProfile is the primary read model.
    // Legacy pullResistance stays as a fallback only while compatibility aliases exist.
    this.#applyOptionalNumber(
      modifiers,
      "staticMultiplier",
      profile.staticMultiplier,
      profile.passiveBodyResistanceMultiplier,
      legacy.staticMultiplier,
      legacy.passiveBodyResistanceMultiplier,
    );
    this.#applyOptionalNumber(
      modifiers,
      "activeAwayMultiplier",
      profile.activeAwayMultiplier,
      legacy.activeAwayMultiplier,
    );
    this.#applyOptionalNumber(
      modifiers,
      "waterDragMultiplier",
      profile.waterDragMultiplier,
      legacy.waterDragMultiplier,
    );
    this.#applyOptionalNumber(
      modifiers,
      "referencePullSpeedMultiplier",
      profile.referencePullSpeedMultiplier,
      legacy.referencePullSpeedMultiplier,
    );

    return modifiers;
  }

  #applyOptionalNumber(target, key, ...values) {
    if (Number.isFinite(Number(target[key]))) return;
    for (const value of values) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        target[key] = parsed;
        return;
      }
    }
  }

  #resolveBalanceState({
    playerPullPressure,
    fishOpposition,
    surplusPull,
    retrieveConfig,
    globalRetrieveConfig,
  }) {
    if (playerPullPressure <= 0.001 && fishOpposition <= 0.001) return "idle";
    const epsilon = Math.max(
      0.001,
      Number(
        this.#setting(retrieveConfig, "balanceEpsilonKg", 0.001, globalRetrieveConfig),
      ) || 0.001,
    );
    if (Math.abs(playerPullPressure - fishOpposition) <= epsilon) {
      return "balanced";
    }
    if (surplusPull <= 0.001) return "fish_away";
    return "retrieving";
  }

  #referencePullSpeed({ modifiers, retrieveConfig, globalRetrieveConfig }) {
    return (
      this.#positive(
        this.#setting(
          retrieveConfig,
          "referencePullSpeedMetersPerSecond",
          1.2,
          globalRetrieveConfig,
        ),
      ) * this.#positive(modifiers.referencePullSpeedMultiplier ?? 1)
    );
  }

  #resolveWaterDragAtReferenceSpeed({ retrieveConfig, globalRetrieveConfig }) {
    const direct = this.#setting(
      retrieveConfig,
      "waterDragKgPerKgAtReferenceSpeed",
      NaN,
      globalRetrieveConfig,
    );
    if (Number.isFinite(Number(direct))) return this.#positive(direct);
    return 0.85;
  }

  #resolveLandingLift({ lineDistanceMeters, landingDistanceMeters, fishCondition }) {
    const landingDistance = this.#positive(landingDistanceMeters);
    const lineDistance = this.#positive(lineDistanceMeters);
    if (landingDistance <= 0 || lineDistance > landingDistance) {
      return {
        inZone: false,
        ratio: 0,
        fullyExhausted: false,
        disableActiveForces: false,
        disableAccelerationLoad: false,
        disablePlayerPressureLoad: false,
      };
    }

    const ratio = this.#clamp01(1 - lineDistance / Math.max(0.001, landingDistance));
    const fullyExhausted = this.#isFullyExhausted(fishCondition);
    return {
      inZone: true,
      ratio,
      fullyExhausted,
      disableActiveForces: fullyExhausted,
      disableAccelerationLoad: fullyExhausted,
      disablePlayerPressureLoad: fullyExhausted,
    };
  }

  #isFullyExhausted(fishCondition) {
    if (!fishCondition?.maxPoints) return false;
    return (
      fishCondition.phase === "exhaustion" &&
      Number(fishCondition.currentExhaustion) <= 0.001
    );
  }

  #looseLineToleranceMeters({ retrieveConfig, globalRetrieveConfig }) {
    return this.#positive(
      this.#setting(
        retrieveConfig,
        "looseLineTautToleranceMeters",
        0.02,
        globalRetrieveConfig,
      ),
    );
  }

  #setting(overrideConfig, key, defaultValue, globalConfig = null) {
    const override = this.#readSetting(overrideConfig, key);
    if (Number.isFinite(override)) return override;

    const global = this.#readSetting(globalConfig, key);
    if (Number.isFinite(global)) return global;

    return defaultValue;
  }

  #readSetting(config, key) {
    if (!config || typeof config !== "object") return NaN;
    const direct = Number(config[key]);
    if (Number.isFinite(direct)) return direct;

    const nestedValue = this.#readNestedSetting(config, key);
    const nestedNumber = Number(nestedValue);
    return Number.isFinite(nestedNumber) ? nestedNumber : NaN;
  }

  #readNestedSetting(config, key) {
    switch (key) {
      case "tautBodyResistanceKgPerKg":
      case "staticBodyResistanceKgPerKg":
        return config.passiveBodyResistance?.tautBodyResistanceKgPerKg;
      case "activeAwayForceMultiplier":
        return config.activeFishResistance?.activeAwayForceMultiplier;
      case "referencePullSpeedMetersPerSecond":
        return config.waterDragWhilePulling?.referencePullSpeedMetersPerSecond;
      case "waterDragKgPerKgAtReferenceSpeed":
        return config.waterDragWhilePulling?.dragKgPerKgAtReferenceSpeed;
      case "playerPressureTransferReferenceWeightKg":
        return config.playerPressureTransfer?.referenceWeightKg;
      case "minPlayerPressureTransferRatio":
        return config.playerPressureTransfer?.minTransferRatio;
      case "blockedPlayerPressureTransferRatio":
        return config.playerPressureTransfer?.blockedTransferRatio;
      case "looseLineTautToleranceMeters":
        return config.lineState?.looseLineTautToleranceMeters;
      case "balanceEpsilonKg":
        return config.balance?.epsilonKg;
      default:
        return undefined;
    }
  }

  #positive(value) {
    return Math.max(0, Number(value) || 0);
  }


  #clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }
}
