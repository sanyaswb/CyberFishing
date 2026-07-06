class ReelHoldGateDebugModule extends ConsoleTableDebugModule {
  constructor() {
    super({ key: "reelHoldGate", title: "Reel Hold Gate" });
  }

  get printOnFishHooked() {
    return false;
  }

  render(context) {
    const live = context.live || {};
    const diagnosis = this.#diagnose(live);
    const color = diagnosis.canEngage ? "color:#2ecc71" : "color:#e74c3c";

    console.groupCollapsed(
      `%c[REEL HOLD GATE] ${diagnosis.firstFailedGate}`,
      color,
    );

    console.table({
      "Expected to engage": diagnosis.expectedToEngage,
      "Can engage": diagnosis.canEngage,
      "First failed gate": diagnosis.firstFailedGate,
      "Engaged but not moving": diagnosis.engagedButNotMoving,
      "Movement diagnosis": diagnosis.movementDiagnosis,
      "Blocked reason": live.holdReelRecoverBlockedReason || "n/a",
      "Line block reason": live.holdReelRecoverLineBlockedReason || "n/a",
      "Movement block reason": live.reelHoldMovementBlockReason || "n/a",
    });

    console.table({
      "Config enabled": live.reelHoldConfigEnabled === true,
      "Has reel": live.reelHoldHasReel === true,
      "Player hold active": live.reelHoldPlayerHoldActive === true,
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
      "Required stroke ratio": this.#percent(
        live.reelHoldRequiredStrokeRatio ?? 1,
      ),
      "Stroke full": live.reelHoldStrokeFull === true,
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
      "Drag limit kg": this.#num(
        live.reelHoldDragLimitKg ?? live.dragLimitKg,
        3,
      ),
      "Drag locked": live.reelHoldDragLocked === true,
      "Should slip drag": live.reelHoldShouldSlipDrag === true,
      "Below drag limit": live.reelHoldTensionBelowDragLimit === true,
      "Reel max load kg": this.#num(
        live.holdReelRecoverReelMaxLoadKg,
        3,
      ),
      "Load reserve ratio": this.#percent(
        live.holdReelRecoverLoadReserveRatio,
      ),
      "Below reel max load": live.reelHoldTensionBelowMaxLoad === true,
      "Drag can hold": live.reelHoldDragCanHold === true,
      "Retrieve speed m/s": this.#num(live.reelHoldRetrieveSpeedMps, 3),
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
      "Fish desired move m": this.#num(live.fishRetrieveDesiredMoveMeters, 4),
      "Hold reel max move m": this.#num(live.holdReelRecoverMoveMeters, 4),
      "ReelHold move m": this.#num(live.reelHoldMoveMeters, 4),
      "Applied speed m/s": this.#num(live.reelHoldAppliedSpeedMps, 3),
      "Fish movement blocked": live.fishRetrieveMovementBlocked === true,
      "Hard line limit": live.hardLineLimit === true,
      "Line fully extended": live.isLineFullyExtended === true,
    });

    console.groupEnd();
  }

  #diagnose(live) {
    const rodStrokeRatio = Number(
      live.holdReelRecoverInputStrokeRatio ?? live.rodStrokeRatio,
    ) || 0;
    const requiredStrokeRatio =
      Number(live.reelHoldRequiredStrokeRatio) || 1;
    const checks = [
      {
        key: "config_disabled",
        pass: live.reelHoldConfigEnabled === true,
      },
      {
        key: "no_reel",
        pass: live.reelHoldHasReel === true,
      },
      {
        key: "not_holding",
        pass: live.reelHoldPlayerHoldActive === true,
      },
      {
        key: "rod_pull_inactive",
        pass: live.rodPullActive === true,
      },
      {
        key: "stroke_not_full",
        pass:
          live.reelHoldStrokeFull === true ||
          rodStrokeRatio >= requiredStrokeRatio,
      },
      {
        key: "drag_slipping",
        pass: live.reelHoldShouldSlipDrag !== true,
      },
      {
        key: "at_drag_limit",
        pass: live.reelHoldTensionBelowDragLimit === true,
      },
      {
        key: "near_max_load",
        pass: live.reelHoldTensionBelowMaxLoad === true,
      },
      {
        key: "zero_recover_speed",
        pass: Number(live.holdReelRecoverSpeedMps) > 0.001,
      },
      {
        key: "delay_waiting",
        pass:
          Number(live.holdReelRecoverTimerMs) >=
          Number(live.holdReelRecoverDelayMs),
      },
    ];
    const failed = checks.find((check) => !check.pass);
    const engaged = live.holdReelRecoverEngaged === true;
    const moving = Number(live.reelHoldMoveMeters) > 0.0001;

    return {
      expectedToEngage: rodStrokeRatio >= requiredStrokeRatio,
      canEngage: !failed,
      firstFailedGate: failed?.key || "none",
      engagedButNotMoving: engaged && !moving,
      movementDiagnosis: this.#movementDiagnosis(live, engaged, moving),
    };
  }

  #movementDiagnosis(live, engaged, moving) {
    if (!engaged) return "not_engaged";
    if (moving) return "moving";
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
    return "no_applied_move_without_block_reason";
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
}

window.ReelHoldGateDebugModule = ReelHoldGateDebugModule;
