import { PlayerForceBudgetAllocator } from "../../domain/fishing/player_force_budget_allocator.js";
import { PlayerPressureFatigueCalculator } from "../../domain/fishing/player_pressure/player_pressure_fatigue_calculator.js";
import { PlayerPressureFatigueSourceResolver } from "../../domain/fishing/player_pressure/player_pressure_fatigue_source_resolver.js";
import { PlayerPressureFatigueState } from "../../domain/fishing/player_pressure/player_pressure_fatigue_state.js";
import { PlayerPressureGainResolver } from "../../domain/fishing/player_pressure/player_pressure_gain_resolver.js";
import { PlayerReelFatigueSession } from "../../domain/fishing/player_pressure/player_reel_fatigue_session.js";
import { PlayerTensionBuildRateResolver } from "../../domain/fishing/player_pressure/player_tension_build_rate_resolver.js";
import { clampUnitFinite, nonNegativeOr } from "../../../engine/math/number_normalization.js";

// Fight pipeline stages resolve_player_force_budget .. update_player_pressure_fatigue: the player's force budget,
// pressure gain, tension build rate and the pressure/reel fatigue that the orchestrator applies each step.
// Owns the fatigue state of one fight session; reset() starts it again.
export class FightPlayerPressureStage {
  #playerForceBudgetAllocator = new PlayerForceBudgetAllocator();
  #playerPressureGainResolver = new PlayerPressureGainResolver();
  #playerTensionBuildRateResolver = new PlayerTensionBuildRateResolver();
  #playerPressureFatigueCalculator = new PlayerPressureFatigueCalculator();
  #playerPressureFatigueSourceResolver = new PlayerPressureFatigueSourceResolver();
  #playerPressureFatigueState = new PlayerPressureFatigueState();
  #playerReelFatigueSession = new PlayerReelFatigueSession();
  #config;
  #physicsConfig;

  constructor({ config, physicsConfig }) {
    this.#config = config;
    this.#physicsConfig = physicsConfig;
  }

