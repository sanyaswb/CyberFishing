class OverlayMetricFormulaCatalog {
  constructor() {
    this.entriesByLabel = new Map(Object.entries({
      "Вага риби": {
        formula: "runtime value: hookedFish.weight",
        description: "Фактична вага поточної підсіченої риби. Вона є базовим множником для більшості fight-розрахунків.",
        paths: ["HOOKED_FISH.weight"],
      },
      "Базова сила": {
        formula: "staticFishForceKg = fishWeightKg * levelBasePower * basePower",
        description: "Базова сила риби до динамічного навантаження від руху та поведінкового powerRatio.",
        paths: [
          "HOOKED_FISH.weight",
          "HOOKED_FISH.physics.forceProfile.basePower",
          "HOOKED_FISH.physics.forceProfile.levelBasePower",
          "HOOKED_FISH.physics.forceProfile.minPowerRatio",
        ],
      },
      "Швидкість відн. води": {
        formula: "relativeSpeedMps = length(fishVelocity - waterCurrentVelocity) / pixelsPerMeter",
        description: "Швидкість риби відносно води/течії. Впливає на dynamicFishForceKg.",
        paths: [
          "CONFIG.physics.simulation.pixelsPerMeter",
          "CONFIG.physics.environment.water.currentInfluenceMultiplier",
        ],
      },
      "Динамічне навантаження": {
        formula: "dynamicFishForceKg = fishWeightKg * relativeSpeedMps * speedForceMultiplier * waterResistanceMultiplier * speedLoadKgPerKgPerMps * directionMultiplier",
        description: "Додаткове навантаження, яке виникає від руху риби у воді.",
        paths: [
          "CONFIG.physics.fight.fishForce.dynamicLoadFromMotion.enabled",
          "CONFIG.physics.environment.water.fishMotionLoad.speedLoadKgPerKgPerMps",
          "HOOKED_FISH.physics.resistanceProfile.speedForceMultiplier",
          "HOOKED_FISH.physics.resistanceProfile.waterResistanceMultiplier",
        ],
      },
      "Множник напрямку": {
        formula: "directionMultiplier = interpolate(sameDirection, sideDirection, oppositeDirection) by fish movement direction vs player direction",
        description: "Підсилює або послаблює dynamicFishForceKg залежно від того, куди рухається риба відносно гравця.",
        paths: [
          "CONFIG.physics.fight.fishForce.dynamicLoadFromMotion.directionMultiplier.sameDirection",
          "CONFIG.physics.fight.fishForce.dynamicLoadFromMotion.directionMultiplier.sideDirection",
          "CONFIG.physics.fight.fishForce.dynamicLoadFromMotion.directionMultiplier.oppositeDirection",
        ],
      },
      "Water motion load": {
        formula: "motionLoadPerSpeed = speedLoadKgPerKgPerMps",
        description: "Глобальний коефіцієнт, скільки кг навантаження додає 1 кг риби на 1 м/с руху у воді.",
        paths: ["CONFIG.physics.environment.water.fishMotionLoad.speedLoadKgPerKgPerMps"],
      },
      "Підсумкова сила риби": {
        formula: "totalFishForceKg = max(staticForceKg * minPowerRatio, (staticForceKg * behaviorPowerRatio + dynamicFishForceKg) * exhaustionPowerMultiplier)",
        description: "Фінальна сила риби, яка йде в fight/tension pipeline.",
        paths: [
          "HOOKED_FISH.physics.forceProfile.basePower",
          "HOOKED_FISH.physics.forceProfile.minPowerRatio",
          "CONFIG.physics.fight.fishForce.dynamicLoadFromMotion.enabled",
          "CONFIG.physics.environment.water.fishMotionLoad.speedLoadKgPerKgPerMps",
        ],
      },
      "Player pressure": {
        formula: "effectivePlayerPressureKg = playerPullPressureKg * pressureTransferRatio",
        description: "Сирий тиск гравця через вудку і частина цього тиску, яка реально переходить у tension.",
        paths: [
          "CONFIG.physics.fight.rodPull.controlledPullLimitRatio",
          "CONFIG.physics.fight.fishRetrieve.playerPressureTransfer.referenceWeightKg",
          "CONFIG.physics.fight.fishRetrieve.playerPressureTransfer.minTransferRatio",
          "CONFIG.physics.fight.fishRetrieve.playerPressureTransfer.blockedTransferRatio",
        ],
      },
      "Передача тиску": {
        formula: "pressureTransferRatio = max(minTransferRatio, weightTransfer, loadTransfer); blocked => blockedTransferRatio",
        description: "Скільки player pressure реально передається в навантаження ліски.",
        paths: [
          "CONFIG.physics.fight.fishRetrieve.playerPressureTransfer.referenceWeightKg",
          "CONFIG.physics.fight.fishRetrieve.playerPressureTransfer.minTransferRatio",
          "CONFIG.physics.fight.fishRetrieve.playerPressureTransfer.blockedTransferRatio",
        ],
      },
      "Пасивний опір тіла": {
        formula: "bodyResistanceKg = fishWeightKg * tautBodyResistanceKgPerKg * passiveBodyResistanceMultiplier",
        description: "Пасивний опір тіла риби, який треба перебороти перед підтягуванням.",
        paths: [
          "CONFIG.physics.fight.fishRetrieve.passiveBodyResistance.tautBodyResistanceKgPerKg",
          "HOOKED_FISH.physics.retrieveProfile.passiveBodyResistanceMultiplier",
        ],
      },
      "Активний опір від риби": {
        formula: "activeAwayForceKg = totalFishForceKg * awayFromPlayerRatio * activeAwayForceMultiplier * activeAwayMultiplier",
        description: "Активний опір, коли риба реально тягне від гравця.",
        paths: [
          "CONFIG.physics.fight.fishRetrieve.activeFishResistance.activeAwayForceMultiplier",
          "HOOKED_FISH.physics.retrieveProfile.activeAwayMultiplier",
        ],
      },
      "Сумарний опір риби": {
        formula: "fishOppositionKg = bodyResistanceKg + activeAwayForceKg",
        description: "Сума пасивного опору тіла й активного опору риби проти підтягування.",
        paths: [
          "CONFIG.physics.fight.fishRetrieve.passiveBodyResistance.tautBodyResistanceKgPerKg",
          "CONFIG.physics.fight.fishRetrieve.activeFishResistance.activeAwayForceMultiplier",
          "HOOKED_FISH.physics.retrieveProfile.passiveBodyResistanceMultiplier",
          "HOOKED_FISH.physics.retrieveProfile.activeAwayMultiplier",
        ],
      },
      "Надлишкова сила": {
        formula: "surplusPullKg = max(0, playerPullPressureKg - fishOppositionKg)",
        description: "Сила, яка лишилася після подолання опору риби і може рухати рибу до гравця.",
        paths: [
          "CONFIG.physics.fight.rodPull.controlledPullLimitRatio",
          "CONFIG.physics.fight.fishRetrieve.passiveBodyResistance.tautBodyResistanceKgPerKg",
          "CONFIG.physics.fight.fishRetrieve.activeFishResistance.activeAwayForceMultiplier",
        ],
      },
      "Контроль руху": {
        formula: "movementControlRatio = appliedMoveMeters / desiredMoveMeters",
        description: "Показує, наскільки бажаний рух підтягування реально застосувався після constraints.",
        paths: [
          "CONFIG.physics.fight.rodPull.controlledPullLimitRatio",
          "CONFIG.physics.fight.fishRetrieve.playerPressureTransfer.blockedTransferRatio",
        ],
      },
      "Drag capacity": {
        formula: "waterDragCapacityKg = fishWeightKg * dragKgPerKgAtReferenceSpeed * waterDragMultiplier",
        description: "Ємність водяного drag при підтягуванні. Більше значення = важче протягувати рибу через воду.",
        paths: [
          "CONFIG.physics.fight.fishRetrieve.waterDragWhilePulling.dragKgPerKgAtReferenceSpeed",
          "HOOKED_FISH.physics.retrieveProfile.waterDragMultiplier",
        ],
      },
      "Drag на поточній швидкості": {
        formula: "waterDragKg = waterDragCapacityKg * (actualPullSpeedMps / referencePullSpeedMetersPerSecond)^2",
        description: "Оцінка drag-навантаження на поточній швидкості підтягування.",
        paths: [
          "CONFIG.physics.fight.fishRetrieve.waterDragWhilePulling.dragKgPerKgAtReferenceSpeed",
          "CONFIG.physics.fight.fishRetrieve.waterDragWhilePulling.referencePullSpeedMetersPerSecond",
          "HOOKED_FISH.physics.retrieveProfile.waterDragMultiplier",
        ],
      },
      "Drag per kg @ ref speed": {
        formula: "globalPullDrag = dragKgPerKgAtReferenceSpeed",
        description: "Глобальний коефіцієнт опору води при підтягуванні 1 кг риби на reference speed.",
        paths: ["CONFIG.physics.fight.fishRetrieve.waterDragWhilePulling.dragKgPerKgAtReferenceSpeed"],
      },
      "Retrieve speed": {
        formula: "targetPullSpeedMps = referencePullSpeedMetersPerSecond * sqrt(surplusPullKg / waterDragCapacityKg)",
        description: "Швидкість підтягування риби через воду при наявній надлишковій силі.",
        paths: [
          "CONFIG.physics.fight.fishRetrieve.waterDragWhilePulling.referencePullSpeedMetersPerSecond",
          "CONFIG.physics.fight.fishRetrieve.waterDragWhilePulling.dragKgPerKgAtReferenceSpeed",
          "HOOKED_FISH.physics.retrieveProfile.referencePullSpeedMultiplier",
        ],
      },
      "Desired move": {
        formula: "desiredMoveMeters = targetPullSpeedMps * deltaTimeSeconds",
        description: "Скільки метрів система хотіла підтягнути рибу за кадр.",
        paths: [
          "CONFIG.physics.fight.fishRetrieve.waterDragWhilePulling.referencePullSpeedMetersPerSecond",
          "CONFIG.physics.fight.rodPull.minStrokeMeters",
        ],
      },
      "Applied move": {
        formula: "appliedMoveMeters = desiredMoveMeters after line/landing/constraint limits",
        description: "Фактично застосований рух після обмежень ліски, позиції й landing-зони.",
        paths: [
          "CONFIG.physics.fight.fishRetrieve.waterDragWhilePulling.referencePullSpeedMetersPerSecond",
          "CONFIG.physics.tackle.line.constraintTolerancePx",
        ],
      },
      "Рух заблоковано": {
        formula: "movementBlocked = appliedMoveMeters < desiredMoveMeters by tolerance or line/landing constraint blocks movement",
        description: "Показує, що система хотіла рухати рибу, але constraint завадив.",
        paths: [
          "CONFIG.physics.tackle.line.constraintTolerancePx",
          "CONFIG.physics.fight.landing.catchZone.maxLoadWeightRatio",
        ],
      },
      "Натяг": {
        formula: "tensionKg = smooth/clamped line tension from raw forces, drag limit and tackle max load",
        description: "Фінальне навантаження на снасть після smoothing, drag і constraints.",
        paths: [
          "CONFIG.physics.tension.kgSmoothPerSecond",
          "CONFIG.physics.tension.powerRatioExponent",
          "CONFIG.physics.tension.sensitivityMultiplier",
        ],
      },
      "Raw tension": {
        formula: "rawTensionKg = pre-smoothing/pre-drag tension estimate from fight forces",
        description: "Сирий tension до обмежень і згладжування.",
        paths: [
          "CONFIG.physics.tension.powerRatioExponent",
          "CONFIG.physics.tension.sensitivityMultiplier",
        ],
      },
      "Retrieve line tension": {
        formula: "retrieveLineTensionKg = passive/active retrieve contribution to line tension",
        description: "Частина tension, яка виникає через підтягування/підмотку.",
        paths: [
          "CONFIG.physics.retrieve.passive.passiveRetrievePowerRatio",
          "CONFIG.physics.retrieve.passive.multiplier",
          "CONFIG.physics.retrieve.passive.waterFriction",
        ],
      },
      "Passive retrieve tension": {
        formula: "passiveRetrieveTensionKg = passiveRetrievePowerRatio * passive retrieve model contribution",
        description: "Пасивна частина tension від retrieve-моделі.",
        paths: [
          "CONFIG.physics.retrieve.passive.passiveRetrievePowerRatio",
          "CONFIG.physics.retrieve.passive.multiplier",
        ],
      },
      "Фрикціон": {
        formula: "dragLimitKg = tackleMaxLoadKg * dragPercentCurve(minRatio, maxRatio, tensionGrowthPower)",
        description: "Ліміт фрикціону, після якого котушка має віддавати ліску.",
        paths: [
          "CONFIG.physics.tackle.reelDrag.minRatio",
          "CONFIG.physics.tackle.reelDrag.maxRatio",
          "CONFIG.physics.tackle.reelDrag.tensionGrowthPower",
        ],
      },
      "Tension mode": {
        formula: "mode is selected by line extension, drag slipping, retrieve and fight state",
        description: "Пояснює, який режим tension зараз домінує.",
        paths: [
          "CONFIG.physics.tension.smoothApproach",
          "CONFIG.physics.tension.reelRecoveryMultiplier",
        ],
      },
      "Фізична межа ліски": {
        formula: "isLineFullyExtended = lineDistanceMeters >= availableLineMeters - tolerance",
        description: "Чи досягла ліска фізичного максимуму довжини.",
        paths: [
          "CONFIG.physics.tackle.line.fullExtensionTensionMultiplier",
          "CONFIG.physics.tackle.line.constraintTolerancePx",
        ],
      },
      "Запас ліски": {
        formula: "lineCanRelease = remainingLineMeters > tolerance and reel/rod policy allows release",
        description: "Чи може снасть ще віддати ліску.",
        paths: [
          "CONFIG.physics.tackle.line.rodLengthReserveMultiplier",
          "CONFIG.physics.tackle.line.noReelMinRodLengthMultiplier",
          "CONFIG.physics.tackle.line.noReelExtraLengthMeters",
        ],
      },
      "Залишок ліски": {
        formula: "lineRemainingMeters = maxLineAvailableMeters - lineReleasedMeters",
        description: "Скільки ліски ще може бути випущено.",
        paths: [
          "CONFIG.physics.tackle.line.rodLengthReserveMultiplier",
          "CONFIG.physics.tackle.line.noReelExtraLengthMeters",
        ],
      },
      "Випущено ліски": {
        formula: "lineReleasedMeters is runtime line state constrained by reel/rod limits",
        description: "Скільки ліски вже випущено зі снасті.",
        paths: [
          "CONFIG.physics.tackle.line.rodLengthReserveMultiplier",
          "CONFIG.physics.tackle.line.noReelExtraLengthMeters",
        ],
      },
      "Дистанція до риби": {
        formula: "lineDistanceMeters = distance(player/rod anchor, fish position) / pixelsPerMeter",
        description: "Фізична дистанція до риби в метрах.",
        paths: ["CONFIG.physics.simulation.pixelsPerMeter"],
      },
      "Хід вудки": {
        formula: "rodStrokeCapacityMeters = rodLengthMeters * distanceMultiplierByRodLength; stroke recovers by strokeChargePerSecond",
        description: "Скільки pull-distance накопичено/використано ходом вудки.",
        paths: [
          "CONFIG.physics.fight.rodPull.distanceMultiplierByRodLength",
          "CONFIG.physics.fight.rodPull.strokeChargePerSecond",
          "CONFIG.physics.fight.rodPull.minStrokeMeters",
        ],
      },
      "Штраф кута": {
        formula: "anglePenalty = interpolate(1.0, maxPenaltyMultiplier) between noPenaltyAngleDeg and maxPenaltyAngleDeg",
        description: "Зменшує ефективність гравця при поганому куті вудки.",
        paths: [
          "CONFIG.physics.fight.playerControl.rodAnglePenalty.enabled",
          "CONFIG.physics.fight.playerControl.rodAnglePenalty.noPenaltyAngleDeg",
          "CONFIG.physics.fight.playerControl.rodAnglePenalty.maxPenaltyAngleDeg",
          "CONFIG.physics.fight.playerControl.rodAnglePenalty.maxPenaltyMultiplier",
        ],
      },
      "Підмотка hold": {
        formula: "holdRecoverActive depends on autoRecoverSlack, full stroke and holdRecoverAfterFullStrokeMs delay",
        description: "Автоматичне відновлення slack/підмотка при утриманні після повного stroke.",
        paths: [
          "CONFIG.physics.tackle.reel.autoRecoverSlack",
          "CONFIG.physics.tackle.reel.holdRecoverAfterFullStrokeMs",
          "CONFIG.physics.tackle.reel.holdRecoverStrokeRatio",
        ],
      },
      "Причина підмотки": {
        formula: "blockedReason is selected by reel availability, hold state, drag slipping, stroke fullness and timers",
        description: "Чому hold-підмотка активна або заблокована.",
        paths: [
          "CONFIG.physics.tackle.reel.autoRecoverSlack",
          "CONFIG.physics.tackle.reel.holdRecoverAfterFullStrokeMs",
        ],
      },
      "Таймер підмотки": {
        formula: "holdRecoverTimerMs accumulates until holdRecoverAfterFullStrokeMs",
        description: "Таймер очікування перед hold-підмоткою.",
        paths: ["CONFIG.physics.tackle.reel.holdRecoverAfterFullStrokeMs"],
      },
      "Швидк. підмотки": {
        formula: "holdRecoverSpeedMps depends on reel recovery policy and drag/reel settings",
        description: "Швидкість відновлення ліски при hold-підмотці.",
        paths: [
          "CONFIG.physics.tackle.reel.autoRecoverSlack",
          "CONFIG.physics.tackle.reelDrag.yEscapeSpeedAtFullDrag",
        ],
      },
      "До скручування": {
        formula: "pumpCreditMeters tracks unrecovered rod-pull distance before reel recovery",
        description: "Скільки накопиченого pull-credit лишилось до відновлення/скручування.",
        paths: [
          "CONFIG.physics.fight.rodPull.distanceMultiplierByRodLength",
          "CONFIG.physics.tackle.reel.holdRecoverStrokeRatio",
        ],
      },
    }));
    this.#installSimpleFightEntries();
  }

  #installSimpleFightEntries() {
    const entries = {
      "Fish weight": {
        formula: "fishWeightKg = hookedFish.weight",
        description: "Actual hooked fish weight used by the simplified fight model.",
        paths: ["HOOKED_FISH.weight"],
      },
      "Water weight / passive force": {
        formula: "fishPassiveKg = fishWeightKg * tautBodyResistancePerKg * fishBasePower",
        description: "Passive force created by the fish body on a taut line.",
        paths: [
          "CONFIG.physics.water.tautBodyResistancePerKg",
          "HOOKED_FISH.physics.forceProfile.basePower",
        ],
      },
      "State force multiplier": {
        formula: "fishStateForceMultiplier = current behavior forceMultiplier",
        description: "Current fish behavior force multiplier. It affects tension and opposition.",
        paths: ["HOOKED_FISH.physics.behaviorProfile.behaviors.*.forceMultiplier"],
      },
      "Direction multiplier": {
        formula: "directionMultiplier = toward/side/away multiplier by fish movement direction",
        description: "Direction force multiplier for toward-player, side or away movement.",
        paths: ["CONFIG.physics.fight.directionForce"],
      },
      "Active fish force": {
        formula: "fishActiveKg = fishPassiveKg * fishStateForceMultiplier * directionMultiplier",
        description: "Active force added by current fish behavior and movement direction.",
        paths: [
          "HOOKED_FISH.physics.behaviorProfile.behaviors.*.forceMultiplier",
          "CONFIG.physics.fight.directionForce",
        ],
      },
      "Fish opposition": {
        formula: "fishOppositionKg = fishPassiveKg + fishActiveKg",
        description: "Total force the player must exceed to move the fish toward the player.",
        paths: ["CONFIG.physics.water.tautBodyResistancePerKg"],
      },
      "Rod hold": {
        formula: "rodHoldKg += (rodHoldMaxKg / chargeTimeSeconds) * dt",
        description: "Raw hold charged by the player before angle penalty.",
        paths: ["CONFIG.physics.fight.rodHold.chargeTimeSeconds"],
      },
      "Rod hold max": {
        formula: "rodHoldMaxKg = max(0, rodLimitKg - fishTensionKg)",
        description: "Maximum hold available from rod reserve after fish tension is already present.",
        paths: ["ITEM_DB.rods.*.engineStats.maxLoadKg"],
      },
      "Angle multiplier": {
        formula: "effectiveRodHoldKg = rodHoldKg * rodAngleMultiplier",
        description: "Rod angle penalty applied to raw hold.",
        paths: ["CONFIG.physics.fight.rodHold.anglePenalty"],
      },
      "Effective rod hold": {
        formula: "effectiveRodHoldKg = min(rodHoldKg, rodHoldMaxKg) * rodAngleMultiplier",
        description: "Full player force working against fish movement.",
        paths: ["CONFIG.physics.fight.rodHold"],
      },
      "Hold tension ratio": {
        formula: "playerHoldTensionKg = effectiveRodHoldKg * holdTensionRatio",
        description: "Rod transfer ratio. It affects tension only, not player force against the fish.",
        paths: ["ITEM_DB.rods.*.engineStats.holdTensionRatio"],
      },
      "Movable tension cap": {
        formula: "movableHoldTensionCapKg = fishPassiveKg * movableHoldTensionCapRatio",
        description: "Maximum hold tension added while the fish can move toward the player.",
        paths: ["CONFIG.physics.fight.tension.movableHoldTensionCapRatio"],
      },
      "Hold to tension": {
        formula: "playerHoldTensionKg = min(rawHoldTensionKg, movableHoldTensionCapKg) when fish can move",
        description: "Player hold contribution added to total tension after movable-fish capping.",
        paths: [
          "ITEM_DB.rods.*.engineStats.holdTensionRatio",
          "CONFIG.physics.fight.tension.movableHoldTensionCapRatio",
        ],
      },
      "Net force": {
        formula: "netForceKg = effectiveRodHoldKg - fishOppositionKg",
        description: "Positive means the player moves fish toward the player; negative means fish wins.",
        paths: ["CONFIG.physics.fight.rodHold"],
      },
      "Winner": {
        formula: "winner = sign(netForceKg)",
        description: "Player wins when net force is positive; fish wins when it is negative.",
        paths: [],
      },
      "Water resistance": {
        formula: "speedMps = sqrt(abs(netForceKg) / motionResistance) * speedMultiplier",
        description: "Global movement resistance. Higher values slow movement for the same net force.",
        paths: ["CONFIG.physics.water.motionResistance"],
      },
      "Speed multiplier": {
        formula: "speedMps = sqrt(abs(netForceKg) / motionResistance) * speedMultiplier",
        description: "Global game speed multiplier for simplified fight movement.",
        paths: ["CONFIG.physics.water.speedMultiplier"],
      },
      "Speed m/s": {
        formula: "speedMps = sqrt(abs(netForceKg) / motionResistance) * speedMultiplier",
        description: "Final movement speed in meters per second.",
        paths: ["CONFIG.physics.water.motionResistance", "CONFIG.physics.water.speedMultiplier"],
      },
      "Speed px/s": {
        formula: "speedPxPerSecond = speedMps * pixelsPerMeter",
        description: "Final movement speed converted to pixels per second.",
        paths: ["CONFIG.physics.simulation.pixelsPerMeter"],
      },
      "Fish tension": {
        formula: "fishTensionKg = fishOppositionKg, or 0 when slack applies",
        description: "Fish contribution to total tension.",
        paths: ["CONFIG.physics.fight.tension.slackTensionKg"],
      },
      "Player tension": {
        formula: "playerHoldTensionKg = effectiveRodHoldKg * holdTensionRatio",
        description: "Player hold contribution to total tension.",
        paths: ["ITEM_DB.rods.*.engineStats.holdTensionRatio"],
      },
      "Total tension": {
        formula: "totalTensionKg = fishTensionKg + playerHoldTensionKg",
        description: "Total stress load applied to rod, line and hook.",
        paths: [],
      },
      "Rod stress": {
        formula: "rodStressRatio = totalTensionKg / rodLimitKg",
        description: "Rod load ratio from total tension.",
        paths: ["ITEM_DB.rods.*.engineStats.maxLoadKg"],
      },
      "Line stress": {
        formula: "lineStressRatio = totalTensionKg / lineLimitKg",
        description: "Line load ratio from total tension.",
        paths: ["ITEM_DB.lines.*.engineStats.maxLoadKg"],
      },
      "Hook stress": {
        formula: "hookStressRatio = totalTensionKg / hookLimitKg",
        description: "Hook load ratio from total tension. Open-ended when hook load is not configured.",
        paths: ["ITEM_DB.hooks.*.engineStats.maxLoadKg"],
      },
    };

    for (const [label, entry] of Object.entries(entries)) {
      this.entriesByLabel.set(label, entry);
    }
  }

  getEntry(label) {
    const normalized = this.normalizeLabel(label);
    if (this.entriesByLabel.has(normalized)) return this.entriesByLabel.get(normalized);

    for (const [key, entry] of this.entriesByLabel.entries()) {
      if (normalized.startsWith(key)) return entry;
    }
    return null;
  }

  normalizeLabel(label) {
    return String(label || "")
      .replace(/[：:]+$/u, "")
      .replace(/\s*\([^)]*\)\s*$/u, "")
      .trim();
  }
}

