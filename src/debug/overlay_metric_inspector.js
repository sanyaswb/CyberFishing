class OverlayMetricFormulaCatalog {
  constructor() {
    this.entriesByLabel = new Map(Object.entries({
      "Fish weight": {
        formula: "runtime value: hookedFish.weight",
        description: "Фактична вага поточної підсіченої риби.",
        paths: ["HOOKED_FISH.weight"],
      },
      "Water weight / passive force": {
        formula: "fishPassiveKg = fishWeightKg * tautBodyResistancePerKg * fishBasePower",
        description: "Базова вага риби у воді на натягнутій лісці.",
        paths: [
          "HOOKED_FISH.weight",
          "CONFIG.physics.water.tautBodyResistancePerKg",
          "HOOKED_FISH.physics.forceProfile.basePower",
        ],
      },
      "State force multiplier": {
        formula: "fishActiveKg = fishPassiveKg * stateForceMultiplier * directionMultiplier",
        description: "Множник сили поточного стану риби. Впливає на active fish force і tension.",
        paths: ["HOOKED_FISH.physics.behaviorProfile.behaviors.<state>.forceMultiplier"],
      },
      "Direction multiplier": {
        formula: "directionMultiplier = toward/side/away multiplier from fish direction vs player",
        description: "Множник напрямку руху риби відносно гравця.",
        paths: [
          "CONFIG.physics.fight.directionForce.towardPlayerMultiplier",
          "CONFIG.physics.fight.directionForce.sideMultiplier",
          "CONFIG.physics.fight.directionForce.awayMultiplier",
        ],
      },
      "Active fish force": {
        formula: "fishActiveKg = fishPassiveKg * stateForceMultiplier * directionMultiplier",
        description: "Активна сила риби від стану і напрямку.",
        paths: [
          "HOOKED_FISH.physics.behaviorProfile.behaviors.<state>.forceMultiplier",
          "CONFIG.physics.fight.directionForce",
        ],
      },
      "Fish opposition": {
        formula: "fishOppositionKg = fishPassiveKg + fishActiveKg",
        description: "Сумарна сила риби, яку має перевищити rod hold.",
        paths: ["CONFIG.physics.water.tautBodyResistancePerKg", "CONFIG.physics.fight.directionForce"],
      },
      "Rod hold": {
        formula: "rodHoldKg charges from 0 to rodHoldMaxKg by rodHold.chargeTimeSeconds",
        description: "Повна сила гравця проти риби. Не дорівнює tension.",
        paths: ["CONFIG.physics.fight.rodHold.chargeTimeSeconds"],
      },
      "Rod hold max": {
        formula: "rodHoldMaxKg = max(0, rodLimitKg - fishTensionKg)",
        description: "Скільки hold-сили ще дозволяє вудка.",
        paths: ["HOOKED_FISH.tackle.rod.maxLoadKg", "DEBUG_DATA.fishTensionKg"],
      },
      "Angle multiplier": {
        formula: "effectiveRodHoldKg = rodHoldKg * rodAngleMultiplier",
        description: "Кутовий штраф до сили гравця.",
        paths: ["CONFIG.physics.fight.rodHold.anglePenalty"],
      },
      "Effective rod hold": {
        formula: "effectiveRodHoldKg = rodHoldKg * rodAngleMultiplier",
        description: "Фактична hold-сила гравця проти риби після кутового штрафу.",
        paths: ["CONFIG.physics.fight.rodHold.anglePenalty"],
      },
      "Hold tension ratio": {
        formula: "rawPlayerHoldTensionKg = effectiveRodHoldKg * holdTensionRatio",
        description: "Яка частина hold-сили йде в tension. Менше значення = краща вудка.",
        paths: ["HOOKED_FISH.tackle.rod.holdTensionRatio"],
      },
      "Movable tension cap": {
        formula: "capKg = fishOppositionKg * movableHoldTensionCapRatio",
        description: "Якщо риба може рухатися, hold не може додати в tension більше цього cap.",
        paths: ["DEBUG_DATA.fishOppositionKg", "CONFIG.physics.fight.tension.movableHoldTensionCapRatio"],
      },
      "Hold to tension": {
        formula: "playerHoldTensionKg = fishCanMove ? min(rawHoldTension, capKg) : rawHoldTension",
        description: "Частина hold-сили, яка реально навантажує снасть.",
        paths: ["CONFIG.physics.fight.tension.movableHoldTensionCapRatio"],
      },
      "Net force": {
        formula: "fishWonForceKg = max(0, fishOppositionKg - effectiveRodHoldKg)",
        description: "Чиста різниця сил. >0 перемагає гравець, <0 перемагає риба.",
        paths: ["DEBUG_DATA.effectiveRodHoldKg", "DEBUG_DATA.fishOppositionKg"],
      },
      "Winner": {
        formula: "winner = sign(effectiveRodHoldKg - fishOppositionKg)",
        description: "Хто зараз рухає систему: player/fish/balanced.",
        paths: ["DEBUG_DATA.netForceKg"],
      },
      "Water resistance": {
        formula: "escapeSpeed = sqrt(fishWonForceKg / waterMotionResistance) * waterSpeedMultiplier",
        description: "Глобальний уповільнювач руху у воді.",
        paths: ["CONFIG.physics.water.motionResistance"],
      },
      "Speed multiplier": {
        formula: "speedMps = sqrt(abs(netForceKg) / motionResistance) * waterSpeedMultiplier",
        description: "Ігровий множник швидкості після опору води.",
        paths: ["CONFIG.physics.water.speedMultiplier"],
      },
      "Speed m/s": {
        formula: "speedMps is calculated from netForceKg and water settings",
        description: "Фінальна швидкість руху у метрах за секунду.",
        paths: ["DEBUG_DATA.netForceKg", "CONFIG.physics.water.motionResistance", "CONFIG.physics.water.speedMultiplier"],
      },
      "Speed px/s": {
        formula: "speedPxPerSecond = speedMps * pixelsPerMeter",
        description: "Canvas-швидкість руху.",
        paths: ["CONFIG.physics.simulation.pixelsPerMeter"],
      },
      "Fish tension": {
        formula: "fishTensionKg = lineSlack ? 0 : fishOppositionKg",
        description: "Натяг, який створює риба.",
        paths: ["DEBUG_DATA.fishOppositionKg"],
      },
      "Player tension": {
        formula: "playerHoldTensionKg = capped hold tension contribution",
        description: "Натяг, який створює hold гравця.",
        paths: ["DEBUG_DATA.playerHoldTensionKg"],
      },
      "Total tension": {
        formula: "totalTensionKg = fishTensionKg + playerHoldTensionKg",
        description: "Фінальне навантаження на снасть.",
        paths: ["DEBUG_DATA.fishTensionKg", "DEBUG_DATA.playerHoldTensionKg"],
      },
      "Rod stress": {
        formula: "rodStressRatio = totalTensionKg / rodLimitKg",
        description: "Відсоток навантаження на вудку.",
        paths: ["DEBUG_DATA.totalTensionKg", "DEBUG_DATA.rodMaxLoadKg"],
      },
      "Line stress": {
        formula: "lineStressRatio = totalTensionKg / lineLimitKg",
        description: "Відсоток навантаження на ліску.",
        paths: ["DEBUG_DATA.totalTensionKg", "DEBUG_DATA.lineMaxLoadKg"],
      },
      "Hook stress": {
        formula: "hookStressRatio = totalTensionKg / hookLimitKg",
        description: "Відсоток навантаження на гачок.",
        paths: ["DEBUG_DATA.totalTensionKg", "DEBUG_DATA.hookMaxLoadKg"],
      },
      "Reel hold active": {
        formula: "reelHoldActive = rodStrokeIsFull && playerIsHolding && reelSafeMarginKg > 0",
        description: "Підмотка катушкою після повного ходу вудки.",
        paths: ["DEBUG_DATA.holdReelRecoverActive"],
      },
      "Reel safe margin": {
        formula: "reelSafeMarginKg = reelHoldLimitKg - totalTensionKg",
        description: "Запас катушки для безпечної підмотки.",
        paths: ["DEBUG_DATA.holdReelRecoverReelMaxLoadKg", "DEBUG_DATA.totalTensionKg"],
      },
      "Reel retrieve speed": {
        formula: "reelRetrieveSpeedMps = baseReelRetrieveSpeedMps * clamp01(reelSafeMarginKg / reelHoldLimitKg) * bearingBonus",
        description: "Швидкість підмотки катушкою у reelHold.",
        paths: ["DEBUG_DATA.holdReelRecoverSpeedMps"],
      },
      "Reel blocked reason": {
        formula: "blocked reason explains why reelHold is not active",
        description: "Причина, чому підмотка катушкою зараз не працює.",
        paths: ["DEBUG_DATA.holdReelRecoverBlockedReason"],
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

    console.groupCollapsed(`%c[Overlay metric] ${normalizedLabel}`, "color:#73c2fb;font-weight:bold;");
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
    if (path.includes("<state>")) return { found: false, reason: "state-specific path" };
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
      case "CONFIG": return typeof CONFIG !== "undefined" ? CONFIG : undefined;
      case "BASE_CONFIG": return typeof BASE_CONFIG !== "undefined" ? BASE_CONFIG : undefined;
      case "HOOKED_FISH": return this.#liveData?.hookedFish || undefined;
      case "DEBUG_DATA": return this.#liveData;
      default: return undefined;
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
    try { return JSON.stringify(value); } catch (_error) { return String(value); }
  }

  #buildSmallSnapshot() {
    const keys = [
      "fishPassiveKg", "fishActiveKg", "fishOppositionKg", "fishTensionKg",
      "rodPullForceKg", "effectiveRodHoldKg", "holdTensionRatio", "playerHoldTensionKg",
      "movableHoldTensionCapKg", "totalTensionKg", "netForceKg", "simpleFightSpeedMps",
      "rodStressRatio", "lineStressRatio", "hookStressRatio", "holdReelRecoverActive",
      "holdReelRecoverBlockedReason", "holdReelRecoverSpeedMps",
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
  constructor({ catalog = new OverlayMetricFormulaCatalog(), inspector = new OverlayMetricConsoleInspector() } = {}) {
    this.catalog = catalog;
    this.inspector = inspector;
  }

  start() {
    this.installStyles();
    this.listenForDebugData();
    const content = document.querySelector(".debug-overlay-content");
    (content || document).addEventListener("pointerdown", (event) => this.handlePointerDown(event), true);
    (content || document).addEventListener("click", (event) => this.handleClick(event), true);
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
    const row = button.closest(".debug-overlay-row");
    const label = button.dataset.metric || "metric";
    const value = row?.querySelector(".debug-overlay-value")?.textContent?.trim() || "";
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
      .debug-overlay-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        margin-bottom: 2px;
      }
      .debug-overlay-label {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        min-height: 16px;
        line-height: 1.2;
      }
      .debug-overlay-value {
        text-align: right;
        white-space: nowrap;
      }
      .overlay-metric-info-btn {
        width: 14px;
        height: 14px;
        min-width: 14px;
        flex: 0 0 14px;
        padding: 0;
        border-radius: 4px;
        border: 1px solid rgba(115, 194, 251, 0.9);
        background: rgba(115, 194, 251, 0.12);
        box-shadow: 0 0 5px rgba(115, 194, 251, 0.35);
        cursor: pointer;
        pointer-events: auto;
        touch-action: none;
        box-sizing: border-box;
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
