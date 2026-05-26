class TackleStressSystem {
  #rod;
  #reel;
  #lineSystem;
  #hook;
  #leader;
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
  #breakInfo = null;
  #overloadTimerMs = 0;
  #lastBreakProgress = 0;
  #preventedBreakReason = null;
  #debug = {};
  #devFlags;

  constructor({ rod, reel, lineSystem, hook = null, leader = null, config, rng = null, devFlags = null }) {
    this.#config = config || {};
    this.#rng = rng || { next: () => Math.random() };
    this.#devFlags = devFlags;
    this.updateEquipment({ rod, reel, lineSystem, hook, leader });
  }

  updateEquipment({ rod, reel, lineSystem, hook = null, leader = null }) {
    this.#rod = rod;
    this.#reel = reel;
    this.#lineSystem = lineSystem;
    this.#hook = hook;
    this.#leader = leader;
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
      rodMaxLoadKg: this.getEffectiveRodMaxLoadKg(),
      lineMaxLoadKg: this.getEffectiveLineSystemMaxLoadKg(),
      hookMaxLoadKg: this.getEffectiveHookMaxLoadKg(),
      leaderMaxLoadKg: this.getEffectiveLeaderMaxLoadKg(),
      reelMaxLoadKg: this.getEffectiveReelMaxLoadKg(),
      rodStressRatio: this.#stressRatio(this.#currentTensionKg, this.getEffectiveRodMaxLoadKg()),
      lineStressRatio: this.#stressRatio(this.#currentTensionKg, this.getEffectiveLineSystemMaxLoadKg()),
      hookStressRatio: this.#stressRatio(this.#currentTensionKg, this.getEffectiveHookMaxLoadKg()),
      tensionRatio: this.#tensionRatio,
      tensionPercent: this.#tensionPercent,
      overloadProgress: this.#lastBreakProgress,
      breakPrevented: this.#preventedBreakReason !== null,
      preventedBreakReason: this.#preventedBreakReason,
      breakInfo: this.#breakInfo,
    };
  }

  getEffectiveMaxTackleLoadKg() {
    const values = [
      this.getEffectiveRodMaxLoadKg(),
      this.getEffectiveLineSystemMaxLoadKg(),
      this.getEffectiveLeaderMaxLoadKg(),
    ]
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);

    if (values.length === 0) return 1;

    // Reel load is deliberately not a breakable limit. A weak reel loses drag
    // authority; the breakable failure still belongs to rod, main line or leader.
    return Math.min(...values);
  }

  getEffectiveRodMaxLoadKg() {
    return this.#rod?.getEffectiveMaxLoadKg?.() || 8;
  }

  getEffectiveLineSystemMaxLoadKg() {
    return this.#lineSystem?.getEffectiveLineMaxLoadKg?.() || 8;
  }

  getEffectiveLeaderMaxLoadKg() {
    if (!this.#leader) return Infinity;
    return TackleStressSystem.effectiveItemMaxLoadKg(this.#leader, Infinity);
  }

  getEffectiveHookMaxLoadKg() {
    if (!this.#hook) return Infinity;
    return (
      this.#hook.getEffectiveMaxLoadKg?.() ||
      this.#hook.getMaxLoadKg?.() ||
      TackleStressSystem.effectiveItemMaxLoadKg(this.#hook, Infinity)
    );
  }

  getEffectiveReelMaxLoadKg() {
    if (!this.#reel?.hasReel?.()) return Infinity;
    return this.#reel.getEffectiveMaxLoadKg?.() || this.#reel.getMaxLoadKg?.() || Infinity;
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

  getBreakInfo() {
    return this.#breakInfo || { reason: this.#breakReason };
  }

  getBreakTargetReason() {
    return this.#breakReason || this.#selectBreakReason();
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
    this.#breakInfo = null;
    this.#overloadTimerMs = 0;
    this.#lastBreakProgress = 0;
    this.#preventedBreakReason = null;
    this.#refreshRatios();
  }

  #refreshRatios() {
    const maxLoad = Math.max(0.001, this.getEffectiveMaxTackleLoadKg());
    this.#tensionRatio = this.#currentTensionKg / maxLoad;
    this.#tensionPercent = Math.max(0, Math.min(100, this.#tensionRatio * 100));
  }

  #evaluateBreak(dtSec, tensionConfig) {
    const maxLoad = this.getEffectiveMaxTackleLoadKg();
    const epsilon = Math.max(0, tensionConfig?.breakEpsilonKg ?? 0.0001);
    const currentAtFailure = this.#currentTensionKg >= maxLoad - epsilon;
    const targetAtFailure = this.#targetTensionKg >= maxLoad - epsilon;
    if (!currentAtFailure && !targetAtFailure) {
      this.#overloadTimerMs = 0;
      this.#lastBreakProgress = 0;
      this.#preventedBreakReason = null;
      return;
    }

    const graceMs = Math.max(0, tensionConfig?.overloadGraceMs ?? 0);
    this.#overloadTimerMs += Math.max(0, dtSec || 0) * 1000;
    this.#lastBreakProgress =
      graceMs <= 0 ? 1 : Math.min(1, this.#overloadTimerMs / graceMs);
    if (this.#lastBreakProgress >= 1) {
      const breakReason = this.#selectBreakReason();
      if (this.#isBreakPrevented(breakReason)) {
        this.#preventedBreakReason = breakReason;
        this.#overloadTimerMs = 0;
        this.#lastBreakProgress = 0;
        return;
      }
      this.#isBroken = true;
      this.#breakReason = breakReason;
      this.#breakInfo = this.#createBreakInfo(this.#breakReason);
    }
  }

  #isBreakPrevented(reason) {
    if (reason === "rod") return this.#devFlags?.isEnabled?.("noRodBreak") === true;
    if (reason === "line" || reason === "leader") {
      return this.#devFlags?.isEnabled?.("noLineBreak") === true;
    }
    return false;
  }

  #selectBreakReason() {
    const candidates = [
      { reason: "rod", maxLoadKg: this.getEffectiveRodMaxLoadKg() },
      { reason: "line", maxLoadKg: this.getEffectiveLineSystemMaxLoadKg() },
      { reason: "hook", maxLoadKg: this.getEffectiveHookMaxLoadKg() },
      { reason: "leader", maxLoadKg: this.getEffectiveLeaderMaxLoadKg() },
    ]
      .filter((item) => Number.isFinite(item.maxLoadKg) && item.maxLoadKg > 0)
      .sort((a, b) => a.maxLoadKg - b.maxLoadKg);

    return candidates[0]?.reason || "line";
  }

  #createBreakInfo(reason) {
    const info = {
      reason,
      tensionKg: this.#currentTensionKg,
      rodMaxLoadKg: this.getEffectiveRodMaxLoadKg(),
      lineMaxLoadKg: this.getEffectiveLineSystemMaxLoadKg(),
      hookMaxLoadKg: this.getEffectiveHookMaxLoadKg(),
      leaderMaxLoadKg: this.getEffectiveLeaderMaxLoadKg(),
      reelMaxLoadKg: this.getEffectiveReelMaxLoadKg(),
      lineLossMeters: 0,
    };

    if (reason === "line") {
      info.lineLossMeters = this.#lineSystem?.calculateBreakLossMeters?.({
        rng: this.#rng,
      }) || 0;
    }

    return info;
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

  #stressRatio(tensionKg, limitKg) {
    const limit = Number(limitKg);
    if (!Number.isFinite(limit) || limit <= 0) return 0;
    return Math.max(0, Number(tensionKg) || 0) / limit;
  }

  static effectiveItemMaxLoadKg(item, fallback = 0) {
    if (!item) return fallback;
    const maxLoadKg = Number(item.maxLoadKg ?? item.engineStats?.maxLoadKg ?? fallback);
    const durability = Number(item.durability ?? item.engineStats?.durability ?? 100);
    const lossPerPercent = Number(
      item.durabilityMaxLoadLossPerPercent ??
        item.engineStats?.durabilityMaxLoadLossPerPercent ??
        0.001,
    );
    if (!Number.isFinite(maxLoadKg) || maxLoadKg <= 0) return fallback;
    const lostPercent = Math.max(0, 100 - (Number.isFinite(durability) ? durability : 100));
    return maxLoadKg * Math.max(0.1, 1 - lostPercent * lossPerPercent);
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