  resolvePlayerForceBudget({
    fightInput,
    forceData,
    rodLimitKg,
    physics,
    rodControlIntent,
  }) {
    const config =
      this.#physicsConfig.getPlayerForceBudgetConfig() ||
      physics?.fight?.playerForceBudget ||
      this.#config?.physics?.fight?.playerForceBudget ||
      {};
    const actions = fightInput?.fightActions || {};
    const holdAction = actions.hold?.active === true
      ? actions.hold
      : Object.freeze({
          active: !!fightInput?.isPulling,
          ratio: fightInput?.isPulling ? 1 : 0,
          source: fightInput?.isPulling ? "legacy" : "none",
        });
    const requestedControlAction = actions.lateralControl?.active === true
      ? actions.lateralControl
      : Object.freeze({
          active: !!fightInput?.rodControlActive,
          directionX: fightInput?.rodControlDirectionX || 0,
          inputRatio: Math.max(
            0,
            Math.min(1, Number(fightInput?.rodControlInputRatio) || 0),
          ),
          source: fightInput?.rodControlActive ? "legacy" : "none",
        });
    const controlAction = requestedControlAction;
    const fallbackFrame = {
      enabled: false,
      reason: "allocator_missing",
      rodLimitKg: Math.max(0, Number(rodLimitKg) || 0),
      fishTensionKg: Math.max(0, Number(forceData?.fishTensionKg) || 0),
      holdActive: !!holdAction.active,
      controlActive: !!controlAction.active,
      controlInputRatio: Math.max(
        0,
        Math.min(1, Number(controlAction.inputRatio) || 0),
      ),
      holdCeilingMultiplier: 1,
      controlCeilingMultiplier: 1,
      maxCombinedCeilingMultiplier: 1,
      rawCombinedCeilingMultiplier: 1,
      combinedCeilingMultiplier: 1,
      combinedTensionCeilingKg: Math.max(0, Number(rodLimitKg) || 0),
      totalPlayerBudgetKg: 0,
      holdShare: 0,
      controlShare: 0,
      holdBudgetKg: 0,
      controlBudgetKg: 0,
      controlRequested: requestedControlAction.active === true,
      controlEligible:
        requestedControlAction.active === true &&
        rodControlIntent?.canRequestForce !== false,
      controlBlockedReason:
        requestedControlAction.active === true &&
        rodControlIntent?.canRequestForce === false
          ? rodControlIntent?.blockedReason || "unavailable"
          : "none",
    };

    if (!this.#playerForceBudgetAllocator?.resolve) {
      return Object.freeze(fallbackFrame);
    }

    return this.#playerForceBudgetAllocator.resolve({
      rodLimitKg,
      fishTensionKg: forceData?.fishTensionKg,
      holdAction,
      controlAction,
      controlEligibility: rodControlIntent,
      config,
    });
  }

  resolvePlayerPressureGain({ playerForceBudget, physics } = {}) {
    const config = this.#resolvePlayerPressureGainConfig(physics);
    const fallback = Object.freeze({
      source: "player_pressure_gain",
      enabled: false,
      mode: "none",
      multiplier: 1,
      holdActive: false,
      controlActive: false,
      holdForceKg: 0,
      controlForceKg: 0,
      controlInputRatio: 0,
      holdForceThresholdKg: 0.01,
      controlInputThreshold: 0.05,
      controlForceThresholdKg: 0.01,
    });

    if (!this.#playerPressureGainResolver?.resolve) {
      return fallback;
    }

    return this.#playerPressureGainResolver.resolve({
      holdActive: playerForceBudget?.holdActive === true,
      controlActive: playerForceBudget?.controlActive === true,
      holdForceKg: playerForceBudget?.holdBudgetKg,
      controlForceKg: playerForceBudget?.controlBudgetKg,
      controlInputRatio: playerForceBudget?.controlInputRatio,
      config,
    });
  }

  #resolvePlayerPressureGainConfig(physics) {
    return (
      this.#physicsConfig.getPlayerPressureGainConfig() ||
      physics?.fight?.playerPressureGain ||
      this.#config?.physics?.fight?.playerPressureGain ||
      {}
    );
  }

  resolvePlayerTensionBuildRate({ playerForceBudget, physics } = {}) {
    const config = this.#resolvePlayerTensionBuildRateConfig(physics);
    const fallback = Object.freeze({
      source: "player_tension_build_rate",
      enabled: false,
      mode: "none",
      buildRateMultiplier: 1,
      holdActive: false,
      controlActive: false,
      holdForceKg: 0,
      controlForceKg: 0,
      holdInputRatio: 0,
      controlInputRatio: 0,
      applyTo: Object.freeze({
        rodHoldCharge: true,
        rodControlBuild: true,
      }),
    });

    if (!this.#playerTensionBuildRateResolver?.resolve) {
      return fallback;
    }

    return this.#playerTensionBuildRateResolver.resolve({
      holdActive: playerForceBudget?.holdActive === true,
      controlActive: playerForceBudget?.controlActive === true,
      holdForceKg: playerForceBudget?.holdBudgetKg,
      controlForceKg: playerForceBudget?.controlBudgetKg,
      holdInputRatio: playerForceBudget?.holdActive === true ? 1 : 0,
      controlInputRatio: playerForceBudget?.controlInputRatio,
      config,
    });
  }

  #resolvePlayerTensionBuildRateConfig(physics) {
    return (
      this.#physicsConfig.getPlayerTensionBuildRateConfig() ||
      physics?.fight?.playerTensionBuildRate ||
      this.#config?.physics?.fight?.playerTensionBuildRate ||
      {}
    );
  }

  resolvePlayerPressureFatigueSource({
    physics,
    recoverFrame,
    playerReelFatigueSession,
    rodPullResult,
    rodControlResult,
  } = {}) {
    const config = this.#resolvePlayerPressureFatigueConfig(physics);
    const effectivePressureKg =
      nonNegativeOr(rodPullResult?.forceKg) +
      nonNegativeOr(rodControlResult?.forceKg);
    const fallback = Object.freeze({
      source: "player_pressure_fatigue_source",
      sourceMode: config?.source?.mode || "reel_hold_session",
      active: false,
      reason: "missing_resolver",
      reelHoldActive: recoverFrame?.holdReelRecover?.active === true,
      reelHoldSessionActive: playerReelFatigueSession?.active === true,
      rodHoldActive: rodPullResult?.active === true,
      controlActive: rodControlResult?.canApply === true,
      effectivePressureKg,
    });

    if (!this.#playerPressureFatigueSourceResolver?.resolve) {
      return fallback;
    }

    return this.#playerPressureFatigueSourceResolver.resolve({
      reelHoldActive: recoverFrame?.holdReelRecover?.active === true,
      reelHoldSessionActive: playerReelFatigueSession?.active === true,
      rodHoldActive: rodPullResult?.active === true,
      controlActive: rodControlResult?.canApply === true,
      effectivePressureKg,
      config,
    });
  }

  updatePlayerReelFatigueSession({ recoverFrame } = {}) {
    const holdReelRecover = recoverFrame?.holdReelRecover || {};
    if (!this.#playerReelFatigueSession?.update) {
      return Object.freeze({
        active: false,
        startedThisFrame: false,
        endedThisFrame: false,
        reason: "missing_session",
      });
    }

    return this.#playerReelFatigueSession.update({
      playerHoldActive: holdReelRecover.playerHoldActive === true,
      reelHoldEngagedThisFrame: holdReelRecover.engaged === true,
      // Fight lifecycle is controlled by resetPlayerPullMotion() on fight exit/reset.
      // Keep fightActive=true during active frame simulation.
      fightActive: true,
    });
  }

  buildPlayerPressureFatigueApplicationFrame({ physics } = {}) {
    const config = this.#resolvePlayerPressureFatigueConfig(physics);
    const enabled =
      config.enabled === true &&
      !!this.#playerPressureFatigueCalculator &&
      !!this.#playerPressureFatigueState;
    const state = this.#playerPressureFatigueState.toFrame() || {};
    const efficiency = enabled ? clampUnitFinite(state.efficiency ?? 1) : 1;
    return Object.freeze({
      source: "player_pressure_fatigue_application",
      enabled,
      efficiency,
      appliedEfficiency: efficiency,
      pressureHoldMs: enabled ? nonNegativeOr(state.pressureHoldMs) : 0,
      holdElapsedMs: enabled ? nonNegativeOr(state.holdElapsedMs) : 0,
      recoveryIdleMs: enabled ? nonNegativeOr(state.recoveryIdleMs) : 0,
      recoveryState: enabled ? state.recoveryState || "full" : "disabled",
      stateName: enabled ? state.stateName || "idle" : "idle",
      sourceMode: enabled
        ? state.sourceMode || "reel_hold_session"
        : "reel_hold_session",
      sourceActive: enabled && state.sourceActive === true,
      sourceReason: enabled
        ? state.sourceReason || "reel_hold_session_inactive"
        : "disabled",
      pressureActive: enabled && state.pressureActive === true,
      pressureKg: enabled ? nonNegativeOr(state.pressureKg) : 0,
      fatigueRatio: enabled ? clampUnitFinite(1 - efficiency) : 0,
      fatigueProgress: enabled ? clampUnitFinite(state.fatigueProgress) : 0,
      graceElapsedMs: enabled ? nonNegativeOr(state.graceElapsedMs) : 0,
      graceDurationMs: enabled ? nonNegativeOr(state.graceDurationMs) : 0,
      graceRemainingMs: enabled ? nonNegativeOr(state.graceRemainingMs) : 0,
      fatigueElapsedMs: enabled ? nonNegativeOr(state.fatigueElapsedMs) : 0,
      fatigueDurationMs: enabled ? nonNegativeOr(state.fatigueDurationMs) : 0,
      fatigueRemainingMs: enabled ? nonNegativeOr(state.fatigueRemainingMs) : 0,
      recoveryDelayElapsedMs: enabled
        ? nonNegativeOr(state.recoveryDelayElapsedMs)
        : 0,
      recoveryDelayMs: enabled ? nonNegativeOr(state.recoveryDelayMs) : 0,
      recoveryDelayRemainingMs: enabled
        ? nonNegativeOr(state.recoveryDelayRemainingMs)
        : 0,
      recoveryProgress: enabled ? clampUnitFinite(state.recoveryProgress) : 0,
      recoveryRemainingMs: enabled
        ? nonNegativeOr(state.recoveryRemainingMs)
        : 0,
      controlBreakEnabled: enabled && state.controlBreakEnabled === true,
      isControlExhausted: enabled && state.isControlExhausted === true,
      controlBreakFatigueProgressThreshold: enabled
        ? clampUnitFinite(
            state.controlBreakFatigueProgressThreshold ??
              state.controlBreakFatigueRatioThreshold ??
              0.9,
          )
        : 0,
      controlBreakFatigueRatioThreshold: enabled
        ? clampUnitFinite(
            state.controlBreakFatigueProgressThreshold ??
              state.controlBreakFatigueRatioThreshold ??
              0.9,
          )
        : 0,
      controlBreakMinContinuousPressureMs: enabled
        ? nonNegativeOr(state.controlBreakMinContinuousPressureMs)
        : 0,
      channels: this.#resolvePlayerPressureFatigueChannels(config),
    });
  }

  updatePlayerPressureFatigueFrame({
    dtSec,
    physics,
    appliedFrame,
    sourceFrame,
    rodPullResult,
    rodControlResult,
  } = {}) {
    const config = this.#resolvePlayerPressureFatigueConfig(physics);
    const enabled =
      config.enabled === true &&
      !!this.#playerPressureFatigueCalculator &&
      !!this.#playerPressureFatigueState;
    const channels = this.#resolvePlayerPressureFatigueChannels(config);
    const rawRodHoldKg = nonNegativeOr(
      rodPullResult?.rawForceKg ?? rodPullResult?.forceKg,
    );
    const rawControlKg = nonNegativeOr(
      rodControlResult?.rawForceKg ?? rodControlResult?.forceKg,
    );
    const fatiguedRodHoldKg = nonNegativeOr(rodPullResult?.forceKg);
    const fatiguedControlKg = nonNegativeOr(rodControlResult?.forceKg);
    const pressureKg =
      (channels.rodHold ? fatiguedRodHoldKg : 0) +
      (channels.rodControl ? fatiguedControlKg : 0);

    if (!enabled) {
      this.#playerPressureFatigueState.reset();
      return Object.freeze({
        source: "player_pressure_fatigue",
        enabled: false,
        efficiency: 1,
        appliedEfficiency: 1,
        nextEfficiency: 1,
        pressureHoldMs: 0,
        holdElapsedMs: 0,
        recoveryIdleMs: 0,
        recoveryState: "disabled",
        stateName: "idle",
        sourceMode: config.source?.mode || "reel_hold_session",
        sourceActive: false,
        sourceReason: "disabled",
        pressureActive: false,
        pressureKg: 0,
        fatigueRatio: 0,
        fatigueProgress: 0,
        graceElapsedMs: 0,
        graceDurationMs: nonNegativeOr(config.graceDurationMs),
        graceRemainingMs: 0,
        fatigueElapsedMs: 0,
        fatigueDurationMs: nonNegativeOr(config.fatigueDurationMs),
        fatigueRemainingMs: 0,
        recoveryDelayElapsedMs: 0,
        recoveryDelayMs: nonNegativeOr(config.recovery?.delayAfterPressureMs),
        recoveryDelayRemainingMs: 0,
        recoveryProgress: 0,
        recoveryRemainingMs: 0,
        controlBreakEnabled: config.controlBreak?.enabled === true,
        isControlExhausted: false,
        controlBreakFatigueProgressThreshold:
          clampUnitFinite(
            config.controlBreak?.fatigueProgressThreshold ??
              config.controlBreak?.fatigueRatioThreshold ??
              0.9,
          ),
        controlBreakFatigueRatioThreshold:
          clampUnitFinite(
            config.controlBreak?.fatigueProgressThreshold ??
              config.controlBreak?.fatigueRatioThreshold ??
              0.9,
          ),
        controlBreakMinContinuousPressureMs:
          nonNegativeOr(config.controlBreak?.minContinuousPressureMs),
        channels,
        rawRodHoldKg,
        rawControlKg,
        fatiguedRodHoldKg,
        fatiguedControlKg,
      });
    }

    const nextFrame = this.#playerPressureFatigueCalculator.calculate({
      state: this.#playerPressureFatigueState,
      dtSec,
      pressureKg,
      sourceResult: sourceFrame,
      sourceActive: sourceFrame?.active === true,
      sourceMode: sourceFrame?.sourceMode,
      sourceReason: sourceFrame?.reason,
      config,
    });
    this.#playerPressureFatigueState.applyFrame(nextFrame);

    return Object.freeze({
      ...nextFrame,
      source: "player_pressure_fatigue",
      appliedEfficiency: clampUnitFinite(
        appliedFrame?.appliedEfficiency ?? appliedFrame?.efficiency ?? 1,
      ),
      nextEfficiency: nextFrame.efficiency,
      channels,
      rawRodHoldKg,
      rawControlKg,
      fatiguedRodHoldKg,
      fatiguedControlKg,
    });
  }

  #resolvePlayerPressureFatigueConfig(physics) {
    return (
      this.#physicsConfig.getPlayerPressureFatigueConfig() ||
      physics?.fight?.playerPressureFatigue ||
      this.#config?.physics?.fight?.playerPressureFatigue ||
      {}
    );
  }

  #resolvePlayerPressureFatigueChannels(config = {}) {
    const channels = config.channels || {};
    return Object.freeze({
      rodHold: channels.rodHold !== false,
      rodControl: channels.rodControl !== false,
    });
  }

  reset() {
    this.#playerPressureFatigueState.reset();
    this.#playerReelFatigueSession.reset();
  }
}