class OverlayMetricConsoleInspector {
  #liveData = {};

  updateLiveData(data) {
    this.#liveData = data || {};
  }

  inspect({ label, displayedValue, entry }) {
    if (!entry) return;

    const normalizedLabel = String(label || "").trim();
    const rows = entry.paths.map((path) => this.#buildParameterRow(path));

    console.groupCollapsed(
      `%c[Overlay metric] ${normalizedLabel}`,
      "color:#73c2fb;font-weight:bold;",
    );
    console.log("Displayed value:", displayedValue || "n/a");
    console.log("Meaning:", entry.description || "n/a");
    console.log("Formula:", entry.formula || "n/a");
    console.table(rows);
    console.log("Live debug snapshot:", this.#buildSmallSnapshot());
    console.groupEnd();
  }

  #buildParameterRow(path) {
    const valueResult = this.#resolvePath(path);
    return {
      path,
      value: valueResult.found ? this.#formatValue(valueResult.value) : "not available",
      source: this.#getSourceDescription(path),
      status: valueResult.found ? "ok" : valueResult.reason,
    };
  }

  #resolvePath(path) {
    const parts = String(path || "").split(".").filter(Boolean);
    const rootName = parts.shift();
    const root = this.#getRoot(rootName);

    if (root === undefined || root === null) {
      return { found: false, reason: `${rootName || "root"} unavailable` };
    }

    let current = root;
    for (const part of parts) {
      if (current === undefined || current === null) {
        return { found: false, reason: `missing before ${part}` };
      }
      if (!Object.prototype.hasOwnProperty.call(Object(current), part)) {
        return { found: false, reason: `missing ${part}` };
      }
      current = current[part];
    }

    return { found: true, value: current };
  }

