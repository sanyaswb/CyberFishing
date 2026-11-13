import { clampUnitFinite, nonNegativeOr } from "../../../engine/math/number_normalization.js";

/**
 * Resolves per-frame player force budgets for Rod Hold and Rod Control.
 *
 * Responsibility boundary:
 * - input: already resolved fish tension, tackle limit and composed fight actions;
 * - output: immutable force/tension budget frame for player channels;
 * - no entity mutation, no DOM/canvas/input-device details, no drag/payout logic.
 */
export class PlayerForceBudgetAllocator {
  resolve({
    rodLimitKg,
    fishTensionKg,
    holdAction,
    controlAction,
    controlEligibility = null,
    config = {},
  } = {}) {
    const enabled = config.enabled !== false;
    const rodLimit = nonNegativeOr(rodLimitKg);
    const fishTension = nonNegativeOr(fishTensionKg);
    const holdActive = !!holdAction?.active;
    const controlConfig = config.control || {};
    const rawControlInputRatio = controlAction?.active
      ? clampUnitFinite(controlAction?.inputRatio)
      : 0;
    const minControlInputRatio = clampUnitFinite(
      controlConfig.minInputRatio ?? 0.001,
    );
    const controlRequested =
      !!controlAction?.active && rawControlInputRatio >= minControlInputRatio;
    const controlEligible =
      controlRequested && controlEligibility?.canRequestForce !== false;
    const controlActive = controlRequested && controlEligible;
    const controlInputRatio = controlActive ? rawControlInputRatio : 0;
    const controlBlockedReason =
      controlRequested && !controlEligible
        ? controlEligibility?.blockedReason || "unavailable"
        : "none";
    const allocationMode =
      config.allocationMode === "split" ? "split" : "independent";

    if (!enabled) {
      return this.#freeze({
        enabled: false,
        reason: "disabled",
        rodLimitKg: rodLimit,
        fishTensionKg: fishTension,
        holdActive,
        controlActive,
        controlRequested,
        controlEligible,
        controlBlockedReason,
        controlInputRatio,
        allocationMode,
        holdCeilingMultiplier: 1,
        controlCeilingMultiplier: 1,
        maxCombinedCeilingMultiplier: 1,
        combinedCeilingMultiplier: 1,
        combinedTensionCeilingKg: rodLimit,
        totalPlayerBudgetKg: Math.max(0, rodLimit - fishTension),
        holdShare: holdActive ? 1 : 0,
        controlShare: !holdActive && controlActive ? 1 : 0,
        holdBudgetKg: 0,
        controlBudgetKg: 0,
      });
    }

    const ceiling = config.tensionCeiling || {};
    const holdMultiplier = nonNegativeOr(
      ceiling.holdMultiplier,
      nonNegativeOr(config.holdMultiplier, 1),
    );
    const controlMultiplier = nonNegativeOr(
      ceiling.controlMultiplier,
      nonNegativeOr(config.controlMultiplier, 1),
    );
    const maxCombinedMultiplier = Math.max(
      1,
      nonNegativeOr(
        ceiling.maxCombinedMultiplier,
        nonNegativeOr(config.maxCombinedMultiplier, 1.0),
      ),
    );

    const holdExtra = holdActive ? Math.max(0, holdMultiplier - 1) : 0;
    const controlExtra = controlActive
      ? Math.max(0, controlMultiplier - 1) * controlInputRatio
      : 0;
    const rawCombinedMultiplier = 1 + holdExtra + controlExtra;
    const combinedMultiplier = Math.min(
      Math.max(1, rawCombinedMultiplier),
      maxCombinedMultiplier,
    );
    const combinedTensionCeilingKg = rodLimit * combinedMultiplier;
    const totalPlayerBudgetKg = Math.max(
      0,
      combinedTensionCeilingKg - fishTension,
    );

    const shares = this.#resolveShares({
      holdActive,
      controlActive,
      controlRequested,
      controlEligible,
      controlBlockedReason,
      controlInputRatio,
      controlConfig,
      allocationMode,
    });

    const holdBudgetKg = totalPlayerBudgetKg * shares.holdShare;
    const controlBudgetKg = totalPlayerBudgetKg * shares.controlShare;

    return this.#freeze({
      enabled: true,
      reason: this.#reason({ holdActive, controlActive }),
      rodLimitKg: rodLimit,
      fishTensionKg: fishTension,
      holdActive,
      controlActive,
      controlRequested,
      controlEligible,
      controlBlockedReason,
      controlInputRatio,
      allocationMode,
      holdCeilingMultiplier: holdMultiplier,
      controlCeilingMultiplier: controlMultiplier,
      maxCombinedCeilingMultiplier: maxCombinedMultiplier,
      rawCombinedCeilingMultiplier: rawCombinedMultiplier,
      combinedCeilingMultiplier: combinedMultiplier,
      combinedTensionCeilingKg,
      totalPlayerBudgetKg,
      holdShare: shares.holdShare,
      controlShare: shares.controlShare,
      holdBudgetKg,
      controlBudgetKg,
    });
  }

  #resolveShares({
    holdActive,
    controlActive,
    controlInputRatio,
    controlConfig,
    allocationMode,
  }) {
    if (!holdActive && !controlActive) {
      return { holdShare: 0, controlShare: 0 };
    }
    if (holdActive && !controlActive) {
      return { holdShare: 1, controlShare: 0 };
    }
    if (!holdActive && controlActive) {
      return { holdShare: 0, controlShare: 1 };
    }

    if (allocationMode !== "split") {
      return { holdShare: 1, controlShare: 1 };
    }

    const maxBudgetShare = clampUnitFinite(
      Number(controlConfig.maxBudgetShare ?? 0.5),
    );
    const controlShare = clampUnitFinite(controlInputRatio * maxBudgetShare);
    return {
      holdShare: clampUnitFinite(1 - controlShare),
      controlShare,
    };
  }

  #reason({ holdActive, controlActive }) {
    if (holdActive && controlActive) return "hold_and_control";
    if (holdActive) return "hold_only";
    if (controlActive) return "control_only";
    return "no_player_force";
  }

  #freeze(data) {
    return Object.freeze(data);
  }
}
