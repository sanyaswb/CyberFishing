class ReelHoldGateLiveProbe {
  #lastSignature = "";
  #latestAcceptanceLive = null;
  #previousDebugModuleEnabled = null;
  #acceptanceState = Object.freeze({ status: "idle" });
  #acceptanceSubscribers = new Set();
  #spaceHeld = false;
  #bestBefore = null;
  #animationFrame = null;
  #recoveryRun = 0;
  #recoveryWindowMs;
  #consoleErrors = 0;
  #consoleWarnings = 0;
  #originalConsoleError = null;
  #originalConsoleWarn = null;
  #wrappedConsoleError = null;
  #wrappedConsoleWarn = null;

  constructor({
    thresholdRatio = 0.95,
    debugModuleKey = "reelHoldGate",
    recoveryWindowMs = 2000,
  } = {}) {
    this.thresholdRatio = thresholdRatio;
    this.debugModuleKey = debugModuleKey;
    this.#recoveryWindowMs = recoveryWindowMs;
    this.#bind();
  }

  getAcceptanceState() {
    return this.#acceptanceState;
  }

  subscribeAcceptance(subscriber) {
    if (typeof subscriber !== "function") {
      throw new TypeError("Reel retrieve probe subscriber must be a function");
    }
    this.#acceptanceSubscribers.add(subscriber);
    subscriber(this.#acceptanceState);
    return () => this.#acceptanceSubscribers.delete(subscriber);
  }

  async armAcceptance() {
    this.#cancelAcceptanceRun();
    this.#publishAcceptance({ status: "arming" });

    try {
      if (!window.DEBUG_MODULES) {
        throw new Error("Debug module registry is unavailable");
      }
      this.#previousDebugModuleEnabled =
        window.DEBUG_MODULES[this.debugModuleKey] === true;
      window.DEBUG_MODULES[this.debugModuleKey] = true;
      this.#startConsoleCapture();
      this.#publishAcceptance({
        status: "armed",
        instructions:
          "Start a fight, hold Space until stroke credit is positive, then release it.",
      });
      console.info(
        "[Stage 3.7.8 probe] Armed. Hold Space to build stroke credit, then release Space.",
      );
    } catch (error) {
      this.#stopConsoleCapture();
      this.#restoreAcceptanceDebugModule();
      this.#publishAcceptance({
        status: "error",
        error: error?.message || String(error),
      });
    }

    return this.#acceptanceState;
  }

  cancelAcceptance() {
    this.#cancelAcceptanceRun();
    this.#publishAcceptance({ status: "idle" });
  }

  dispose() {
    this.#cancelAcceptanceRun();
    this.#acceptanceSubscribers.clear();
    if (typeof document !== "undefined") {
      document.removeEventListener("debug-live-update", this.#onDebugLiveUpdate);
      document.removeEventListener(
        "stage-3-7-8-reel-retrieve-probe-command",
        this.#onAcceptanceCommand,
      );
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", this.#onAcceptanceKeyDown, true);
      window.removeEventListener("keyup", this.#onAcceptanceKeyUp, true);
    }
  }

  #bind() {
    if (typeof document === "undefined") return;

    document.addEventListener("debug-live-update", this.#onDebugLiveUpdate);
    document.addEventListener(
      "stage-3-7-8-reel-retrieve-probe-command",
      this.#onAcceptanceCommand,
    );
    window.addEventListener("keydown", this.#onAcceptanceKeyDown, true);
    window.addEventListener("keyup", this.#onAcceptanceKeyUp, true);
  }

  #onAcceptanceCommand = (event) => {
    const action = event.detail?.action;
    if (action === "arm") {
      this.armAcceptance();
      return;
    }
    if (action === "cancel") {
      this.cancelAcceptance();
      return;
    }
    if (action === "query") {
      this.#publishAcceptance(this.#acceptanceState);
    }
  };

  #onDebugLiveUpdate = (event) => {
    this.#latestAcceptanceLive = event.detail || null;
    if (!this.#isEnabled()) {
      this.#resetLiveSignature();
      return;
    }

    const live = event.detail || {};
    if (live.gameState !== "playing") {
      this.#resetLiveSignature();
      return;
    }
    if (!this.#shouldInspect(live)) return;

    const diagnosis = this.#diagnose(live);
    const signature = this.#signature(live, diagnosis);

    if (signature === this.#lastSignature) return;
    this.#lastSignature = signature;
    this.#print(live, diagnosis);
  };

  #onAcceptanceKeyDown = (event) => {
    if (
      event.code !== "Space" ||
      event.repeat ||
      this.#spaceHeld ||
      this.#acceptanceState.status !== "armed" ||
      this.#isEditableTarget(event.target)
    ) {
      return;
    }

    this.#spaceHeld = true;
    this.#bestBefore = this.#readAcceptanceSnapshot();
    this.#publishAcceptance({
      status: "capturing-before",
      before: this.#bestBefore,
    });
    this.#sampleWhileHeld();
  };

  #onAcceptanceKeyUp = (event) => {
    if (event.code !== "Space" || !this.#spaceHeld) return;

    this.#spaceHeld = false;
    const current = this.#readAcceptanceSnapshot();
    const before = this.#preferStrokeCredit(this.#bestBefore, current);
    this.#bestBefore = null;
    console.info("A — BEFORE", before);
    this.#publishAcceptance({
      status: "observing-recovery",
      before,
    });
    this.#observeRecovery(before);
  };

  #isEditableTarget(target) {
    const tagName = String(target?.tagName || "").toLowerCase();
    return (
      tagName === "input" ||
      tagName === "textarea" ||
      tagName === "button" ||
      target?.isContentEditable === true
    );
  }

  #sampleWhileHeld() {
    if (!this.#spaceHeld) return;
    const current = this.#readAcceptanceSnapshot();
    this.#bestBefore = this.#preferStrokeCredit(this.#bestBefore, current);
    this.#animationFrame = window.requestAnimationFrame(() =>
      this.#sampleWhileHeld(),
    );
  }

  #observeRecovery(before) {
    const run = ++this.#recoveryRun;
    const startedAt = window.performance.now();
    let bestAfter = this.#readAcceptanceSnapshot();
    const trace = [];
    let lastSignature = "";

    const sample = () => {
      if (run !== this.#recoveryRun) return;
      const current = this.#readAcceptanceSnapshot();
      const signature = this.#acceptanceSignature(current);
      if (signature !== lastSignature && trace.length < 24) {
        trace.push(current);
        lastSignature = signature;
      }
      if (
        this.#recoveryScore(before, current) >
        this.#recoveryScore(before, bestAfter)
      ) {
        bestAfter = current;
      }

      if (window.performance.now() - startedAt < this.#recoveryWindowMs) {
        this.#animationFrame = window.requestAnimationFrame(sample);
        return;
      }

      const consoleSummary = Object.freeze({
        errors: this.#consoleErrors,
        warnings: this.#consoleWarnings,
        scope: "since-devtools-probe-armed",
      });
      this.#stopConsoleCapture();
      this.#restoreAcceptanceDebugModule();
      const verdict = this.#evaluateAcceptance(
        before,
        bestAfter,
        consoleSummary,
      );
      const result = {
        status: "complete",
        before,
        after: bestAfter,
        trace: Object.freeze([...trace]),
        verdict,
      };
      this.#publishAcceptance(result);
      console.info("B — AFTER", bestAfter);
      console.info("REEL/RETRIEVE TRACE", trace);
      console.info("STAGE 3.7.8 VERDICT", verdict);
    };

    this.#animationFrame = window.requestAnimationFrame(sample);
  }

  #readAcceptanceSnapshot() {
    const debug = this.#latestAcceptanceLive;
    const line = debug?.lineDebug || {};
    return Object.freeze({
      capturedAt: new Date().toISOString(),
      available: !!debug,
      hasReel: this.#firstBoolean(debug?.hasReel, line.reelHoldHasReel),
      lineTotalMeters: this.#firstNumber(
        debug?.lineTotalMeters,
        debug?.lineTotalLengthMeters,
        line.totalLineMeters,
      ),
      lineReleasedMeters: this.#firstNumber(
        debug?.lineReleasedMeters,
        line.releasedLineMeters,
      ),
      rodStrokeWonMeters: this.#firstNumber(
        debug?.rodStrokeWonMeters,
        line.rodStrokeWonMeters,
      ),
      autoRecoveredMeters: this.#firstNumber(
        debug?.autoRecoveredMeters,
        line.autoRecoveredMeters,
      ),
      holdRecoveredMeters: this.#firstNumber(
        debug?.holdRecoveredMeters,
        line.holdRecoveredMeters,
      ),
      autoRecoverBlockedReason:
        debug?.autoRecoverBlockedReason ||
        line.autoRecoverBlockedReason ||
        "none",
    });
  }

  #evaluateAcceptance(before, after, consoleSummary) {
    const lineReduced =
      this.#finiteNumber(after?.lineReleasedMeters) <
      this.#finiteNumber(before?.lineReleasedMeters);
    const strokeReduced =
      this.#finiteNumber(after?.rodStrokeWonMeters) <
      this.#finiteNumber(before?.rodStrokeWonMeters);
    const frameRecovery =
      this.#finiteNumber(after?.autoRecoveredMeters) > 0 ||
      this.#finiteNumber(after?.holdRecoveredMeters) > 0;
    const recoveryObserved = frameRecovery || lineReduced || strokeReduced;
    const blockedReason = String(after?.autoRecoverBlockedReason || "none");
    const strokeLineDesync = blockedReason === "stroke_line_desync";
    const consoleClean =
      this.#finiteNumber(consoleSummary.errors) === 0 &&
      this.#finiteNumber(consoleSummary.warnings) === 0;
    const setupValid =
      before?.hasReel === true &&
      this.#finiteNumber(before?.lineTotalMeters) > 0 &&
      this.#finiteNumber(before?.lineReleasedMeters) > 0 &&
      this.#finiteNumber(before?.rodStrokeWonMeters) > 0;

    return Object.freeze({
      status:
        setupValid && recoveryObserved && !strokeLineDesync && consoleClean
          ? "PASS"
          : "NOT_PASS",
      setupValid,
      recoveryObserved,
      recoveryEvidence: Object.freeze({
        frameRecovery,
        lineReleasedMetersReduced: lineReduced,
        rodStrokeWonMetersReduced: strokeReduced,
      }),
      strokeLineDesync,
      consoleClean,
      blockerClassification: strokeLineDesync
        ? "hydration-desync"
        : !recoveryObserved && blockedReason !== "none"
          ? "gameplay-gate-review"
          : "none",
      console: consoleSummary,
    });
  }

  #preferStrokeCredit(left, right) {
    if (!left) return right;
    return right.rodStrokeWonMeters >= left.rodStrokeWonMeters ? right : left;
  }

  #recoveryScore(before, after) {
    return (
      Math.max(0, this.#finiteNumber(after?.autoRecoveredMeters)) * 1000 +
      Math.max(0, this.#finiteNumber(after?.holdRecoveredMeters)) * 1000 +
      Math.max(
        0,
        this.#finiteNumber(before?.lineReleasedMeters) -
          this.#finiteNumber(after?.lineReleasedMeters),
      ) *
        100 +
      Math.max(
        0,
        this.#finiteNumber(before?.rodStrokeWonMeters) -
          this.#finiteNumber(after?.rodStrokeWonMeters),
      )
    );
  }

  #acceptanceSignature(snapshot) {
    return [
      snapshot.lineReleasedMeters,
      snapshot.rodStrokeWonMeters,
      snapshot.autoRecoveredMeters,
      snapshot.holdRecoveredMeters,
      snapshot.autoRecoverBlockedReason,
    ].join("|");
  }

  #firstBoolean(...values) {
    return values.find((candidate) => typeof candidate === "boolean") === true;
  }

  #firstNumber(...values) {
    for (const value of values) {
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }
    return 0;
  }

  #finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  #startConsoleCapture() {
    this.#stopConsoleCapture();
    this.#consoleErrors = 0;
    this.#consoleWarnings = 0;
    this.#originalConsoleError = console.error;
    this.#originalConsoleWarn = console.warn;
    this.#wrappedConsoleError = (...args) => {
      this.#consoleErrors += 1;
      this.#originalConsoleError.apply(console, args);
    };
    this.#wrappedConsoleWarn = (...args) => {
      this.#consoleWarnings += 1;
      this.#originalConsoleWarn.apply(console, args);
    };
    console.error = this.#wrappedConsoleError;
    console.warn = this.#wrappedConsoleWarn;
  }

  #stopConsoleCapture() {
    if (console.error === this.#wrappedConsoleError) {
      console.error = this.#originalConsoleError;
    }
    if (console.warn === this.#wrappedConsoleWarn) {
      console.warn = this.#originalConsoleWarn;
    }
    this.#originalConsoleError = null;
    this.#originalConsoleWarn = null;
    this.#wrappedConsoleError = null;
    this.#wrappedConsoleWarn = null;
  }

  #cancelAcceptanceRun() {
    this.#recoveryRun += 1;
    this.#spaceHeld = false;
    this.#bestBefore = null;
    this.#restoreAcceptanceDebugModule();
    if (this.#animationFrame !== null) {
      window.cancelAnimationFrame(this.#animationFrame);
      this.#animationFrame = null;
    }
    this.#stopConsoleCapture();
  }

  #restoreAcceptanceDebugModule() {
    if (
      this.#previousDebugModuleEnabled !== null &&
      window.DEBUG_MODULES
    ) {
      window.DEBUG_MODULES[this.debugModuleKey] =
        this.#previousDebugModuleEnabled;
    }
    this.#previousDebugModuleEnabled = null;
  }

  #publishAcceptance(state) {
    this.#acceptanceState = Object.freeze(state);
    for (const subscriber of this.#acceptanceSubscribers) {
      subscriber(this.#acceptanceState);
    }
    document.dispatchEvent(
      new CustomEvent("stage-3-7-8-reel-retrieve-probe-state", {
        detail: this.#acceptanceState,
      }),
    );
  }

  #isEnabled() {
    return window.DEBUG_MODULES?.[this.debugModuleKey] === true;
  }

  #shouldInspect(live) {
    const ratio = Number(live.rodStrokeRatio) || 0;
    return (
      ratio >= this.thresholdRatio ||
      live.holdReelRecoverActive === true ||
      live.holdReelRecoverEngaged === true ||
      (
        live.holdReelRecoverBlockedReason &&
        live.holdReelRecoverBlockedReason !== "not_checked"
      )
    );
  }

  #signature(live, diagnosis) {
    const moving = Number(live.reelHoldMoveMeters ?? 0) > 0.0001
      ? "moving"
      : "not_moving";
    return [
      diagnosis.firstFailedGate,
      diagnosis.movementDiagnosis,
      diagnosis.engaged ? "engaged" : "not_engaged",
      diagnosis.engagedButNotMoving ? "engaged_zero_move" : moving,
      live.holdReelRecoverEligible === true ? "eligible" : "not_eligible",
      live.holdReelRecoverBlockedReason || "none",
      live.holdReelRecoverLineBlockedReason || "none",
      live.reelHoldMovementBlockReason || "none",
      live.holdReelRecoveringLine === true ? "recovering_line" : "not_recovering_line",
      live.holdReelRecoverHasRecoverableLine === true ? "has_line" : "no_line",
    ].join("|");
  }

  #diagnose(live) {
    const rodStrokeRatio = Number(
      live.holdReelRecoverInputStrokeRatio ?? live.rodStrokeRatio,
    ) || 0;
    const requiredStrokeRatio =
      Number(
        live.holdReelRecoverRequiredStrokeRatio ??
          live.reelHoldRequiredStrokeRatio ??
          1,
      ) || 1;
    const rawTensionKg = Number(
      live.reelHoldRawTensionKg ?? live.rawTensionKg,
    );
    const dragLimitKg = Number(
      live.reelHoldDragLimitKg ?? live.dragLimitKg,
    );
    const reelMaxLoadKg = Number(live.holdReelRecoverReelMaxLoadKg);
    const reserveRatio = Number(live.holdReelRecoverLoadReserveRatio);
    const recoverSpeed = Number(live.holdReelRecoverSpeedMps);
    const hasReel =
      live.reelHoldHasReel === true ||
      reelMaxLoadKg > 0 ||
      live.holdReelRecoverBlockedReason !== "no_reel";
    const playerHoldActive =
      live.reelHoldPlayerHoldActive === true ||
      live.playerPulling === true ||
      live.fightMode === "pull";
    const strokeFull =
      live.holdReelRecoverStrokeFull === true ||
      live.reelHoldStrokeFull === true ||
      rodStrokeRatio >= requiredStrokeRatio;
    const shouldSlipDrag =
      live.reelHoldShouldSlipDrag === true ||
      live.shouldSlipDrag === true;
    const belowDragLimit =
      live.reelHoldTensionBelowDragLimit === true ||
      live.reelHoldDragLocked === true ||
      live.dragLocked === true ||
      (
        Number.isFinite(rawTensionKg) &&
        Number.isFinite(dragLimitKg) &&
        rawTensionKg < dragLimitKg - 0.001
      );
    const belowReelMaxLoad =
      live.reelHoldTensionBelowMaxLoad === true ||
      (
        Number.isFinite(reserveRatio) &&
        reserveRatio > 0.01
      ) ||
      (
        Number.isFinite(rawTensionKg) &&
        Number.isFinite(reelMaxLoadKg) &&
        reelMaxLoadKg > 0 &&
        rawTensionKg < reelMaxLoadKg * 0.99
      );
    const checks = [
      {
        key: "config_disabled",
        pass:
          live.reelHoldConfigEnabled === true ||
          (
            live.holdReelRecoverBlockedReason !== "disabled" &&
            live.holdReelRecoverBlockedReason !== "config_disabled"
          ),
      },
      {
        key: "no_reel",
        pass: hasReel,
      },
      {
        key: "not_holding",
        pass: playerHoldActive,
      },
      {
        key: "rod_pull_inactive",
        pass: live.rodPullActive === true,
      },
      {
        key: "stroke_not_full",
        pass: strokeFull,
      },
      {
        key: "drag_slipping",
        pass: !shouldSlipDrag,
      },
      {
        key: "at_drag_limit",
        pass: belowDragLimit,
      },
      {
        key: "near_max_load",
        pass: belowReelMaxLoad,
      },
      {
        key: "zero_recover_speed",
        pass: Number.isFinite(recoverSpeed) && recoverSpeed > 0.001,
      },
      {
        key: "delay_waiting",
        pass:
          Number(live.holdReelRecoverTimerMs || 0) >=
          Number(live.holdReelRecoverDelayMs || 0),
      },
    ];
    const failed = checks.find((check) => !check.pass);
    const engaged = live.holdReelRecoverEngaged === true;
    const moveMeters = Number(live.reelHoldMoveMeters ?? 0);

    return {
      firstFailedGate: failed?.key || "none",
      expectedToEngage: rodStrokeRatio >= requiredStrokeRatio,
      canEngage: !failed,
      engaged,
      engagedButNotMoving: engaged && moveMeters <= 0.0001,
      movementDiagnosis: this.#movementDiagnosis(live, engaged, moveMeters),
    };
  }

  #movementDiagnosis(live, engaged, moveMeters) {
    if (!engaged) return "not_engaged";
    if (moveMeters > 0.0001) return "moving";
    const blockReason = live.reelHoldMovementBlockReason || "none";
    if (blockReason !== "none") return blockReason;
    if (live.holdReelRecoveringLine !== true) {
      return live.holdReelRecoverLineBlockedReason || "not_recovering_line";
    }
    if ((Number(live.fishRetrieveDesiredMoveMeters) || 0) <= 0.0001) {
      return "no_fish_retrieve_demand";
    }
    if ((Number(live.holdReelRecoverMoveMeters) || 0) <= 0.0001) {
      return "zero_reel_hold_move_budget";
    }
    if (live.fishRetrieveMovementBlocked === true) {
      return "fish_retrieve_movement_blocked";
    }
    return "engaged_but_zero_move";
  }

  #print(live, diagnosis) {
    const color = diagnosis.canEngage ? "color:#2ecc71" : "color:#e74c3c";

    console.groupCollapsed(
      `%c[REEL HOLD LIVE] ${diagnosis.firstFailedGate}`,
      color,
    );

    console.table({
      "Game state": live.gameState,
      "Expected to engage": diagnosis.expectedToEngage,
      "Can engage": diagnosis.canEngage,
      "First failed gate": diagnosis.firstFailedGate,
      "Engaged": diagnosis.engaged,
      "Engaged but not moving": diagnosis.engagedButNotMoving,
      "Movement diagnosis": diagnosis.movementDiagnosis,
      "Blocked reason": live.holdReelRecoverBlockedReason || "n/a",
      "Line block reason": live.holdReelRecoverLineBlockedReason || "n/a",
      "Movement block reason": live.reelHoldMovementBlockReason || "n/a",
    });

    console.table({
      "Player pulling": live.playerPulling === true,
      "Fight mode": live.fightMode || "n/a",
      "Rod pull active": live.rodPullActive === true,
      "Rod stroke ratio": this.#percent(live.rodStrokeRatio),
      "ReelHold input stroke": this.#percent(
        live.holdReelRecoverInputStrokeRatio,
      ),
      "Final rod stroke": this.#percent(live.finalRodStrokeRatio),
      "Stroke delta to full": this.#percent(
        live.holdReelRecoverStrokeRatioDeltaToFull,
      ),
      "Stroke tolerance": this.#percent(
        live.holdReelRecoverStrokeRatioTolerance,
      ),
      "Rod stroke won m": this.#num(live.rodStrokeWonMeters, 3),
      "Rod stroke capacity m": this.#num(live.rodStrokeCapacityMeters, 3),
      "Eligible": live.holdReelRecoverEligible === true,
      "Active": live.holdReelRecoverActive === true,
      "Engaged": live.holdReelRecoverEngaged === true,
      "Recovering line": live.holdReelRecoveringLine === true,
    });

    console.table({
      "Raw tension kg": this.#num(
        live.reelHoldRawTensionKg ?? live.rawTensionKg,
        3,
      ),
      "Total tension kg": this.#num(live.totalTensionKg, 3),
      "Drag limit kg": this.#num(
        live.reelHoldDragLimitKg ?? live.dragLimitKg,
        3,
      ),
      "Drag locked":
        live.reelHoldDragLocked === true || live.dragLocked === true,
      "Should slip drag":
        live.reelHoldShouldSlipDrag === true ||
        live.shouldSlipDrag === true,
      "Reel max load kg": this.#num(
        live.holdReelRecoverReelMaxLoadKg,
        3,
      ),
      "Load reserve ratio": this.#percent(
        live.holdReelRecoverLoadReserveRatio,
      ),
      "Recover speed m/s": this.#num(live.holdReelRecoverSpeedMps, 3),
    });

    console.table({
      "Line released m": this.#num(live.lineReleasedMeters, 3),
      "Line distance m": this.#num(live.lineDistanceMeters, 3),
      "Line recoverable m": this.#num(live.lineRecoverableMeters, 3),
      "Has recoverable line":
        live.holdReelRecoverHasRecoverableLine === true,
      "Recovering line": live.holdReelRecoveringLine === true,
      "Movement state used": live.reelHoldStateUsedForMovement || "n/a",
      "State calculated": live.reelHoldStateCalculatedThisFrame || "n/a",
      "Previous engaged": live.previousReelHoldEngaged === true,
      "Current engaged": live.currentReelHoldEngaged === true,
      "Frame dt sec": this.#num(live.reelHoldAppliedDtSec, 4),
      "ReelHold move m": this.#num(live.reelHoldMoveMeters, 4),
      "Applied speed m/s": this.#num(live.reelHoldAppliedSpeedMps, 3),
      "Hard line limit": live.hardLineLimit === true,
      "Line fully extended": live.isLineFullyExtended === true,
    });

    console.groupEnd();
  }

  #num(value, digits = 2) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "n/a";
    return number.toFixed(digits);
  }

  #percent(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "n/a";
    return `${(number * 100).toFixed(1)}%`;
  }

  #resetLiveSignature() {
    this.#lastSignature = "";
  }
}

window.ReelHoldGateLiveProbe = ReelHoldGateLiveProbe;
window.CYBER_FISHING_REEL_HOLD_GATE_LIVE_PROBE =
  new ReelHoldGateLiveProbe();