  #getRoot(rootName) {
    switch (rootName) {
      case "CONFIG":
        return typeof CONFIG !== "undefined" ? CONFIG : undefined;
      case "BASE_CONFIG":
        return typeof BASE_CONFIG !== "undefined" ? BASE_CONFIG : undefined;
      case "HOOKED_FISH":
        return this.#liveData?.hookedFish || undefined;
      case "DEBUG_DATA":
        return this.#liveData;
      default:
        return undefined;
    }
  }

  #getSourceDescription(path) {
    if (path.startsWith("CONFIG.")) return "global runtime CONFIG";
    if (path.startsWith("BASE_CONFIG.")) return "immutable base config";
    if (path.startsWith("HOOKED_FISH.")) return "currently hooked fish runtime data";
    if (path.startsWith("DEBUG_DATA.")) return "current overlay debug snapshot";
    return "runtime";
  }

  #formatValue(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
    if (typeof value === "boolean" || typeof value === "string") return value;
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    try {
      return JSON.stringify(value);
    } catch (_error) {
      return String(value);
    }
  }

  #buildSmallSnapshot() {
    const keys = [
      "fishWeightKg",
      "staticFishForceKg",
      "dynamicFishForceKg",
      "totalFishForceKg",
      "playerPullPressureKg",
      "effectivePlayerPressureKg",
      "pressureTransferRatio",
      "fishOppositionKg",
      "fishRetrieveSurplusForceKg",
      "fishRetrieveWaterDragCapacityKg",
      "actualFishPullSpeedMps",
      "targetFishPullSpeedMps",
      "tensionKg",
      "rawTensionKg",
      "dragLimitKg",
    ];

    const snapshot = {};
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(Object(this.#liveData), key)) {
        snapshot[key] = this.#liveData[key];
      }
    }
    return snapshot;
  }
}

