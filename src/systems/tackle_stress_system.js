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
  #effectiveTensionKg = 0;
  #tensionRatio = 0;
  #tensionPercent = 0;
  #pulsePhase = 0;
  #currentColor = "rgb(0, 0, 255)";
  #currentStatusLabel = "Idle";
  #currentStatusColor = "#4a5b6c";
  #isBroken = false;
  #breakReason = null;
  #breakInfo = null;
  #lastBreakProgress = 0;
  #preventedBreakReason = null;
  #debug = {};
  #devFlags;
  #accumulator;
  #failureSelector;
  #stressDebug = {};
  #selectedFailureComponent = null;

  constructor({ rod, reel, lineSystem, hook = null, leader = null, config, rng = null, devFlags = null }) {
    this.#config = config || {};
    this.#rng = rng || { next: () => Math.random() };
    this.#devFlags = devFlags;
    this.#accumulator = new TackleStressAccumulator();
    this.#failureSelector = new TackleFailureSelector();
    this.updateEquipment({ rod, reel, lineSystem, hook, leader });
  }

  updateEquipment({ rod, reel, lineSystem, hook = null, leader = null }) {
    this.#rod = rod;
    this.#reel = reel;
    this.#lineSystem = lineSystem;
    this.#hook = hook;
    this.#leader = leader;
    this.resetStress();
    this.#refreshRatios();
  }

  updateTarget(tensionKg, dtSec, tensionConfig) {
    return this.updateTensionFrame({
      visibleTensionKg: tensionKg,
      totalTensionKg: tensionKg,
      fishTensionKg: tensionKg,
      dtSec,
      tensionConfig,
    });
  }

  updateTensionFrame({
    visibleTensionKg,
    tensionKg,
    totalTensionKg,
    rawTotalTensionKg,
    rawTensionKg,
    fishTensionKg,
    dtSec,
    tensionConfig,
  } = {}) {
    if (this.#isBroken) return this.#frameResult();
    const config = tensionConfig || this.#config || {};
    this.#targetTensionKg = this.#safeNumber(
      visibleTensionKg,
      this.#safeNumber(tensionKg, 0),
    );
    const smooth = config?.kgSmoothPerSecond ?? 18;
    const dt = this.#safeNumber(dtSec, 0);
    const alpha = 1 - Math.exp(-Math.max(0, smooth) * Math.max(0, dt));
    this.#currentTensionKg +=
      (this.#targetTensionKg - this.#currentTensionKg) * alpha;
    this.#refreshRatios();

    const stressConfig = this.#resolveTackleStressConfig(config);
    this.#effectiveTensionKg = Math.max(
      this.#safeNumber(totalTensionKg, this.#targetTensionKg),
      this.#safeNumber(rawTotalTensionKg, 0),
      this.#safeNumber(rawTensionKg, 0),
      this.#safeNumber(fishTensionKg, 0),
    );
    this.#selectedFailureComponent = this.#selectFailureComponent();

    if (stressConfig.enabled !== false) {
      const stressFrame = this.#accumulator.update({
        effectiveTensionKg: this.#effectiveTensionKg,
        mainTackleLimitKg: this.getEffectiveMaxTackleLoadKg(),
        dtSec: dt,
        config: stressConfig,
        rng: this.#rng,
      });
      this.#stressDebug = stressFrame;
      this.#lastBreakProgress = stressFrame.stressRatio || 0;
      if (stressFrame.failureTriggered) {
        this.#triggerTackleFailure({
          guaranteed: stressFrame.guaranteed,
          stressFrame,
        });
      } else {
        this.#preventedBreakReason = null;
      }
    } else {
      this.#stressDebug = this.#accumulator.getDebugData(
        this.#stressDebugDefaults(stressConfig),
      );
      this.#lastBreakProgress = 0;
    }

    this.#updateVisualStates(config);
    return this.#frameResult();
  }

  setDebugData(data) {
    this.#debug = data || {};
  }

  getDebugData() {
    const stressConfig = this.#resolveTackleStressConfig(this.#config);
    const selected = this.#selectedFailureComponent || this.#selectFailureComponent();
    return {
      ...this.#debug,
      tensionKg: this.#currentTensionKg,
      targetTensionKg: this.#targetTensionKg,
      visibleTensionKg: this.#currentTensionKg,
      currentTensionKg: this.#currentTensionKg,
      effectiveTensionKg: this.#effectiveTensionKg,
      maxTackleLoadKg: this.getEffectiveMaxTackleLoadKg(),
      mainTackleLimitKg: this.getEffectiveMaxTackleLoadKg(),
      rodMaxLoadKg: this.getEffectiveRodMaxLoadKg(),
      lineMaxLoadKg: this.getEffectiveLineSystemMaxLoadKg(),
      hookMaxLoadKg: this.getEffectiveHookMaxLoadKg(),
      leaderMaxLoadKg: this.getEffectiveLeaderMaxLoadKg(),
      reelMaxLoadKg: this.getEffectiveReelMaxLoadKg(),
      rodStressRatio: this.#stressRatio(this.#effectiveTensionKg, this.getEffectiveRodMaxLoadKg()),
      lineStressRatio: this.#stressRatio(this.#effectiveTensionKg, this.getEffectiveLineSystemMaxLoadKg()),
      hookStressRatio: this.#stressRatio(this.#effectiveTensionKg, this.getEffectiveHookMaxLoadKg()),
      tensionRatio: this.#tensionRatio,
      tensionPercent: this.#tensionPercent,
      mainTensionRatio: this.#tensionRatio,
      mainTensionPercent: this.#tensionPercent,
      overloadProgress: this.#lastBreakProgress,
      breakPrevented: this.#preventedBreakReason !== null,
      preventedBreakReason: this.#preventedBreakReason,
      breakInfo: this.#breakInfo,
      ...this.#stressDebugWithDefaults(stressConfig),
      selectedFailureComponent: selected.component,
      selectedFailureResult: selected.result,
      failureTieBreakPriority: selected.tieBreakPriority,
      tieBreakPriority: selected.tieBreakPriority,
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

  getStressTension() {
    return Math.max(0, Math.min(100, (this.#stressDebug?.stressRatio || 0) * 100));
  }

  getStressRatio() {
    return Math.max(0, Math.min(1, this.#stressDebug?.stressRatio || 0));
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

  getBreakResult() {
    return this.#breakInfo?.result || null;
  }

  getBreakTargetReason() {
    return this.#breakReason || this.#selectFailureComponent().reason;
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
    this.#effectiveTensionKg = 0;
    this.#isBroken = false;
    this.#breakReason = null;
    this.#breakInfo = null;
    this.#preventedBreakReason = null;
    this.#selectedFailureComponent = null;
    this.resetStress();
    this.#refreshRatios();
  }

  resetStress() {
    this.#accumulator?.reset?.();
    const stressConfig = this.#resolveTackleStressConfig(this.#config);
    this.#stressDebug = this.#accumulator?.getDebugData?.(
      this.#stressDebugDefaults(stressConfig),
    ) || {};
    this.#lastBreakProgress = 0;
  }

  #refreshRatios() {
    const maxLoad = Math.max(0.001, this.getEffectiveMaxTackleLoadKg());
    this.#tensionRatio = this.#currentTensionKg / maxLoad;
    this.#tensionPercent = Math.max(0, Math.min(100, this.#tensionRatio * 100));
  }

  #triggerTackleFailure({ guaranteed, stressFrame }) {
    const selected = this.#selectFailureComponent();
    if (this.#isBreakPrevented(selected.reason)) {
      this.#preventedBreakReason = selected.reason;
      this.resetStress();
      return;
    }

    this.#isBroken = true;
    this.#breakReason = selected.reason;
    this.#breakInfo = this.#createBreakInfo({
      selected,
      guaranteed,
      stressFrame,
    });
    this.resetStress();
  }

  #frameResult() {
    return {
      failed: this.#isBroken,
      component: this.#breakInfo?.failureComponent || this.#breakReason || null,
      result: this.#breakInfo?.result || null,
      stressRatio: this.getStressRatio(),
      failureChance: this.#stressDebug?.failureChance || 0,
      failureSource: this.#breakInfo?.failureSource ||
        this.#stressDebug?.failureSource ||
        null,
      guaranteedFailure: !!(
        this.#breakInfo?.guaranteed ||
        this.#stressDebug?.guaranteedFailure
      ),
    };
  }

  #isBreakPrevented(reason) {
    if (reason === "rod") return this.#devFlags?.isEnabled?.("noRodBreak") === true;
    if (reason === "line" || reason === "leader") {
      return this.#devFlags?.isEnabled?.("noLineBreak") === true;
    }
    return false;
  }

  #selectFailureComponent() {
    const stressConfig = this.#resolveTackleStressConfig(this.#config);
    return this.#failureSelector.select({
      leaderMaxLoadKg: this.getEffectiveLeaderMaxLoadKg(),
      lineMaxLoadKg: this.getEffectiveLineSystemMaxLoadKg(),
      rodMaxLoadKg: this.getEffectiveRodMaxLoadKg(),
      tieBreakPriority: stressConfig.failureSelection?.tieBreakPriority,
    });
  }

  #createBreakInfo({ selected, guaranteed, stressFrame }) {
    const info = {
      reason: selected.reason,
      result: selected.result,
      failureComponent: selected.component,
      component: selected.component,
      guaranteed: !!guaranteed,
      failureSource: stressFrame?.failureSource ||
        (guaranteed ? "guaranteed" : "roll"),
      tensionKg: this.#currentTensionKg,
      effectiveTensionKg: this.#effectiveTensionKg,
      mainTackleLimitKg: this.getEffectiveMaxTackleLoadKg(),
      stressRatio: stressFrame?.stressRatio || 0,
      failureChance: stressFrame?.failureChance || 0,
      lastRollValue: stressFrame?.lastRollValue ?? null,
      lastRollPassed: !!stressFrame?.lastRollPassed,
      rodMaxLoadKg: this.getEffectiveRodMaxLoadKg(),
      lineMaxLoadKg: this.getEffectiveLineSystemMaxLoadKg(),
      leaderMaxLoadKg: this.getEffectiveLeaderMaxLoadKg(),
      reelMaxLoadKg: this.getEffectiveReelMaxLoadKg(),
      tieBreakPriority: selected.tieBreakPriority,
      lineLossMeters: 0,
    };

    if (selected.reason === "line") {
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

  #resolveTackleStressConfig(tensionConfig) {
    const raw = tensionConfig?.tackleStress || {};
    return {
      enabled: raw.enabled !== false,
      stress: {
        capacity: 1.0,
        baseGainPerSecond: 0.45,
        recoveryPerSecond: 0.35,
        minStressToRoll: 0.01,
        ...(raw.stress || {}),
      },
      failureRoll: {
        intervalMs: 500,
        chanceScale: 1.0,
        ...(raw.failureRoll || {}),
      },
      failureSelection: {
        tieBreakPriority: ["leader", "line", "rod"],
        ...(raw.failureSelection || {}),
      },
    };
  }

  #stressDebugDefaults(stressConfig) {
    return {
      capacity: stressConfig?.stress?.capacity ?? 1,
      recoveryPerSecond: stressConfig?.stress?.recoveryPerSecond ?? 0.35,
      intervalMs: stressConfig?.failureRoll?.intervalMs ?? 500,
    };
  }

  #stressDebugWithDefaults(stressConfig) {
    const defaults = this.#stressDebugDefaults(stressConfig);
    return {
      ...this.#accumulator.getDebugData(defaults),
      ...this.#stressDebug,
    };
  }

  #stressRatio(tensionKg, limitKg) {
    const limit = Number(limitKg);
    if (!Number.isFinite(limit) || limit <= 0) return 0;
    return Math.max(0, Number(tensionKg) || 0) / limit;
  }

  #safeNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
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
