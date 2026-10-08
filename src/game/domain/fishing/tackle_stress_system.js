import { TackleFailureSelector } from "./tackle_failure_selector.js";
import { TackleStressAccumulator } from "./tackle_stress_accumulator.js";
import { WeakestTackleLimitResolver } from "./weakest_tackle_limit_resolver.js";
import { finiteOr } from "../../../engine/math/number_normalization.js";
import { durabilityAdjustedMaxLoadKg } from "../items/condition/durability_max_load.js";

export class TackleStressSystem {
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
  #tensionStressSource = "raw";
  #tensionRatio = 0;
  #tensionPercent = 0;
  #pulsePhase = 0;
  #isBroken = false;
  #breakReason = null;
  #breakInfo = null;
  #lastBreakProgress = 0;
  #preventedBreakReason = null;
  #diagnostics = {};
  #fightFrame = {};
  #devFlags;
  #accumulator;
  #failureSelector;
  #weakestLimitResolver;
  #stressDiagnostics = {};
  #selectedFailureComponent = null;

  constructor({ rod, reel, lineSystem, hook = null, leader = null, config, rng = null, devFlags = null, weakestLimitResolver = null }) {
    this.#config = config || {};
    this.#rng = rng || { next: () => Math.random() };
    this.#devFlags = devFlags;
    this.#accumulator = new TackleStressAccumulator();
    this.#failureSelector = new TackleFailureSelector();
    this.#weakestLimitResolver =
      weakestLimitResolver || new WeakestTackleLimitResolver();
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
    tensionStressSource = "raw",
    dtSec,
    tensionConfig,
  } = {}) {
    if (this.#isBroken) return this.#frameResult();
    const config = tensionConfig || this.#config || {};
    this.#targetTensionKg = finiteOr(
      visibleTensionKg,
      finiteOr(tensionKg, 0),
    );
    const smooth = config?.kgSmoothPerSecond ?? 18;
    const dt = finiteOr(dtSec, 0);
    const alpha = 1 - Math.exp(-Math.max(0, smooth) * Math.max(0, dt));
    this.#currentTensionKg +=
      (this.#targetTensionKg - this.#currentTensionKg) * alpha;
    this.#refreshRatios();

    const stressConfig = this.#resolveTackleStressConfig(config);
    this.#tensionStressSource =
      tensionStressSource === "visible" ? "visible" : "raw";
    this.#effectiveTensionKg = this.#tensionStressSource === "visible"
      ? Math.max(
          this.#targetTensionKg,
          finiteOr(totalTensionKg, this.#targetTensionKg),
        )
      : Math.max(
          finiteOr(totalTensionKg, this.#targetTensionKg),
          finiteOr(rawTotalTensionKg, 0),
          finiteOr(rawTensionKg, 0),
          finiteOr(fishTensionKg, 0),
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
      this.#stressDiagnostics = stressFrame;
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
      this.#stressDiagnostics = this.#accumulator.getDiagnostics(
        this.#stressDiagnosticsDefaults(stressConfig),
      );
      this.#lastBreakProgress = 0;
    }

    return this.#frameResult();
  }

  setDiagnostics(data) {
    this.#diagnostics = data || {};
  }

  setFightFrame(frame) {
    this.#fightFrame = frame || {};
  }

  // The orchestrator's fight frame with the tension and load values that override it in getDiagnostics (same
  // expressions), refreshed on every read. Gameplay, HUD and render read this instead of the DEV diagnostics.
  getFightFrame() {
    const frame = this.#fightFrame;
    frame.tensionKg = this.#currentTensionKg;
    frame.targetTensionKg = this.#targetTensionKg;
    frame.visibleTensionKg = this.#currentTensionKg;
    frame.maxTackleLoadKg = this.getEffectiveMaxTackleLoadKg();
    frame.rodMaxLoadKg = this.getEffectiveRodMaxLoadKg();
    frame.rodStressRatio = this.#stressRatio(this.#effectiveTensionKg, frame.rodMaxLoadKg);
    frame.lineStressRatio = this.#stressRatio(this.#effectiveTensionKg, this.getEffectiveLineSystemMaxLoadKg());
    frame.hookStressRatio = this.#stressRatio(this.#effectiveTensionKg, this.getEffectiveHookMaxLoadKg());
    return frame;
  }

  getDiagnostics() {
    const stressConfig = this.#resolveTackleStressConfig(this.#config);
    const selected = this.#selectedFailureComponent || this.#selectFailureComponent();
    const weakestLimit = this.getWeakestTackleLimitFrame();
    return {
      ...this.#diagnostics,
      tensionKg: this.#currentTensionKg,
      targetTensionKg: this.#targetTensionKg,
      visibleTensionKg: this.#currentTensionKg,
      currentTensionKg: this.#currentTensionKg,
      effectiveTensionKg: this.#effectiveTensionKg,
      tensionStressSource: this.#tensionStressSource,
      weakestTackleLimitComponent: weakestLimit.component,
      weakestTackleLimitKg: weakestLimit.weakestTackleLimitKg,
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
      ...this.#stressDiagnosticsWithDefaults(stressConfig),
      selectedFailureComponent: selected.component,
      selectedFailureResult: selected.result,
      failureTieBreakPriority: selected.tieBreakPriority,
      tieBreakPriority: selected.tieBreakPriority,
    };
  }

  getEffectiveMaxTackleLoadKg() {
    return this.getWeakestTackleLimitFrame().weakestTackleLimitKg;
  }

  getWeakestTackleLimitFrame() {
    if (this.#weakestLimitResolver?.resolve) {
      return this.#weakestLimitResolver.resolve({
        rod: this.#rod,
        reel: this.#reel,
        lineSystem: this.#lineSystem,
        leader: this.#leader,
        hook: this.#hook,
      });
    }

    const values = [
      this.getEffectiveRodMaxLoadKg(),
      this.getEffectiveLineSystemMaxLoadKg(),
      this.getEffectiveLeaderMaxLoadKg(),
      this.getEffectiveHookMaxLoadKg(),
      this.getEffectiveReelMaxLoadKg(),
    ]
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);

    return Object.freeze({
      weakestTackleLimitKg: values.length > 0 ? Math.min(...values) : 1,
      component: "fallback",
      candidates: Object.freeze([]),
    });
  }

  getEffectiveRodMaxLoadKg() {
    return this.#rod?.getEffectiveMaxLoadKg?.() || 8;
  }

  getEffectiveLineSystemMaxLoadKg() {
    return this.#lineSystem?.getEffectiveLineMaxLoadKg?.() || 8;
  }

  getEffectiveLeaderMaxLoadKg() {
    if (!this.#leader) return Infinity;
    return durabilityAdjustedMaxLoadKg(this.#leader, Infinity);
  }

  getEffectiveHookMaxLoadKg() {
    if (!this.#hook) return Infinity;
    return (
      this.#hook.getEffectiveMaxLoadKg?.() ||
      this.#hook.getMaxLoadKg?.() ||
      durabilityAdjustedMaxLoadKg(this.#hook, Infinity)
    );
  }

  getEffectiveReelMaxLoadKg() {
    if (!this.#reel?.hasReel?.()) return Infinity;
    return this.#reel.getEffectiveMaxLoadKg?.() || this.#reel.getMaxLoadKg?.() || Infinity;
  }

  getTension() {
    return this.#tensionPercent;
  }

  getStressRatio() {
    return Math.max(0, Math.min(1, this.#stressDiagnostics?.stressRatio || 0));
  }

  getTensionKg() {
    return this.#currentTensionKg;
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

  reset() {
    this.#currentTensionKg = 0;
    this.#targetTensionKg = 0;
    this.#effectiveTensionKg = 0;
    this.#tensionStressSource = "raw";
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
    this.#stressDiagnostics = this.#accumulator?.getDiagnostics?.(
      this.#stressDiagnosticsDefaults(stressConfig),
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
      failureChance: this.#stressDiagnostics?.failureChance || 0,
      failureSource: this.#breakInfo?.failureSource ||
        this.#stressDiagnostics?.failureSource ||
        null,
      guaranteedFailure: !!(
        this.#breakInfo?.guaranteed ||
        this.#stressDiagnostics?.guaranteedFailure
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
      hookMaxLoadKg: this.getEffectiveHookMaxLoadKg(),
      rodMaxLoadKg: this.getEffectiveRodMaxLoadKg(),
      reelMaxLoadKg: this.getEffectiveReelMaxLoadKg(),
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
      hookMaxLoadKg: this.getEffectiveHookMaxLoadKg(),
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
        tieBreakPriority: ["leader", "line", "hook", "rod", "reel"],
        ...(raw.failureSelection || {}),
      },
    };
  }

  #stressDiagnosticsDefaults(stressConfig) {
    return {
      capacity: stressConfig?.stress?.capacity ?? 1,
      recoveryPerSecond: stressConfig?.stress?.recoveryPerSecond ?? 0.35,
      intervalMs: stressConfig?.failureRoll?.intervalMs ?? 500,
    };
  }

  #stressDiagnosticsWithDefaults(stressConfig) {
    const defaults = this.#stressDiagnosticsDefaults(stressConfig);
    return {
      ...this.#accumulator.getDiagnostics(defaults),
      ...this.#stressDiagnostics,
    };
  }

  #stressRatio(tensionKg, limitKg) {
    const limit = Number(limitKg);
    if (!Number.isFinite(limit) || limit <= 0) return 0;
    return Math.max(0, Number(tensionKg) || 0) / limit;
  }
}