class OverlayMetricInspector {
  constructor({
    catalog = new OverlayMetricFormulaCatalog(),
    inspector = new OverlayMetricConsoleInspector(),
  } = {}) {
    this.catalog = catalog;
    this.inspector = inspector;
    this.content = null;
  }

  start() {
    this.content = document.querySelector(".debug-overlay-content");
    if (!this.content) return;

    this.listenForDebugData();
    this.content.addEventListener("pointerdown", (event) => this.handlePointerDown(event), true);
    this.content.addEventListener("click", (event) => this.handleClick(event), true);
  }

  listenForDebugData() {
    document.addEventListener("debug-live-update", (event) => {
      this.inspector.updateLiveData(event.detail || {});
    });
  }

  handlePointerDown(event) {
    const button = event.target.closest?.(".overlay-metric-info-btn");
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    if (button.dataset.pointerHandled === "1") return;
    button.dataset.pointerHandled = "1";
    window.setTimeout(() => {
      if (button.isConnected) delete button.dataset.pointerHandled;
    }, 240);

    this.inspectButton(button);
  }

  handleClick(event) {
    const button = event.target.closest?.(".overlay-metric-info-btn");
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }

  inspectButton(button) {
    const row = button.closest(".debug-overlay-row[data-overlay-metric]");
    const label = button.dataset.metric || row?.dataset.overlayMetric || "metric";
    const value = row?.querySelector(".debug-overlay-value")?.textContent?.trim() || "";
    const entry = this.catalog.getEntry(label);

    button.classList.add("overlay-metric-info-btn-active");
    window.setTimeout(() => {
      if (button.isConnected) button.classList.remove("overlay-metric-info-btn-active");
    }, 180);

    this.inspector.inspect({ label, displayedValue: value, entry });
  }
}

(function initOverlayMetricInspector() {
  if (typeof document === "undefined") return;
  const start = () => {
    const metricInspector = new OverlayMetricInspector();
    metricInspector.start();
    window.CYBER_FISHING_OVERLAY_METRIC_INFO = metricInspector;
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
