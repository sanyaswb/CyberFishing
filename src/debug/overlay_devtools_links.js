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

class OverlayMetricInfoBridge {
  constructor({
    catalog = new OverlayMetricFormulaCatalog(),
    inspector = new OverlayMetricConsoleInspector(),
  } = {}) {
    this.catalog = catalog;
    this.inspector = inspector;
    this.decorateQueued = false;
  }

  start() {
    this.installStyles();
    this.observeOverlayChanges();
    this.listenForDebugData();
    document.addEventListener("pointerdown", (event) => this.handlePointerDown(event), true);
    document.addEventListener("click", (event) => this.handleClick(event), true);
    this.queueDecorate();
  }

  listenForDebugData() {
    document.addEventListener("debug-live-update", (event) => {
      this.inspector.updateLiveData(event.detail || {});
    });
  }

  observeOverlayChanges() {
    const observer = new MutationObserver(() => this.queueDecorate());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  queueDecorate() {
    if (this.decorateQueued) return;
    this.decorateQueued = true;
    window.requestAnimationFrame(() => {
      this.decorateQueued = false;
      this.decorateRows();
    });
  }

  decorateRows() {
    const rows = [...document.querySelectorAll("div[style*='justify-content:space-between']")];
    for (const row of rows) this.decorateRow(row);
  }

  decorateRow(row) {
    if (row.querySelector(".overlay-metric-info-btn")) return;

    const labelElement = row.querySelector("span:first-child");
    if (!labelElement) return;

    const label = this.extractLabel(labelElement.textContent);
    const entry = this.catalog.getEntry(label);
    if (!entry) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "overlay-metric-info-btn";
    button.textContent = "";
    button.dataset.metric = this.catalog.normalizeLabel(label);
    button.title = this.buildButtonTitle(label, entry);
    button.setAttribute("aria-label", `Пояснити формулу для ${label}`);

    labelElement.classList.add("overlay-metric-linked-label");
    labelElement.prepend(button);
  }

  extractLabel(text) {
    return String(text || "").replace(/[：:]+\s*$/u, "").trim();
  }

  buildButtonTitle(label, entry) {
    return [
      `Console info: ${label}`,
      entry.formula || "Formula not documented",
      ...(entry.paths || []),
    ].join("\n");
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
    const row = button.closest("div[style*='justify-content:space-between']");
    const label = button.dataset.metric || "metric";
    const value = row?.querySelector("span:last-child")?.textContent?.trim() || "";
    const entry = this.catalog.getEntry(label);

    button.classList.add("overlay-metric-info-btn-active");
    window.setTimeout(() => {
      if (button.isConnected) button.classList.remove("overlay-metric-info-btn-active");
    }, 180);

    this.inspector.inspect({ label, displayedValue: value, entry });
  }

  installStyles() {
    if (document.getElementById("overlay-metric-info-styles")) return;
    const style = document.createElement("style");
    style.id = "overlay-metric-info-styles";
    style.textContent = `
      .overlay-metric-linked-label {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        position: relative;
        min-height: 16px;
        line-height: 1.2;
      }
      .overlay-metric-info-btn {
        width: 14px;
        height: 14px;
        min-width: 14px;
        flex: 0 0 14px;
        box-sizing: border-box;
        padding: 0;
        border-radius: 4px;
        border: 1px solid rgba(115, 194, 251, 0.9);
        background: rgba(115, 194, 251, 0.12);
        box-shadow: 0 0 5px rgba(115, 194, 251, 0.35);
        cursor: pointer;
        pointer-events: auto;
        touch-action: none;
        transform: translateZ(0);
        transition: none;
        outline: none;
        -webkit-tap-highlight-color: transparent;
      }
      .overlay-metric-info-btn:hover {
        background: rgba(115, 194, 251, 0.12);
        border-color: rgba(115, 194, 251, 0.9);
        box-shadow: 0 0 5px rgba(115, 194, 251, 0.35);
      }
      .overlay-metric-info-btn-active,
      .overlay-metric-info-btn:active {
        background: rgba(255, 255, 255, 0.85);
        border-color: #ffffff;
        box-shadow: 0 0 8px rgba(255, 255, 255, 0.9);
      }
    `;
    document.head.appendChild(style);
  }
}

(function initOverlayMetricInfoBridge() {
  if (typeof document === "undefined") return;
  const start = () => {
    const bridge = new OverlayMetricInfoBridge();
    bridge.start();
    window.CYBER_FISHING_OVERLAY_METRIC_INFO = bridge;
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
