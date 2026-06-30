/**
 * Resolves per-frame player force budgets for Rod Hold and Rod Control.
 *
 * Responsibility boundary:
 * - input: already resolved fish tension, tackle limit and composed fight actions;
 * - output: immutable force/tension budget frame for player channels;
 * - no entity mutation, no DOM/canvas/input-device details, no drag/payout logic.
 */
class PlayerForceBudgetAllocator {
  resolve({
    rodLimitKg,
    fishTensionKg,
    holdAction,
    controlAction,
    controlEligibility = null,
    config = {},
  } = {}) {
    const enabled = config.enabled !== false;
    const rodLimit = this.#positive(rodLimitKg);
    const fishTension = this.#positive(fishTensionKg);
    const holdActive = !!holdAction?.active;
    const controlConfig = config.control || {};
    const rawControlInputRatio = controlAction?.active
      ? this.#clamp01(controlAction?.inputRatio)
      : 0;
    const minControlInputRatio = this.#clamp01(
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
    const holdMultiplier = this.#positive(
      ceiling.holdMultiplier,
      this.#positive(config.holdMultiplier, 1),
    );
    const controlMultiplier = this.#positive(
      ceiling.controlMultiplier,
      this.#positive(config.controlMultiplier, 1),
    );
    const maxCombinedMultiplier = Math.max(
      1,
      this.#positive(
        ceiling.maxCombinedMultiplier,
        this.#positive(config.maxCombinedMultiplier, 1.0),
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

    const maxBudgetShare = this.#clamp01(
      Number(controlConfig.maxBudgetShare ?? 0.5),
    );
    const controlShare = this.#clamp01(controlInputRatio * maxBudgetShare);
    return {
      holdShare: this.#clamp01(1 - controlShare),
      controlShare,
    };
  }

  #reason({ holdActive, controlActive }) {
    if (holdActive && controlActive) return "hold_and_control";
    if (holdActive) return "hold_only";
    if (controlActive) return "control_only";
    return "no_player_force";
  }

  #positive(value, fallback = 0) {
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) return number;
    const safeFallback = Number(fallback);
    return Number.isFinite(safeFallback) && safeFallback >= 0
      ? safeFallback
      : 0;
  }

  #clamp01(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(1, number));
  }

  #freeze(data) {
    return Object.freeze(data);
  }
}

if (typeof window !== "undefined") {
  window.PlayerForceBudgetAllocator = PlayerForceBudgetAllocator;
}
