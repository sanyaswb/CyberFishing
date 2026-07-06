class ReelHoldGateLiveProbe {
  #lastSignature = "";

  constructor({
    thresholdRatio = 0.95,
    debugModuleKey = "reelHoldGate",
  } = {}) {
    this.thresholdRatio = thresholdRatio;
    this.debugModuleKey = debugModuleKey;
    this.#bind();
  }

  #bind() {
    if (typeof document === "undefined") return;

    document.addEventListener("debug-live-update", (event) => {
      if (!this.#isEnabled()) {
        this.#reset();
        return;
      }

      const live = event.detail || {};
      if (live.gameState !== "playing") {
        this.#reset();
        return;
      }
      if (!this.#shouldInspect(live)) return;

      const diagnosis = this.#diagnose(live);
      const signature = this.#signature(live, diagnosis);

      if (signature === this.#lastSignature) return;
      this.#lastSignature = signature;
      this.#print(live, diagnosis);
    });
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
    const rodStrokeRatio = Number(live.rodStrokeRatio) || 0;
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

  #reset() {
    this.#lastSignature = "";
  }
}

window.ReelHoldGateLiveProbe = ReelHoldGateLiveProbe;
window.CYBER_FISHING_REEL_HOLD_GATE_LIVE_PROBE =
  new ReelHoldGateLiveProbe();
