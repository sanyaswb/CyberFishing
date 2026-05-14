class TackleStressSystem {
  #rod;
  #reel;
  #lineSystem;
  #config;
  #rng;
  #currentTensionKg = 0;
  #targetTensionKg = 0;
  #tensionRatio = 0;
  #tensionPercent = 0;
  #pulsePhase = 0;
  #currentColor = "rgb(0, 0, 255)";
  #currentStatusLabel = "Idle";
  #currentStatusColor = "#4a5b6c";
  #isBroken = false;
  #breakReason = null;
  #overloadTimerMs = 0;
  #lastBreakProgress = 0;
  #debug = {};

  constructor({ rod, reel, lineSystem, config, rng = null }) {
    this.#config = config || {};
    this.#rng = rng || { next: () => Math.random() };
    this.updateEquipment({ rod, reel, lineSystem });
  }

  updateEquipment({ rod, reel, lineSystem }) {
    this.#rod = rod;
    this.#reel = reel;
    this.#lineSystem = lineSystem;
    this.#refreshRatios();
  }

  updateTarget(tensionKg, dtSec, tensionConfig) {
    if (this.#isBroken) return;
    this.#targetTensionKg = Math.max(0, Number(tensionKg) || 0);
    const smooth = tensionConfig?.kgSmoothPerSecond ?? 18;
    const alpha = 1 - Math.exp(-Math.max(0, smooth) * Math.max(0, dtSec || 0));
    this.#currentTensionKg +=
      (this.#targetTensionKg - this.#currentTensionKg) * alpha;
    this.#refreshRatios();
    this.#evaluateBreak(dtSec, tensionConfig);
    this.#updateVisualStates(tensionConfig);
  }

  setDebugData(data) {
    this.#debug = data || {};
  }

  getDebugData() {
    return {
      ...this.#debug,
      tensionKg: this.#currentTensionKg,
      targetTensionKg: this.#targetTensionKg,
      maxTackleLoadKg: this.getEffectiveMaxTackleLoadKg(),
      tensionRatio: this.#tensionRatio,
      tensionPercent: this.#tensionPercent,
      overloadProgress: this.#lastBreakProgress,
    };
  }

  getEffectiveMaxTackleLoadKg() {
    const values = [
      this.getEffectiveRodMaxLoadKg(),
      this.getEffectiveLineSystemMaxLoadKg(),
    ]
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);

    if (values.length === 0) return 1;

    // The weakest available tackle part defines the safe player/tackle load.
    // Example: rod 10kg + reel/line system 2kg => max load is 2kg.
    return Math.min(...values);
  }

  getEffectiveRodMaxLoadKg() {
    return this.#rod?.getEffectiveMaxLoadKg?.() || 8;
  }

  getEffectiveLineSystemMaxLoadKg() {
    const lineMax = this.#lineSystem?.getEffectiveLineMaxLoadKg?.() || 8;
    const reelMax = this.#reel?.hasReel?.()
      ? this.#reel.getEffectiveMaxLoadKg?.() || lineMax
      : lineMax;
    return this.#reel?.hasReel?.() ? Math.min(lineMax, reelMax) : lineMax;
  }

  getTension() {
    return this.#tensionPercent;
  }

  getTensionKg() {
    return this.#currentTensionKg;
  }

  getCurrentColor() {
    return this.#currentColor;
  }

  getCurrentStatusLabel() {
    return this.#currentStatusLabel;
  }

  getCurrentStatusColor() {
    return this.#currentStatusColor;
  }

  getLineBreakProgress() {
    return this.#lastBreakProgress;
  }

  isBroken() {
    return this.#isBroken;
  }

  getBreakReason() {
    return this.#breakReason;
  }

  getPulseIntensity(tensionConfig) {
    this.#pulsePhase +=
      Math.max(
        1,
        (tensionConfig?.pulseSpeedMax ?? 10) -
          this.#tensionPercent / (tensionConfig?.pulseTensionDivisor ?? 10),
      ) * (tensionConfig?.pulseSpeedBaseMultiplier ?? 0.05);
    if (this.#pulsePhase > Math.PI * 2) this.#pulsePhase -= Math.PI * 2;
    return (
      1 -
      (tensionConfig?.pulseMagnitude ?? 0.5) +
      Math.sin(this.#pulsePhase) * (tensionConfig?.pulseMagnitude ?? 0.5)
    );
  }

  getDragRatio() {
    return this.#debug.dragRatio || 0;
  }

  reset() {
    this.#currentTensionKg = 0;
    this.#targetTensionKg = 0;
    this.#isBroken = false;
    this.#breakReason = null;
    this.#overloadTimerMs = 0;
    this.#lastBreakProgress = 0;
    this.#refreshRatios();
  }

  #refreshRatios() {
    const maxLoad = Math.max(0.001, this.getEffectiveMaxTackleLoadKg());
    this.#tensionRatio = this.#currentTensionKg / maxLoad;
    this.#tensionPercent = Math.max(0, Math.min(100, this.#tensionRatio * 100));
  }

  #evaluateBreak(dtSec, tensionConfig) {
    const maxLoad = this.getEffectiveMaxTackleLoadKg();
    if (this.#currentTensionKg <= maxLoad) {
      this.#overloadTimerMs = 0;
      this.#lastBreakProgress = 0;
      return;
    }

    const graceMs = Math.max(0, tensionConfig?.overloadGraceMs ?? 120);
    this.#overloadTimerMs += Math.max(0, dtSec || 0) * 1000;
    this.#lastBreakProgress =
      graceMs <= 0 ? 1 : Math.min(1, this.#overloadTimerMs / graceMs);
    if (this.#lastBreakProgress >= 1) {
      this.#isBroken = true;
      this.#breakReason = this.#selectBreakReason();
    }
  }

  #selectBreakReason() {
    const rodMax = Math.max(0.001, this.getEffectiveRodMaxLoadKg());
    const lineMax = Math.max(0.001, this.getEffectiveLineSystemMaxLoadKg());
    const weights = [
      { reason: "rod", weight: 1 / rodMax },
      { reason: "line", weight: 1 / lineMax },
    ];

    const reelMax = this.#reel?.hasReel?.()
      ? this.#reel.getEffectiveMaxLoadKg?.() || Infinity
      : Infinity;
    if (Number.isFinite(reelMax) && this.#currentTensionKg > reelMax) {
      weights.push({ reason: "reel", weight: 1 / Math.max(0.001, reelMax) });
    }

    const total = weights.reduce((sum, item) => sum + item.weight, 0);
    let roll =
      (typeof this.#rng.range === "function"
        ? this.#rng.range(0, total)
        : this.#rng.next() * total) || 0;
    for (const item of weights) {
      if (roll <= item.weight) return item.reason;
      roll -= item.weight;
    }
    return "line";
  }

  #updateVisualStates(tensionConfig) {
    const statuses = tensionConfig?.statuses || [
      { threshold: 0, label: "Idle", color: "#4a5b6c" },
      { threshold: 80, label: "CRITICAL", color: "#ff4444" },
    ];
    let status = statuses[0];
    for (let i = statuses.length - 1; i >= 0; i--) {
      if (this.#tensionPercent >= statuses[i].threshold) {
        status = statuses[i];
        break;
      }
    }
    this.#currentStatusLabel = status.label;
    this.#currentStatusColor = status.color;
    this.#currentColor = TackleStressSystem.ratioGradientColor(
      this.#tensionPercent,
      tensionConfig?.colorGradient,
    );
  }

  static ratioGradientColor(value, gradient) {
    if (!gradient) return "#00ccff";
    const tension = Math.max(0, Math.min(100, value));
    const lowPoint = gradient.breakpoints?.low ?? 33;
    const midPoint = gradient.breakpoints?.mid ?? 66;
    const mix = (start, end, ratio) => {
      const t = Math.max(0, Math.min(1, ratio));
      const r = Math.round(start[0] + (end[0] - start[0]) * t);
      const g = Math.round(start[1] + (end[1] - start[1]) * t);
      const b = Math.round(start[2] + (end[2] - start[2]) * t);
      return `rgb(${r}, ${g}, ${b})`;
    };
    if (tension < lowPoint) {
      return mix(
        gradient.low?.start || [0, 0, 255],
        gradient.low?.end || [255, 255, 0],
        tension / lowPoint,
      );
    }
    if (tension < midPoint) {
      return mix(
        gradient.mid?.start || [255, 255, 0],
        gradient.mid?.end || [255, 128, 0],
        (tension - lowPoint) / Math.max(1, midPoint - lowPoint),
      );
    }
    return mix(
      gradient.high?.start || [255, 128, 0],
      gradient.high?.end || [255, 0, 0],
      (tension - midPoint) / Math.max(1, 100 - midPoint),
    );
  }
}
