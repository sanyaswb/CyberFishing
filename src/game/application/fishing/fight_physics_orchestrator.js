import { FightInputActionComposer } from "../input/fight_input_action_composer.js";
import { FightPhysicsPipeline } from "./fight_physics_pipeline.js";
import { FISH_FIGHT_EVENT } from "../../domain/fish/fish_fight_event.js";
import { FishRetrieveSystem } from "../../domain/fishing/fish_retrieve_system.js";
import { LandingLiftReadinessPolicy } from "../../domain/fishing/landing_lift_readiness_policy.js";
import { LandingLiftTensionCalculator } from "../../domain/fishing/landing_lift_tension_calculator.js";
import { LandingPolicyResolver } from "../../domain/fishing/landing_policy_resolver.js";
import { LineConstrainedFishMotionResolver } from "../../domain/fishing/line_constrained_fish_motion_resolver.js";
import { LineConstraintStateResolver } from "../../domain/fishing/line_constraint_state_resolver.js";
import { LineRadialMovementSplitter } from "../../domain/fishing/line_radial_movement_splitter.js";
import { LooseLineCalculator } from "../../domain/fishing/loose_line_calculator.js";
import { RecoverableLineCalculator } from "../../domain/fishing/recoverable_line_calculator.js";
import { PlayerForceBudgetAllocator } from "../../domain/fishing/player_force_budget_allocator.js";
import { PlayerPressureFatigueCalculator } from "../../domain/fishing/player_pressure/player_pressure_fatigue_calculator.js";
import { PlayerPressureFatigueSourceResolver } from "../../domain/fishing/player_pressure/player_pressure_fatigue_source_resolver.js";
import { PlayerPressureFatigueState } from "../../domain/fishing/player_pressure/player_pressure_fatigue_state.js";
import { PlayerPressureGainResolver } from "../../domain/fishing/player_pressure/player_pressure_gain_resolver.js";
import { PlayerPullMotionSmoother } from "../../domain/fishing/player_pull_motion_smoother.js";
import { PlayerReelFatigueSession } from "../../domain/fishing/player_pressure/player_reel_fatigue_session.js";
import { PlayerTensionBuildRateResolver } from "../../domain/fishing/player_pressure/player_tension_build_rate_resolver.js";
import { PoleFightSectorAngleConstraint } from "../../domain/fishing/pole_fight_sector_angle_constraint.js";
import { PoleFightSectorConstraint } from "../../domain/fishing/pole_fight_sector_constraint.js";
import { ReelHoldRecoverySystem } from "../../domain/fishing/reel_hold_recovery_system.js";
import { ReelRecoveryFishSlowdownPolicy } from "../../domain/fishing/reel_recovery_fish_slowdown_policy.js";
import { RodControlMovementProjector } from "../../domain/fishing/rod_control_movement_projector.js";
import { RodStrokeDistanceTracker } from "../../domain/fishing/rod_stroke_distance_tracker.js";
import { RodStrokeTracker } from "../../domain/fishing/rod_stroke_tracker.js";
import { StaminaBalanceFrame } from "../../domain/fishing/stamina/stamina_balance_frame.js";
import { Vector2 } from "../../../engine/math/vector2.js";
import { hasLineReserve } from "../../domain/fishing/line_reserve.js";
import { clampUnitFinite, nonNegativeOr } from "../../../engine/math/number_normalization.js";

export class FightPhysicsOrchestrator {
  #config;
  #physicsConfig;
  #velocityScratch = new Vector2(0, 0);
  #radialTargetVelocity = new Vector2(0, 0);
  #waterProbePoint = { x: 0, y: 0 };
  #recoverableLineCalculator = new RecoverableLineCalculator();
  #looseLineCalculator = new LooseLineCalculator();
  #rodStrokeTracker = new RodStrokeTracker();
  #rodStrokeDistanceTracker = new RodStrokeDistanceTracker();
  #playerPullMotionSmoother = new PlayerPullMotionSmoother();
  #reelHoldRecoverySystem = new ReelHoldRecoverySystem();
  #recoveryFishSlowdownPolicy = new ReelRecoveryFishSlowdownPolicy();
  #landingPolicyResolver = new LandingPolicyResolver();
  #landingLiftCalculator = new LandingLiftTensionCalculator();
  #landingLiftReadinessPolicy = new LandingLiftReadinessPolicy();
  #lineConstraintStateResolver = new LineConstraintStateResolver();
  #lineConstrainedFishMotionResolver =
    new LineConstrainedFishMotionResolver();
  #lineConstrainedFishMotionPreviewResolver =
    new LineConstrainedFishMotionResolver();
  #lineRadialMovementSplitter = new LineRadialMovementSplitter();
  #modelFishVelocityScratch = { x: 0, y: 0 };
  #previewLineConstraintStateScratch = {};
  #rodControlMovementProjector = new RodControlMovementProjector();
  #poleFightSectorConstraint = new PoleFightSectorConstraint();
  #poleFightSectorAngleConstraint = new PoleFightSectorAngleConstraint();
  #fightInputActionComposer = new FightInputActionComposer();
  #playerForceBudgetAllocator = new PlayerForceBudgetAllocator();
  #playerPressureGainResolver = new PlayerPressureGainResolver();
  #playerTensionBuildRateResolver = new PlayerTensionBuildRateResolver();
  #playerPressureFatigueCalculator = new PlayerPressureFatigueCalculator();
  #playerPressureFatigueSourceResolver = new PlayerPressureFatigueSourceResolver();
  #playerPressureFatigueState = new PlayerPressureFatigueState();
  #playerReelFatigueSession = new PlayerReelFatigueSession();
  #staminaBalanceFrame = new StaminaBalanceFrame();
  #composedInputScratch = {};
  #pipeline;
  #logger;
  #fishRetrieveSystem;
  #staminaBudgetOverflowWarningActive = false;
  #fishWasInCatchZone = false;
  #landingLiftHoldKg = 0;
  #holdReelRecoverState = {
    eligible: false,
    active: false,
    timerMs: 0,
    delayMs: 3000,
    reelLoadReserveRatio: 0,
    reelMaxLoadKg: 0,
    recoverSpeedMetersPerSecond: 0,
    maxMoveMeters: 0,
    blockedReason: "not_checked",
    source: "none",
  };
  #lineRecoveryFishSlowdownState = {
    active: false,
    multiplier: 1,
    source: "none",
    recoveredMeters: 0,
  };
  #debug = {};
  #fightFrame = {};
  #playerMaxPowerY = 0;
  #diagnosticsSnapshotBuilder;

  // stepClock: high-resolution clock for the pipeline's diagnostic step durations (injected by bootstrap).
  // logger: the platform diagnostics logger (stamina budget invariant warnings); without it they are skipped.
  // diagnosticsSnapshotBuilder: the DEV snapshot builder (Development composition and checks); production composes
  // none and keeps only the fight frame.
  constructor(config, { stepClock = null, logger = null, diagnosticsSnapshotBuilder = null } = {}) {
    this.#logger = logger;
    this.#diagnosticsSnapshotBuilder = diagnosticsSnapshotBuilder;
    this.#pipeline = new FightPhysicsPipeline({ now: stepClock });
    this.#config = config || {};
    this.#physicsConfig = this.#config.fightPhysicsConfig;
    this.#fishRetrieveSystem = new FishRetrieveSystem(this.#physicsConfig);
  }

  step({
    dtMs,
    floatEntity,
    bounds,
    input,
    env,
    checkWater,
    rodTipPosition,
    actualRodTipPosition,
    rodControlCastAnchor,
    rod,
    reel,
    fishForceSystem,
    lineSystem,
    dragSystem,
    pullInputMapper,
    rodPullSystem,
    rodControlSystem,
    reelSystem,
    tensionSystem,
    stressSystem,
    fishCondition,
  }) {
    const pipelineFrame = this.#pipeline.startFrame();
    const physics = pipelineFrame.run(
      "read_runtime_config",
      () => this.#getRuntimePhysicsConfig(),
    );
    const rodControlTargetAnchor = pipelineFrame.run(
      "resolve_rod_control_target_anchor",
      () => this.#resolveRodControlTargetAnchor({
        currentBaseRodTipPosition: rodTipPosition,
        castBaseRodTipPosition: rodControlCastAnchor,
        physics,
      }),
    );
    const dtSec = pipelineFrame.run(
      "resolve_delta_time",
      () => this.#getDtSec(dtMs, physics),
    );
    const fightInput = pipelineFrame.run(
      "compose_fight_input_actions",
      () => this.#composeFightInput(input),
    );
    const pullInput = pipelineFrame.run(
      "read_input",
      () => this.#updateInput({ input: fightInput, pullInputMapper, dragSystem, dtSec }),
    );
    const hasReel = !!reel.hasReel();
    const dragSupported = hasReel && reel.hasDrag() !== false;
    const isPullMode = !!pullInput.pullHeld;
    const isRecoverMode = hasReel && !isPullMode;
    const maxTackleLoadKg = stressSystem.getEffectiveMaxTackleLoadKg() || 0;
    const rodLimitKg =
      stressSystem.getEffectiveRodMaxLoadKg() || maxTackleLoadKg;
    const motion = pipelineFrame.run("update_fish_motion", () => this.#updateFishMotion({
      dtMs,
      dtSec,
      floatEntity,
      bounds,
      input: fightInput,
      env,
      checkWater,
      rodTipPosition,
      rod,
      reel,
      fishForceSystem,
      lineSystem,
      dragSystem,
      rodPullSystem,
      fishCondition,
      playerMaxLoadKg: maxTackleLoadKg,
      lineRecoveryFishSlowdown: this.#lineRecoveryFishSlowdownState,
    }));
    const forceData = motion.forceData;
    const playerForceFrame = pipelineFrame.run(
      "resolve_player_force_budget",
      () => {
        const rodControlIntent = this.#resolveRodControlIntent({
          fightInput,
          floatEntity,
          rodTipPosition,
          rodControlTargetAnchor,
          actualRodTipPosition,
          rodControlSystem,
        });
        return {
          rodControlIntent,
          budget: this.#resolvePlayerForceBudget({
            fightInput,
            forceData,
            rodLimitKg: maxTackleLoadKg,
            physics,
            rodControlIntent,
          }),
        };
      },
    );
    const playerForceBudget = playerForceFrame.budget;
    const playerPressureGainFrame = pipelineFrame.run(
      "resolve_player_pressure_gain",
      () => this.#resolvePlayerPressureGain({
        playerForceBudget,
        physics,
      }),
    );
    const playerTensionBuildRateFrame = pipelineFrame.run(
      "resolve_player_tension_build_rate",
      () => this.#resolvePlayerTensionBuildRate({
        playerForceBudget,
        physics,
      }),
    );
    const playerPressureFatigueApplication = pipelineFrame.run(
      "resolve_player_pressure_fatigue_application",
      () => this.#buildPlayerPressureFatigueApplicationFrame({ physics }),
    );
    const dragContext = pipelineFrame.run("resolve_drag_context", () =>
      this.#resolveDragContext({
      hasReel,
      dragSupported,
      dragSystem,
      forceData,
      maxTackleLoadKg,
      rodLimitKg,
      playerForceBudget,
    }),
    );

    const rodPullFrame = pipelineFrame.run(
      "resolve_rod_pull_and_retrieve",
      () => this.#updateRodPull({
      dtSec,
      pullInput,
      floatEntity,
      rodTipPosition,
      rod,
      lineSystem,
      rodPullSystem,
      fishRetrieveSystem: this.#fishRetrieveSystem,
      forceData,
      lineStateBeforeFishMotion: motion.lineStateBeforeFishMotion,
      fishCondition,
      dragContext,
      physics,
      bounds,
      checkWater,
      holdReelRecover: this.#holdReelRecoverState,
      isRecoverMode,
      reel,
      rodLimitKg,
      playerForceBudget,
      playerPressureGain: playerPressureGainFrame,
      playerTensionBuildRate: playerTensionBuildRateFrame,
      playerPressureFatigue: playerPressureFatigueApplication,
    }),
    );
    const rodControlFrame = pipelineFrame.run(
      "resolve_rod_control_x",
      () => this.#updateRodControl({
      dtSec,
      input: fightInput,
      floatEntity,
      rodTipPosition,
      rodControlTargetAnchor,
      actualRodTipPosition,
      lineSystem,
      rodControlSystem,
      forceData,
      dragContext,
      stressSystem,
      bounds,
      checkWater,
      maxTackleLoadKg,
      rodLimitKg,
      lineState: rodPullFrame.lineStateAfterPull,
      fishRetrieveResult: rodPullFrame.fishRetrieveResult,
      playerForceBudget,
      rodControlIntent: playerForceFrame.rodControlIntent,
      playerPressureGain: playerPressureGainFrame,
      playerTensionBuildRate: playerTensionBuildRateFrame,
      playerPressureFatigue: playerPressureFatigueApplication,
    }),
    );
    const lineStateAfterControl =
      rodControlFrame.lineStateAfterControl || rodPullFrame.lineStateAfterPull;
    const tensionPreview = pipelineFrame.run(
      "preview_tension",
      () => this.#calculateTension({
      tensionSystem,
      stressSystem,
      forceData,
      rodPullResult: rodPullFrame.rodPullResult,
      fishRetrieveResult: rodPullFrame.fishRetrieveResult,
      rodControlResult: rodControlFrame.rodControlResult,
      dragContext,
      lineState: lineStateAfterControl,
      hardLineLimit: rodPullFrame.hardLineLimitBeforeRelease,
    }),
    );
    const strokeDistanceFrame = pipelineFrame.run(
      "update_rod_stroke_distance",
      () => this.#recordRodStrokeDistance({
        rodPullSystem,
        previousLineState: rodPullFrame.lineStateBeforePull,
        currentLineState: rodPullFrame.lineStateAfterPull,
      }),
    );
    const postStrokeRodPullResult = rodPullSystem.getState() ||
      rodPullFrame.rodPullResult;
    const recoverFrame = pipelineFrame.run("recover_line", () => {
      const recoveryLoad = this.#resolveReelRecoveryLoad({
        tensionResult: tensionPreview,
        dragContext,
      });
      const holdReelRecover = this.#updateHoldReelRecovery({
      dtMs,
      isPullMode,
      hasReel,
      reel,
      rodPullResult: postStrokeRodPullResult,
      tensionPreview,
      dragContext,
      physics,
      lineState: lineStateAfterControl,
    });
      const autoRecovery = this.#recoverRodStrokeCredit({
      dtSec,
      reelSystem,
      lineSystem,
      reel,
      tensionKg: recoveryLoad.tensionKg,
      blockedReason: recoveryLoad.blockedReason,
      playerHoldActive: isPullMode,
      strokeWonMeters: postStrokeRodPullResult.rodStrokeWonMeters,
      fishDistanceMeters: lineStateAfterControl.distanceMeters,
    });
      const holdRecoveredMeters = holdReelRecover.recoveringLine
        ? this.#recoverLineCredit({
            dtSec,
            reelSystem,
            lineSystem,
            reel,
            tensionKg: recoveryLoad.tensionKg,
            isRecoverMode: true,
            loadLimitKg: holdReelRecover.reelMaxLoadKg,
            maxRecoverMeters: holdReelRecover.maxMoveMeters,
          })
        : 0;
      return {
        holdReelRecover,
        autoRecovery,
        recoveredMeters: autoRecovery.recoveredMeters + holdRecoveredMeters,
        autoRecoveredMeters: autoRecovery.recoveredMeters,
        holdRecoveredMeters,
      };
    });
    const playerReelFatigueSessionFrame = pipelineFrame.run(
      "update_player_reel_fatigue_session",
      () => this.#updatePlayerReelFatigueSession({
        recoverFrame,
      }),
    );
    const playerPressureFatigueSourceFrame = pipelineFrame.run(
      "resolve_player_pressure_fatigue_source",
      () => this.#resolvePlayerPressureFatigueSource({
        physics,
        recoverFrame,
        playerReelFatigueSession: playerReelFatigueSessionFrame,
        rodPullResult: postStrokeRodPullResult,
        rodControlResult: rodControlFrame.rodControlResult,
      }),
    );
    const playerPressureFatigueFrame = pipelineFrame.run(
      "update_player_pressure_fatigue",
      () => this.#updatePlayerPressureFatigueFrame({
        dtSec,
        physics,
        appliedFrame: playerPressureFatigueApplication,
        sourceFrame: playerPressureFatigueSourceFrame,
        rodPullResult: postStrokeRodPullResult,
        rodControlResult: rodControlFrame.rodControlResult,
      }),
    );
    this.#recoveryFishSlowdownPolicy.update({
      target: this.#lineRecoveryFishSlowdownState,
      autoRecoveredMeters: recoverFrame.autoRecoveredMeters,
      holdRecoveredMeters: recoverFrame.holdRecoveredMeters,
      config:
        this.#physicsConfig.getReelRecoveryConfig() ||
        this.#getRuntimePhysicsConfig()?.fight?.reelRecovery ||
        {},
    });
    const holdReelRecover = recoverFrame.holdReelRecover;
    const recoveredMeters = recoverFrame.recoveredMeters;
    rodPullSystem.recoverStroke({
      recoveredMeters: recoverFrame.autoRecoveredMeters,
    });
    const lineLimit = pipelineFrame.run(
      "resolve_line_constraint",
      () => this.#resolveLineLimit({
      floatEntity,
      rodTipPosition,
      lineSystem,
      dragSystem,
      dragContext,
      tensionResult: tensionPreview,
      physics,
      velocity: motion.velocity,
      hardLineLimitBeforeRelease: rodPullFrame.hardLineLimitBeforeRelease,
    }),
    );
    const sectorFrame = pipelineFrame.run(
      "inspect_pole_fight_sector",
      () => this.#inspectPoleFightSector({
        floatEntity,
        rodTipPosition,
        lineSystem,
      }),
    );
    const finalLineState = sectorFrame.lineState || lineLimit.lineState;
    const finalLineConstraintState =
      lineLimit.lineConstraintState ||
      rodControlFrame.lineConstraintState ||
      motion.lineConstraintStateBeforeFishMotion;
    const tensionResult = pipelineFrame.run(
      "update_final_tension",
      () => this.#updateTension({
      tensionSystem,
      stressSystem,
      forceData,
      rodPullResult: postStrokeRodPullResult,
      fishRetrieveResult: rodPullFrame.fishRetrieveResult,
      rodControlResult: rodControlFrame.rodControlResult,
      dragContext,
      lineState: finalLineState,
      hardLineLimit:
        !!lineLimit.hardLineLimit ||
        !!finalLineConstraintState?.hardLineLimit,
      dtSec,
      pullInput,
    }),
    );
    const landingFrame = pipelineFrame.run(
      "resolve_landing_frame",
      () => this.#buildLandingFrame({
        forceData,
        lineState: finalLineState,
        tensionResult,
      }),
    );
    const staminaFrame = pipelineFrame.run(
      "resolve_stamina_frame",
      () => this.#buildStaminaFrame({
        forceData,
        rodPullResult: postStrokeRodPullResult,
        rodControlResult: rodControlFrame.rodControlResult,
        fishRetrieveResult: rodPullFrame.fishRetrieveResult,
        lineState: finalLineState,
        stressSystem,
        fishCondition,
        floatEntity,
        rodTipPosition,
        physics,
        fightInput,
        dtSec,
        isPullMode,
        isRecoverMode,
        holdReelRecover,
        playerPressureFatigue: playerPressureFatigueFrame,
      }),
    );
    const rodPullDisplay = rodPullSystem.getState();

    const snapshotInput = {
      dtSec,
      forceData,
      dragSystem,
      lineState: finalLineState,
      finalRecoverableLineMeters: lineLimit.finalRecoverableLineMeters,
      initialRecoverableLineMeters: rodPullFrame.initialRecoverableLineMeters,
      actualSlackMeters: lineLimit.actualSlackMeters,
      releaseResult: lineLimit.releaseResult,
      recoveredMeters,
      autoRecovery: recoverFrame.autoRecovery,
      strokeDistanceFrame,
      prePullStrokeDistanceFrame: rodPullFrame.prePullStrokeDistanceFrame,
      autoRecoveredMeters: recoverFrame.autoRecoveredMeters,
      holdRecoveredMeters: recoverFrame.holdRecoveredMeters,
      hardLineLimit: lineLimit.hardLineLimit,
      constraintResult: lineLimit.constraintResult,
      rodPullDisplay,
      rodPullResult: postStrokeRodPullResult,
      rodPullMoveMeters: rodPullFrame.rodPullMoveMeters,
      rodControlResult: rodControlFrame.rodControlResult,
      rodControlMoveMeters: rodControlFrame.rodControlMoveMeters,
      rodControlMovePx: rodControlFrame.rodControlMovePx,
      rodControlMovementBlockReason: rodControlFrame.rodControlMovementBlockReason,
      lineConstraintState: finalLineConstraintState,
      holdReelRecoverMoveMeters: rodPullFrame.holdReelRecoverMoveMeters,
      previousReelHoldEngaged: rodPullFrame.previousReelHoldEngaged,
      previousReelHoldActive: rodPullFrame.previousReelHoldActive,
      rodPullMovementBlockReason: rodPullFrame.rodPullMovementBlockReason,
      reelHoldMovementBlockReason: rodPullFrame.reelHoldMovementBlockReason,
      hardTensionBlocked: rodPullFrame.hardTensionBlocked,
      fishRetrieveResult: rodPullFrame.fishRetrieveResult,
      landingLiftResult: tensionResult.landingLift,
      landingFrame,
      staminaFrame,
      tensionResult,
      stressSystem,
      physics,
      isPullMode,
      isRecoverMode,
      holdReelRecover,
      dragContext,
      playerForceBudget,
      playerPressureGain: playerPressureGainFrame,
      playerTensionBuildRate: playerTensionBuildRateFrame,
      playerReelFatigueSession: playerReelFatigueSessionFrame,
      playerPressureFatigue: playerPressureFatigueFrame,
      poleFightSectorFrame: sectorFrame,
      fishCondition,
    };
    pipelineFrame.run("write_debug_snapshot", () => {
      this.#writeFightFrame(snapshotInput);
      if (this.#diagnosticsSnapshotBuilder) {
        this.#debug = this.#diagnosticsSnapshotBuilder.build(snapshotInput, {
          fightFrame: this.#fightFrame,
          physicsConfig: this.#physicsConfig,
          playerPullMotion: this.#playerPullMotionSmoother.getDiagnostics(),
          playerMaxPowerY: this.#playerMaxPowerY,
        });
      }
    });
    stressSystem.setFightFrame(this.#fightFrame);
    if (this.#diagnosticsSnapshotBuilder) {
      this.#debug.fightPipeline = pipelineFrame.toDebugData();
      stressSystem.setDiagnostics(this.#debug);
    }

    return {
      consumedSwipe: false,
      forces: {
        pX: rodControlFrame.rodControlResult?.forceKg || 0,
        pY: rodPullFrame.rodPullResult.forceKg,
        fX: forceData.targetVelocity.x,
        fY: forceData.targetVelocity.y,
      },
      pMax: this.#playerMaxPowerY,
      fMag: forceData.totalFishForceKg,
      forceData,
      fightFrame: {
        landing: landingFrame,
        stamina: staminaFrame,
      },
    };
  }

  #getDtSec(dtMs, physics) {
    return Math.min(
      Math.max(0, Number(dtMs) || 0),
      this.#physicsConfig.getMaxDtMs() ?? 50,
    ) / 1000;
  }

  #composeFightInput(input = {}) {
    const source = input || {};
    const target = this.#composedInputScratch;
    Object.assign(target, source);

    const actions = source.fightActions || this.#fightInputActionComposer.compose(
      source,
      {
        keys: this.#config?.input?.keys || {},
        rodControlInput:
          this.#physicsConfig?.getRodControlConfig?.()?.input ||
          this.#config?.physics?.fight?.rodControl?.input ||
          {},
      },
    );

    if (!actions?.hold || !actions?.lateralControl) {
      target.fightActions = null;
      return target;
    }

    target.fightActions = actions;
    target.isPulling = !!actions.hold.active;
    target.holdInputRatio = Number(actions.hold.ratio) || 0;
    target.holdInputSource = actions.hold.source || "none";
    target.rodControlActive = !!actions.lateralControl.active;
    target.rodControlDirectionX = actions.lateralControl.directionX || 0;
    target.rodControlInputRatio = Math.max(
      0,
      Math.min(1, Number(actions.lateralControl.inputRatio) || 0),
    );
    target.rodControlInputSource = actions.lateralControl.source || "none";
    return target;
  }

  #updateInput({ input, pullInputMapper, dragSystem, dtSec }) {
    const pullInput = pullInputMapper.update(input) || {
      pullHeld: !!input?.isPulling,
      pullStartedThisFrame: !!input?.isPulling,
      pullReleasedThisFrame: false,
    };
    dragSystem.update(input, dtSec);
    return pullInput;
  }

  #resolveRodControlIntent({
    fightInput,
    floatEntity,
    rodTipPosition,
    rodControlTargetAnchor,
    actualRodTipPosition,
    rodControlSystem,
  }) {
    if (!rodControlSystem?.resolveIntent) return null;
    return rodControlSystem.resolveIntent({
      inputState: fightInput,
      fishPosition: floatEntity.getPosition(),
      rodTipPosition,
      baseRodTipPosition: rodControlTargetAnchor || rodTipPosition,
      actualRodTipPosition,
      config: this.#physicsConfig.getRodControlConfig() || {},
    });
  }

  #resolveRodControlTargetAnchor({
    currentBaseRodTipPosition,
    castBaseRodTipPosition,
    physics,
  } = {}) {
    const config =
      this.#physicsConfig.getRodControlConfig() ||
      physics?.fight?.rodControl ||
      {};
    const requestedMode =
      config.alignment?.targetAnchorMode === "cast_base"
        ? "cast_base"
        : "current_base";
    const mode =
      requestedMode === "cast_base" && this.#hasPoint(castBaseRodTipPosition)
        ? "cast_base"
        : "current_base";
    const source =
      mode === "cast_base"
        ? castBaseRodTipPosition
        : currentBaseRodTipPosition;
    if (!this.#hasPoint(source)) return null;
    return Object.freeze({
      x: Number(source.x),
      y: Number(source.y),
      mode,
    });
  }

  #hasPoint(point) {
    return (
      point &&
      Number.isFinite(Number(point.x)) &&
      Number.isFinite(Number(point.y))
    );
  }

  #resolvePlayerForceBudget({
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

  #resolvePlayerPressureGain({ playerForceBudget, physics } = {}) {
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

  #resolvePlayerTensionBuildRate({ playerForceBudget, physics } = {}) {
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

  #resolvePlayerPressureFatigueSource({
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

  #updatePlayerReelFatigueSession({ recoverFrame } = {}) {
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

  #buildPlayerPressureFatigueApplicationFrame({ physics } = {}) {
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

  #updatePlayerPressureFatigueFrame({
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

  #updateFishMotion({
    dtMs,
    dtSec,
    floatEntity,
    bounds,
    input,
    env,
    checkWater,
    rodTipPosition,
    rod,
    reel,
    fishForceSystem,
    lineSystem,
    dragSystem,
    rodPullSystem,
    fishCondition,
    playerMaxLoadKg,
    lineRecoveryFishSlowdown,
  }) {
    const fishPosition = floatEntity.getPosition();
    const previousFishX = Number(fishPosition.x) || 0;
    const previousFishY = Number(fishPosition.y) || 0;
    const fishVelocity = floatEntity.getVelocity() || this.#velocityScratch.set(0, 0);
    const lineState = lineSystem.updateDistance(fishPosition, rodTipPosition);
    const previousRodPullState = rodPullSystem.getState() || {};
    const activeRodHoldKg = input?.isPulling
      ? Number(
          previousRodPullState.effectiveForceKg ??
            previousRodPullState.forceKg,
        ) || 0
      : 0;
    const landingPolicy = this.#landingPolicyResolver.resolve({ rod, reel });
    const landingDistanceMeters = landingPolicy.getLandingDistanceMeters({
      rod,
      reel,
      config: this.#config,
      lineDistanceMeters: lineState.distanceMeters,
    });
    const shoreLandingDistanceMeters = this.#calculateShoreLandingDistanceMeters({
      fishPosition,
      bounds,
    });
    const inCatchZone =
      landingDistanceMeters > 0 &&
      shoreLandingDistanceMeters <= landingDistanceMeters + 0.001;
    if (inCatchZone && !this.#fishWasInCatchZone) {
      fishForceSystem.handleFightEvent({
        type: FISH_FIGHT_EVENT.CATCH_ZONE_ENTERED,
        lineDistanceMeters: lineState.distanceMeters,
        shoreLandingDistanceMeters,
        landingDistanceMeters,
      });
    }
    this.#fishWasInCatchZone = inCatchZone;
    fishForceSystem.evaluateLastDashTrigger({
      dtMs,
      lineDistanceMeters: lineState.distanceMeters,
      shoreLandingDistanceMeters,
      horizontalDistanceMeters: shoreLandingDistanceMeters,
      landingDistanceMeters,
    });

    const forceData = fishForceSystem.calculate({
      dtMs,
      fishPosition,
      fishVelocity,
      rodTipPosition,
      fishCondition,
      dragRatio: dragSystem.value,
      input,
      rod,
      reel,
      playerMaxLoadKg,
      activeRodHoldKg,
      lineHasReserve: hasLineReserve(lineState),
      lineTaut: this.#isLineTaut(lineState),
      env,
      fishSpeedMultiplier:
        this.#recoveryFishSlowdownPolicy.getMotionMultiplier(
          lineRecoveryFishSlowdown,
        ) ?? 1,
    });
    forceData.landingDistanceMeters = landingDistanceMeters;
    forceData.shoreLandingDistanceMeters = shoreLandingDistanceMeters;
    forceData.lineRecoveryFishSlowdownActive =
      !!lineRecoveryFishSlowdown?.active;
    forceData.lineRecoveryFishSlowdownMultiplier =
      this.#recoveryFishSlowdownPolicy.getMotionMultiplier(
        lineRecoveryFishSlowdown,
      ) ?? 1;
    forceData.lineRecoveryFishSlowdownSource =
      lineRecoveryFishSlowdown?.source || "none";
    const fishMotionDragContext = this.#resolveFishMotionDragContext({
      reel,
      dragSystem,
    });
    const fishMotionLineConstraintState = this.#resolveLineConstraintState({
      lineState,
      dragContext: fishMotionDragContext,
      fishRetrieveResult: forceData,
    });
    const modelFishVelocity = this.#modelFishVelocityScratch;
    modelFishVelocity.x = forceData.modelFishEscapeVelocityX;
    modelFishVelocity.y = forceData.modelFishEscapeVelocityY;
    const previewLineConstraintState =
      this.#previewLineConstraintStateScratch;
    Object.assign(previewLineConstraintState, fishMotionLineConstraintState);
    previewLineConstraintState.radialConstraintActive =
      !!fishMotionLineConstraintState.lineLengthLocked;
    const activeProjectionFrame =
      this.#lineConstrainedFishMotionResolver.resolve({
        position: fishPosition,
        rodTipPosition,
        rawVelocity: modelFishVelocity,
        lineConstraintState: fishMotionLineConstraintState,
        dtSec,
      });
    const constrainedProjectionFrame =
      fishMotionLineConstraintState.radialConstraintActive
        ? activeProjectionFrame
        : this.#lineConstrainedFishMotionPreviewResolver.resolve({
            position: fishPosition,
            rodTipPosition,
            rawVelocity: modelFishVelocity,
            lineConstraintState: previewLineConstraintState,
            dtSec,
          });
    const radialMovementFrame =
      this.#lineRadialMovementSplitter.resolveVelocity({
        position: fishPosition,
        rodTipPosition,
        freeVelocity: modelFishVelocity,
        constrainedVelocity: constrainedProjectionFrame,
        releasedMeters: lineState.releasedMeters,
        pixelsPerMeter:
          this.#physicsConfig.getPixelsPerMeter() ||
          50,
        dtSec,
      });
    const projectionFrame =
      radialMovementFrame.crossedReleasedRadius ||
      fishMotionLineConstraintState.radialConstraintActive
        ? constrainedProjectionFrame
        : activeProjectionFrame;
    const frameTargetVelocity = this.#radialTargetVelocity.set(
      radialMovementFrame.velocityX,
      radialMovementFrame.velocityY,
    );

    let movementFrame = null;
    if (typeof floatEntity.applyHookedFightMovement === "function") {
      movementFrame = floatEntity.applyHookedFightMovement({
        boundsRect: bounds,
        dt: dtMs,
        environment: env,
        checkWater,
        input,
        pullDirection: forceData.player.pullDir,
        targetVelocity: frameTargetVelocity,
      });
    } else {
      const fallbackVelocity = floatEntity.getVelocity() || fishVelocity;
      fallbackVelocity.x = frameTargetVelocity.x;
      fallbackVelocity.y = frameTargetVelocity.y;
      floatEntity.update(
        bounds,
        dtMs,
        env,
        checkWater,
        input,
        0,
        forceData.player.pullDir,
      );
      movementFrame = {
        actualSpeedPxPerSec: Math.hypot(fallbackVelocity.x, fallbackVelocity.y),
        targetSpeedPxPerSec: Math.hypot(
          frameTargetVelocity.x,
          frameTargetVelocity.y,
        ),
        dampingApplied: true,
        fallbackDampedUpdate: true,
      };
    }

    const constrainedFishPosition = floatEntity.getPosition();
    const sectorMovementFrame = this.#applyPoleFightSectorAngleMovement({
      fromPosition: {
        x: previousFishX,
        y: previousFishY,
      },
      proposedPosition: constrainedFishPosition,
      velocity: floatEntity.getVelocity() || fishVelocity,
      origin: rodTipPosition,
      limitRadiusPx: this.#resolvePoleFightSectorLimitRadiusPx({
        lineState,
      }),
      adjustVelocity: true,
    });
    let prePlayerLineConstraint = null;
    const lineStateAfterFishMovement = lineSystem.updateDistance(
      constrainedFishPosition,
      rodTipPosition,
    );
    const postFishMotionLineConstraintState = this.#resolveLineConstraintState({
      lineState: lineStateAfterFishMovement,
      dragContext: fishMotionDragContext,
      fishRetrieveResult: forceData,
    });
    if (postFishMotionLineConstraintState.radialConstraintActive) {
      prePlayerLineConstraint = lineSystem.constrainPosition(
        constrainedFishPosition,
        floatEntity.getVelocity() || fishVelocity,
        rodTipPosition,
      );
    }
    const constrainedMovedX = constrainedFishPosition.x - previousFishX;
    const constrainedMovedY = constrainedFishPosition.y - previousFishY;
    movementFrame.movedX = constrainedMovedX;
    movementFrame.movedY = constrainedMovedY;
    movementFrame.actualSpeedPxPerSec = dtSec > 0
      ? Math.hypot(constrainedMovedX, constrainedMovedY) / dtSec
      : 0;
    movementFrame.poleFightSectorClamped =
      sectorMovementFrame.clamped === true;
    movementFrame.poleFightSectorActive =
      sectorMovementFrame.active === true;
    movementFrame.poleFightSectorSide =
      sectorMovementFrame.side || "none";
    movementFrame.poleFightSectorAngleDeg =
      sectorMovementFrame.proposedAngleDeg ??
      sectorMovementFrame.angleDeg ??
      0;
    movementFrame.poleFightSectorBoundaryType =
      sectorMovementFrame.boundaryType || "none";
    movementFrame.poleFightSectorAllowedMoveRatio =
      sectorMovementFrame.allowedMoveRatio ?? 1;
    movementFrame.poleFightSectorEnforceRadius =
      sectorMovementFrame.enforceRadius !== false;
    movementFrame.prePlayerLineConstraintApplied =
      prePlayerLineConstraint?.constrained === true ||
      prePlayerLineConstraint?.hardLimit === true;
    movementFrame.fishMoveRawVelocityX = modelFishVelocity.x;
    movementFrame.fishMoveRawVelocityY = modelFishVelocity.y;
    movementFrame.fishMoveAllowedVelocityX = frameTargetVelocity.x;
    movementFrame.fishMoveAllowedVelocityY = frameTargetVelocity.y;
    movementFrame.fishMoveRadialX = projectionFrame.radialX ?? 0;
    movementFrame.fishMoveRadialY = projectionFrame.radialY ?? 0;
    movementFrame.fishMoveRadialSpeedPxPerSec =
      projectionFrame.radialSpeedPxPerSec ?? 0;
    movementFrame.fishMoveBlockedRadialSpeedPxPerSec =
      projectionFrame.blockedRadialSpeedPxPerSec ?? 0;
    movementFrame.fishMoveAllowedTangentSpeedPxPerSec =
      projectionFrame.allowedTangentSpeedPxPerSec ?? 0;
    movementFrame.fishMoveConstraintActive =
      !!fishMotionLineConstraintState.radialConstraintActive ||
      !!radialMovementFrame.crossedReleasedRadius;
    movementFrame.fishMoveConstraintReason =
      fishMotionLineConstraintState.reason || "none";
    movementFrame.fishMoveProjectionReason =
      radialMovementFrame.crossedReleasedRadius &&
      projectionFrame.projectionReason === "free"
        ? "released_radius_crossed"
        : projectionFrame.projectionReason || projectionFrame.reason || "free";
    movementFrame.fishActualBlockedReason =
      this.#resolveFishActualBlockedReason({
        allowedVelocityX: frameTargetVelocity.x,
        allowedVelocityY: frameTargetVelocity.y,
        actualSpeedPxPerSec: movementFrame.actualSpeedPxPerSec,
        sectorMovementFrame,
        lineConstraintResult: prePlayerLineConstraint,
      });
    movementFrame.lineConstraintReason =
      fishMotionLineConstraintState.reason || "none";
    movementFrame.radialConstraintActive =
      !!fishMotionLineConstraintState.radialConstraintActive;
    movementFrame.lineLengthLocked =
      !!fishMotionLineConstraintState.lineLengthLocked;
    movementFrame.dragCanPayout =
      !!fishMotionLineConstraintState.dragCanPayout;
    movementFrame.dragPayoutBlocked =
      !!fishMotionLineConstraintState.dragPayoutBlocked;

    movementFrame.freeReleasedLineMeters =
      Number(lineState.freeReleasedLineMeters) ||
      Math.max(
        0,
        (Number(lineState.releasedMeters) || 0) -
        (Number(lineState.distanceMeters) || 0),
      );
    movementFrame.freeRadialTimeSec =
      radialMovementFrame.freeTimeSec;
    movementFrame.constrainedRadialTimeSec =
      radialMovementFrame.constrainedTimeSec;
    movementFrame.crossedReleasedRadius =
      radialMovementFrame.crossedReleasedRadius;
    forceData.fightMovementFrame = movementFrame;
    const currentFishY = Number(floatEntity.getPosition()?.y) || previousFishY;
    const towardPlayerYSign = this.#rodStrokeTracker.resolveTowardPlayerYSign({
      fishY: previousFishY,
      rodTipY: rodTipPosition?.y,
    });
    forceData.fightYMovementFrame = {
      ...this.#rodStrokeTracker.calculate({
        previousFishY,
        currentFishY,
        pixelsPerMeter:
          this.#physicsConfig.getPixelsPerMeter() ||
          50,
        towardPlayerYSign,
      }),
      previousFishY,
      currentFishY,
      towardPlayerYSign,
    };
    const velocity = floatEntity.getVelocity() || fishVelocity;
    return {
      forceData,
      velocity,
      movementFrame,
      lineStateBeforeFishMotion: lineState,
      lineConstraintStateBeforeFishMotion: fishMotionLineConstraintState,
    };
  }

  #resolveDragContext({ hasReel, dragSupported, dragSystem, forceData, maxTackleLoadKg, rodLimitKg }) {
    const clampedDrag = Math.max(0, Math.min(1, Number(dragSystem.value) || 0));
    const player = forceData?.player || {};
    const fallbackDragLimitKg = dragSupported
      ? Number(player.dragLimitKg) || 0
      : maxTackleLoadKg;
    const effectiveDragLimitKg = Number.isFinite(Number(player.effectiveDragLimitKg))
      ? Number(player.effectiveDragLimitKg)
      : fallbackDragLimitKg;
    const dragLocked =
      !dragSupported ||
      clampedDrag >= 0.999;
    const dragOpen =
      dragSupported &&
      !dragLocked &&
      clampedDrag <= 0.000001;

    return {
      clampedDrag,
      maxTackleLoadKg,
      rodLimitKg,
      effectiveDragLimitKg,
      dragLocked,
      dragOpen,
      hasReel,
      dragSupported,
    };
  }

  #resolveFishMotionDragContext({ reel, dragSystem } = {}) {
    const hasReel = !!reel.hasReel();
    const dragSupported = hasReel && reel.hasDrag() !== false;
    const clampedDrag = Math.max(
      0,
      Math.min(1, Number(dragSystem?.value) || 0),
    );
    const dragLocked =
      !dragSupported ||
      clampedDrag >= 0.999;
    return {
      clampedDrag,
      dragLocked,
      dragOpen:
        dragSupported &&
        !dragLocked &&
        clampedDrag <= 0.000001,
      hasReel,
      dragSupported,
    };
  }

  #calculateShoreLandingDistanceMeters({
    fishPosition,
    bounds,
  } = {}) {
    const pixelsPerMeter =
      this.#physicsConfig.getPixelsPerMeter() ||
      50;
    const shoreY = Number(bounds?.bottom) || 0;
    const fishY = Number(fishPosition?.y) || 0;
    const distancePx = Math.max(0, shoreY - fishY);
    return distancePx / Math.max(1, pixelsPerMeter);
  }

  #updateRodPull({
    dtSec,
    pullInput,
    floatEntity,
    rodTipPosition,
    rod,
    lineSystem,
    rodPullSystem,
    fishRetrieveSystem,
    forceData,
    lineStateBeforeFishMotion,
    fishCondition,
    dragContext,
    physics,
    bounds,
    checkWater,
    holdReelRecover,
    isRecoverMode,
    reel,
    rodLimitKg,
    playerForceBudget,
    playerPressureGain,
    playerTensionBuildRate,
    playerPressureFatigue,
  }) {
    const lineStateBeforePull = lineSystem.updateDistance(
      floatEntity.getPosition(),
      rodTipPosition,
    );
    const prePullStrokeDistanceFrame = this.#calculateRodStrokeDistanceFrame({
      previousDistanceMeters:
        lineStateBeforeFishMotion?.distanceMeters ??
        lineStateBeforePull.distanceMeters,
      currentDistanceMeters: lineStateBeforePull.distanceMeters,
      reasonPrefix: "pre_player",
    });
    const initialRecoverableLineMeters = this.#recoverableLineCalculator.calculateRecoverableLineMeters({
      releasedMeters: lineStateBeforePull.releasedMeters,
      fishDistanceMeters: lineStateBeforePull.distanceMeters,
    });
    const rodPullResult = rodPullSystem.update({
      dtSec,
      inputState: pullInput,
      rod,
      distanceLostBeforePullMeters:
        prePullStrokeDistanceFrame.lostMeters,
      fishForceKg: forceData.totalFishForceKg,
      fishTensionKg: forceData.fishTensionKg,
      rodLimitKg,
      playerForceBudget,
      playerPressureGain,
      playerTensionBuildRate,
      dragLimitKg: dragContext.effectiveDragLimitKg,
      maxTackleLoadKg: dragContext.maxTackleLoadKg,
      dragLocked: dragContext.dragLocked,
      hardLineLimit: lineStateBeforePull.isFullyExtended,
      lineHasReserve: hasLineReserve(lineStateBeforePull),
      lineLengthMeters: lineStateBeforePull.totalLengthMeters,
      hasReel: lineStateBeforePull.hasReel,
      fishDistanceMeters: lineStateBeforePull.distanceMeters,
      playerPressureFatigue,
    });
    const remainingStrokeMeters = Math.max(
      0,
      (Number(rodPullResult.maxDistanceMeters) || 0) -
        (Number(rodPullResult.rodStrokeWonMeters) || 0),
    );
    const rodStrokeMovementBlocked = this.#isRodStrokeMovementBlocked(
      rodPullResult,
      remainingStrokeMeters,
    );
    const holdReelRecoverActive = !!holdReelRecover?.active;
    const fishRetrieveFrame = fishRetrieveSystem.calculate({
      dtSec,
      rodPullResult,
      forceData,
      fishCondition,
      lineDistanceMeters: lineStateBeforePull.distanceMeters,
      landingDistanceMeters: forceData.landingDistanceMeters,
      movementBlocked:
        (rodStrokeMovementBlocked && !holdReelRecoverActive),
      dragRatio: dragContext.clampedDrag,
      dragLimitKg: dragContext.effectiveDragLimitKg,
      dragLocked: dragContext.dragLocked,
      dragSupported: dragContext.dragSupported,
      lineHasReserve: hasLineReserve(lineStateBeforePull),
      lineTaut: this.#isLineTaut(lineStateBeforePull),
    });
    const rodStrokeMoveCapacityMeters =
      rodPullResult.active && !rodStrokeMovementBlocked
        ? this.#calculateAllowedPullMoveMeters({
            requestedMoveMeters: fishRetrieveFrame.desiredMoveMeters,
            remainingStrokeMeters,
            fishPosition: floatEntity.getPosition(),
            rodTipPosition,
          })
        : 0;
    const holdReelRecoverMoveMeters = this.#calculateHoldReelRecoverMoveMeters({
      dtSec,
      fishRetrieveResult: fishRetrieveFrame,
      holdReelRecover,
      holdReelRecoverActive,
    });
    const requestedRodMoveMeters = Math.min(
      fishRetrieveFrame.desiredMoveMeters,
      rodStrokeMoveCapacityMeters,
    );
    const desiredRodMoveMeters = requestedRodMoveMeters;
    const smoothedRodMoveMeters = this.#smoothPlayerPullAxis({
      axis: "y",
      desiredMoveMeters: desiredRodMoveMeters,
      dtSec,
    });
    const rodPullMovement = this.#applyRodPullMovement({
      floatEntity,
      rodTipPosition,
      deltaMeters: smoothedRodMoveMeters,
      pixelsPerMeter:
        this.#physicsConfig.getPixelsPerMeter() ||
        50,
      bounds,
      checkWater,
      limitRadiusPx: this.#resolvePoleFightSectorLimitRadiusPx({
        lineState: lineStateBeforePull,
      }),
    });
    const rodPullMoveMeters = rodPullMovement.meters;
    this.#playerPullMotionSmoother.reconcileAxis({
      axis: "y",
      appliedMove: rodPullMoveMeters,
      deltaTime: dtSec,
      blocked:
        rodPullMovement.hardBlocked ||
        rodPullMovement.directionalBlocked ||
        rodPullMoveMeters + 0.000001 < smoothedRodMoveMeters,
    });
    const reelHoldDesiredMoveMeters = Math.min(
      Math.max(0, fishRetrieveFrame.desiredMoveMeters - rodPullMoveMeters),
      holdReelRecoverMoveMeters,
    );
    const reelHoldMovement = this.#applyRodPullMovement({
      floatEntity,
      rodTipPosition,
      deltaMeters: reelHoldDesiredMoveMeters,
      pixelsPerMeter:
        this.#physicsConfig.getPixelsPerMeter() ||
        50,
      bounds,
      checkWater,
      limitRadiusPx: this.#resolvePoleFightSectorLimitRadiusPx({
        lineState: lineStateBeforePull,
      }),
    });
    const reelHoldMoveMeters = reelHoldMovement.meters;
    const totalAppliedMoveMeters = rodPullMoveMeters + reelHoldMoveMeters;
    const movementBlocked =
      fishRetrieveFrame.desiredMoveMeters > totalAppliedMoveMeters + 0.001 ||
      (
        rodStrokeMovementBlocked &&
        !holdReelRecoverActive
      );
    const hardTensionBlocked =
      !!lineStateBeforePull.isFullyExtended ||
      rodPullMovement.hardBlocked ||
      reelHoldMovement.hardBlocked;
    const fishRetrieveResult = fishRetrieveFrame
      .withAppliedMovement({
        appliedMoveMeters: totalAppliedMoveMeters,
        movementBlocked,
        hardTensionBlocked,
      });
    const lineStateAfterPull = lineSystem.updateDistance(
      floatEntity.getPosition(),
      rodTipPosition,
    );

    return {
      lineStateBeforePull,
      lineStateAfterPull,
      initialRecoverableLineMeters,
      rodPullResult,
      fishRetrieveResult,
      prePullStrokeDistanceFrame,
      rodPullMoveMeters,
      reelHoldMoveMeters,
      rodPullMovementBlockReason: rodPullMovement.blockedReason,
      reelHoldMovementBlockReason: reelHoldMovement.blockedReason,
      hardTensionBlocked,
      holdReelRecoverMoveMeters: holdReelRecoverActive
        ? reelHoldMoveMeters
        : 0,
      previousReelHoldEngaged: !!holdReelRecover?.engaged,
      previousReelHoldActive: holdReelRecoverActive,
      hardLineLimitBeforeRelease: !!lineStateAfterPull.isFullyExtended,
    };
  }

  #recordRodStrokeDistance({
    rodPullSystem,
    previousLineState,
    currentLineState,
  } = {}) {
    const frame = this.#calculateRodStrokeDistanceFrame({
      previousDistanceMeters: previousLineState?.distanceMeters,
      currentDistanceMeters: currentLineState?.distanceMeters,
      reasonPrefix: "player_frame",
    });
    rodPullSystem.recordDistanceMovement({
      gainedMeters: frame.gainedMeters,
      lostMeters: frame.lostMeters,
      previousDistanceMeters: frame.previousDistanceMeters,
      currentDistanceMeters: frame.currentDistanceMeters,
      deltaMeters: frame.deltaMeters,
      reason: frame.reason,
    });
    return frame;
  }

  #calculateRodStrokeDistanceFrame({
    previousDistanceMeters,
    currentDistanceMeters,
    reasonPrefix = "line_distance",
  } = {}) {
    if (!this.#rodStrokeDistanceTracker?.calculate) {
      return {
        previousDistanceMeters: Math.max(0, Number(previousDistanceMeters) || 0),
        currentDistanceMeters: Math.max(0, Number(currentDistanceMeters) || 0),
        deltaMeters: 0,
        gainedMeters: 0,
        lostMeters: 0,
        reason: "distance_tracker_missing",
      };
    }
    return this.#rodStrokeDistanceTracker.calculate({
      previousDistanceMeters,
      currentDistanceMeters,
      reasonPrefix,
    });
  }

  #calculateHoldReelRecoverMoveMeters({
    dtSec,
    fishRetrieveResult,
    holdReelRecover,
    holdReelRecoverActive,
  }) {
    if (!holdReelRecoverActive) return 0;
    const targetFishSpeed = Math.max(
      0,
      Number(fishRetrieveResult?.targetFishPullSpeedMetersPerSecond) || 0,
    );
    const recoverSpeed = Math.max(
      0,
      Number(holdReelRecover?.recoverSpeedMetersPerSecond) || 0,
    );
    const speed = targetFishSpeed > 0.001
      ? Math.min(targetFishSpeed, recoverSpeed)
      : recoverSpeed;
    return Math.max(0, speed * Math.max(0, Number(dtSec) || 0));
  }

  #isRodStrokeMovementBlocked(rodPullResult, remainingStrokeMeters = null) {
    if (!rodPullResult?.active) return false;
    const reason = rodPullResult.blockedReason;
    if (
      reason === "stroke_capacity_unavailable" ||
      reason === "pump_credit_too_high"
    ) {
      return true;
    }
    if (reason === "max_distance_reached") {
      if (remainingStrokeMeters !== null) {
        return Math.max(0, Number(remainingStrokeMeters) || 0) <= 0.001;
      }
      return true;
    }
    if (remainingStrokeMeters === null) return false;
    return Math.max(0, Number(remainingStrokeMeters) || 0) <= 0.001;
  }

  #updateRodControl({
    dtSec,
    input,
    floatEntity,
    rodTipPosition,
    rodControlTargetAnchor,
    actualRodTipPosition,
    lineSystem,
    rodControlSystem,
    forceData,
    dragContext,
    stressSystem,
    bounds,
    checkWater,
    maxTackleLoadKg,
    rodLimitKg,
    lineState,
    fishRetrieveResult,
    playerForceBudget,
    rodControlIntent,
    playerPressureGain,
    playerTensionBuildRate,
    playerPressureFatigue,
  }) {
    if (!rodControlSystem?.update) {
      return {
        rodControlResult: this.#emptyRodControlResult("missing_system"),
        rodControlMoveMeters: 0,
        rodControlMovePx: 0,
        rodControlMovementBlockReason: "missing_system",
        lineStateAfterControl: lineSystem.updateDistance(
          floatEntity.getPosition(),
          rodTipPosition,
        ),
      };
    }

    const config = this.#physicsConfig.getRodControlConfig() || {};
    const fishPosition = floatEntity.getPosition();
    const currentLineState = lineState || lineSystem.updateDistance(
      fishPosition,
      rodTipPosition,
    );
    const lineConstraintState = this.#resolveLineConstraintState({
      lineState: currentLineState,
      dragContext,
      fishRetrieveResult,
      payoutResult: currentLineState?.lastReleaseResult,
      config,
    });
    const lineHasReserve = lineConstraintState.lineHasReserve;
    const hardLineLimit = lineConstraintState.hardLineLimit;
    const currentFrameTensionKg = Number(
      fishRetrieveResult?.totalTensionKg,
    );
    const currentTensionKg = Math.max(
      0,
      Number.isFinite(currentFrameTensionKg)
        ? currentFrameTensionKg
        : Number(stressSystem.getTensionKg()) ||
          Number(forceData?.fishTensionKg) ||
          0,
    );
    const rodControlResult = rodControlSystem.update({
      dtSec,
      inputState: input,
      fishPosition,
      rodTipPosition,
      baseRodTipPosition: rodControlTargetAnchor || rodTipPosition,
      actualRodTipPosition,
      rodLimitKg,
      maxTackleLoadKg,
      currentTensionKg,
      fishTensionKg: forceData?.fishTensionKg,
      fishVelocity: forceData?.targetVelocity,
      playerForceBudget,
      dragLimitKg: dragContext?.effectiveDragLimitKg,
      dragLocked: dragContext?.dragLocked !== false,
      lineHasReserve,
      hardLineLimit,
      lineConstraintState,
      intentFrame: rodControlIntent,
      playerPressureGain,
      playerTensionBuildRate,
      playerPressureFatigue,
      config,
    });
    const desiredSignedMoveMeters =
      (Number(rodControlResult.directionX) || 0) *
      Math.max(0, Number(rodControlResult.desiredMoveMeters) || 0);
    let rawSmoothedSignedMoveMeters = 0;
    if (rodControlResult.canApply) {
      rawSmoothedSignedMoveMeters = this.#smoothPlayerPullAxis({
        axis: "x",
        desiredMoveMeters: desiredSignedMoveMeters,
        dtSec,
      });
    } else {
      this.#playerPullMotionSmoother.resetAxis("x");
    }
    const smoothedSignedMoveMeters = this.#limitRodControlMoveTowardTarget({
      signedMoveMeters: rawSmoothedSignedMoveMeters,
      fishPosition,
      rodControlResult,
      pixelsPerMeter:
        this.#physicsConfig.getPixelsPerMeter() ||
        50,
    });
    if (
      Math.abs(rawSmoothedSignedMoveMeters) > 0.000001 &&
      Math.abs(smoothedSignedMoveMeters) <= 0.000001
    ) {
      this.#playerPullMotionSmoother.resetAxis("x");
    }
    const allowedMoveMeters = Math.abs(smoothedSignedMoveMeters);
    const movement = this.#applyRodControlMovement({
      floatEntity,
      rodTipPosition,
      directionX: Math.sign(smoothedSignedMoveMeters),
      deltaMeters: Math.abs(smoothedSignedMoveMeters),
      pixelsPerMeter:
        this.#physicsConfig.getPixelsPerMeter() ||
        50,
      bounds,
      checkWater,
      lineConstraintState,
      limitRadiusPx: this.#resolvePoleFightSectorLimitRadiusPx({
        lineConstraintState,
      }),
      projectLockedMovementToArc:
        config.lineConstraint?.projectLockedMovementToArc !== false,
    });
    const requestedAppliedMeters = Math.abs(smoothedSignedMoveMeters);
    const controlMovementBlocked =
      movement.hardBlocked ||
      movement.directionalBlocked ||
      movement.meters + 0.000001 < requestedAppliedMeters;
    this.#playerPullMotionSmoother.reconcileAxis({
      axis: "x",
      appliedMove: movement.signedMeters,
      deltaTime: dtSec,
      blocked: controlMovementBlocked,
    });
    rodControlSystem.recordAppliedMovement({
      movedMeters: movement.meters,
      movedPx: movement.px,
    });
    const updatedResult = rodControlSystem.getState() || rodControlResult;
    Object.assign(updatedResult, {
      phase: updatedResult.canApply
        ? "applying_force"
        : updatedResult.active
          ? "blocked"
          : "inactive",
      allowedMoveMeters,
      movementMode: movement.mode,
      lineLengthLocked: lineConstraintState.lineLengthLocked,
      radialConstraintActive: lineConstraintState.radialConstraintActive,
    });
    const lineStateAfterControl = lineSystem.updateDistance(
      floatEntity.getPosition(),
      rodTipPosition,
    );
    return {
      rodControlResult: updatedResult,
      rodControlMoveMeters: movement.meters,
      rodControlMovePx: movement.px,
      rodControlMovementBlockReason: movement.blockedReason,
      lineConstraintState,
      lineStateAfterControl,
    };
  }

  #emptyRodControlResult(blockedReason = "no_input") {
    return {
      active: false,
      canApply: false,
      directionX: 0,
      inputDirectionX: 0,
      inputRatio: 0,
      requestedForceRatio: 0,
      rawForceKg: 0,
      forceKg: 0,
      loadReserveKg: 0,
      loadReserveRatio: 0,
      tensionCeilingMultiplier: 1,
      tensionCeilingKg: 0,
      forceLimitKg: 0,
      effectiveForceLimitKg: 0,
      currentTensionKg: 0,
      dragLimited: false,
      dragReserveKg: 0,
      canSlipDrag: false,
      deliveredForceRatio: 0,
      playerPressureEfficiency: 1,
      playerPressureFatigueEnabled: false,
      playerTensionKg: 0,
      tensionMultiplier: 0,
      desiredMoveMeters: 0,
      desiredMovePx: 0,
      appliedMoveMeters: 0,
      appliedMovePx: 0,
      actualMovementRatio: 0,
      maxPullSpeedMetersPerSecond: 0,
      visualControlRatio: 0,
      targetRodX: null,
      targetRodY: null,
      targetMode: "input_direction",
      fishOffsetX: 0,
      lineAngleDeg: 0,
      maxEffectiveAngleDeg: 0,
      angleRatio: 0,
      directionFactor: 0,
      aligned: false,
      blockedReason,
      phase: "inactive",
      allowedMoveMeters: 0,
    };
  }

  resetPlayerPullMotion() {
    this.#playerPullMotionSmoother.reset();
    this.#poleFightSectorConstraint.reset();
    this.#poleFightSectorAngleConstraint.reset();
    this.#staminaBudgetOverflowWarningActive = false;
    this.#playerPressureFatigueState.reset();
    this.#playerReelFatigueSession.reset();
    this.#recoveryFishSlowdownPolicy.reset(
      this.#lineRecoveryFishSlowdownState,
    );
  }

  #updateTension({
    tensionSystem,
    stressSystem,
    forceData,
    rodPullResult,
    fishRetrieveResult,
    rodControlResult,
    dragContext,
    lineState,
    hardLineLimit,
    dtSec,
    pullInput,
  }) {
    const landingLift = this.#updateLandingLift({
      dtSec,
      pullInput,
      forceData,
      rodPullResult,
      fishRetrieveResult,
      lineState,
      maxTackleLoadKg: stressSystem.getEffectiveMaxTackleLoadKg(),
    });
    const calculatedTension = this.#calculateTension({
      tensionSystem,
      stressSystem,
      forceData,
      rodPullResult,
      fishRetrieveResult,
      rodControlResult,
      landingLift,
      dragContext,
      lineState,
      hardLineLimit,
    });
    const tensionResult = {
      ...calculatedTension,
      landingLift,
    };

    if (typeof stressSystem.updateTensionFrame === "function") {
      const lineHasReserve = hasLineReserve(lineState);
      const canSlipDrag =
        !dragContext.dragLocked &&
        lineHasReserve &&
        !hardLineLimit;
      const tensionStressSource =
        canSlipDrag && tensionResult.shouldSlipDrag
          ? "visible"
          : "raw";
      stressSystem.updateTensionFrame({
        visibleTensionKg: tensionResult.tensionKg,
        totalTensionKg: tensionResult.totalTensionKg,
        rawTotalTensionKg: tensionResult.rawTotalTensionKg,
        rawTensionKg: tensionResult.rawTensionKg,
        fishTensionKg: tensionResult.fishTensionKg,
        tensionStressSource,
        dtSec,
        tensionConfig:
          this.#physicsConfig.getTensionConfig() ||
          this.#config.tension ||
          {},
      });
    } else {
      stressSystem.updateTarget(
        tensionResult.tensionKg,
        dtSec,
        this.#config.tension || {},
      );
    }
    return tensionResult;
  }

  #calculateTension({
    tensionSystem,
    stressSystem,
    forceData,
    rodPullResult,
    fishRetrieveResult,
    rodControlResult,
    landingLift,
    dragContext,
    lineState,
    hardLineLimit,
  }) {
    const lineHasReserve = hasLineReserve(lineState);
    const baseFishTensionKg =
      fishRetrieveResult.fishTensionKg ?? forceData.fishTensionKg;
    const basePlayerHoldTensionKg = fishRetrieveResult.playerHoldTensionKg ?? 0;
    const lateralTensionKg = Math.max(
      0,
      Number(rodControlResult?.playerTensionKg) || 0,
    );
    const baseTotalTensionKg =
      fishRetrieveResult.totalTensionKg ?? fishRetrieveResult.lineTensionKg;
    const landingLiftActive = !!landingLift?.active;
    const fishTensionKg = landingLiftActive
      ? landingLift.fishTensionKg
      : baseFishTensionKg;
    const playerHoldTensionKg = landingLiftActive
      ? 0
      : basePlayerHoldTensionKg + lateralTensionKg;
    const totalTensionKg = landingLiftActive
      ? landingLift.totalTensionKg
      : Math.max(0, Number(baseTotalTensionKg) || 0) + lateralTensionKg;
    return tensionSystem.calculate({
      totalTensionKg,
      fishForceKg: fishTensionKg,
      rodPullForceKg: playerHoldTensionKg,
      fishTensionKg,
      playerHoldTensionKg,
      rodLimitKg: stressSystem.getEffectiveRodMaxLoadKg(),
      lineLimitKg: stressSystem.getEffectiveLineSystemMaxLoadKg(),
      hookLimitKg: stressSystem.getEffectiveHookMaxLoadKg(),
      dragLimitKg: dragContext.effectiveDragLimitKg,
      hardLineLimit: !!hardLineLimit,
      lineHasReserve,
      dragLocked: dragContext.dragLocked,
      dragAlreadyResolved:
        Number.isFinite(Number(fishRetrieveResult?.dragBlockedForceKg)),
      shouldSlipDrag: !!fishRetrieveResult?.shouldSlipDrag,
      landingLift,
    });
  }

  #updateLandingLift({
    dtSec,
    pullInput,
    forceData,
    rodPullResult,
    fishRetrieveResult,
    lineState,
    maxTackleLoadKg,
  }) {
    const landingDistanceMeters = Number(forceData?.landingDistanceMeters) || 0;
    const rawShoreDistanceMeters = Number(forceData?.shoreLandingDistanceMeters);
    const shoreLandingDistanceMeters = Number.isFinite(rawShoreDistanceMeters)
      ? Math.max(0, rawShoreDistanceMeters)
      : Infinity;
    const inLandingZone =
      landingDistanceMeters > 0 &&
      shoreLandingDistanceMeters <= landingDistanceMeters + 0.001;
    const playerHoldActive = !!pullInput?.pullHeld;
    const lift = this.#landingLiftCalculator.calculate({
      previousLiftHoldKg: this.#landingLiftHoldKg,
      fishWeightKg: this.#resolveFishWeightKg(forceData),
      maxTackleLoadKg,
      waterFightTensionKg:
        fishRetrieveResult?.fishTensionKg ?? forceData?.fishTensionKg,
      inLandingZone,
      playerHoldActive,
      dtSec,
      config: this.#physicsConfig.getLandingLiftConfig(),
    });

    this.#landingLiftHoldKg = lift.liftHoldKg;
    return lift;
  }

  #buildLandingFrame({ forceData, lineState, tensionResult } = {}) {
    const lift = tensionResult?.landingLift || {};
    const rawLineDistanceMeters = Number(lineState?.distanceMeters);
    const lineDistanceMeters = Number.isFinite(rawLineDistanceMeters)
      ? Math.max(0, rawLineDistanceMeters)
      : Infinity;
    const rawShoreDistanceMeters = Number(forceData?.shoreLandingDistanceMeters);
    const shoreLandingDistanceMeters = Number.isFinite(rawShoreDistanceMeters)
      ? Math.max(0, rawShoreDistanceMeters)
      : Infinity;
    const landingDistanceMeters = Math.max(
      0,
      Number(forceData?.landingDistanceMeters) || 0,
    );
    const tensionFrame = Object.freeze({
      visibleTensionKg: Math.max(0, Number(tensionResult?.tensionKg) || 0),
      supportedTensionKg: Math.max(
        0,
        Number(tensionResult?.totalTensionKg) || 0,
      ),
      totalTensionKg: Math.max(0, Number(tensionResult?.totalTensionKg) || 0),
      rawTensionKg: Math.max(0, Number(tensionResult?.rawTensionKg) || 0),
      rawTotalTensionKg: Math.max(
        0,
        Number(tensionResult?.rawTotalTensionKg) || 0,
      ),
      shouldSlipDrag: !!tensionResult?.shouldSlipDrag,
      dragSlipping: !!tensionResult?.shouldSlipDrag,
    });
    const readiness = this.#resolveLandingReadiness({
      landingLiftFrame: lift,
      tensionFrame,
    });

    return Object.freeze({
      inLandingZone: !!lift?.inLandingZone,
      landingDistanceMeters,
      lineDistanceMeters,
      shoreLandingDistanceMeters,
      lift,
      tension: tensionFrame,
      readiness,
    });
  }

  #buildStaminaFrame({
    forceData,
    rodPullResult,
    rodControlResult,
    fishRetrieveResult,
    lineState,
    stressSystem,
    fishCondition,
    floatEntity,
    rodTipPosition,
    physics,
    fightInput,
    dtSec,
    isPullMode,
    isRecoverMode,
    holdReelRecover,
    playerPressureFatigue,
  } = {}) {
    const playerIsPulling = !!isPullMode && !isRecoverMode;
    const appliedRodHoldKg = Math.max(
      0,
      Number(
        fishRetrieveResult?.effectiveRodHoldKg ??
          rodPullResult?.effectiveForceKg ??
          rodPullResult?.forceKg,
      ) || 0,
    );
    const appliedControlKg = Math.max(
      0,
      Number(rodControlResult?.forceKg) || 0,
    );
    const appliedReelHoldKg = holdReelRecover?.active === true
      ? Math.max(
          0,
          (Number(holdReelRecover?.reelMaxLoadKg) || 0) *
            (Number(holdReelRecover?.reelLoadReserveRatio) || 0),
        )
      : 0;
    const playerPressureControlExhausted =
      playerPressureFatigue?.isControlExhausted === true;
    const weakestFrame =
      stressSystem.getWeakestTackleLimitFrame() ||
      Object.freeze({
        weakestTackleLimitKg:
          Math.max(0, Number(stressSystem.getEffectiveMaxTackleLoadKg()) || 0),
        component: "stress_system",
        candidates: Object.freeze([]),
      });
    const frame = this.#staminaBalanceFrame.create({
      phase: fishCondition?.phase || "stamina",
      playerIsPulling,
      fishTensionKg:
        fishRetrieveResult?.fishTensionKg ?? forceData?.fishTensionKg,
      appliedRodHoldKg,
      appliedReelHoldKg,
      appliedControlKg,
      playerPressureControlExhausted,
      playerFatigueProgress: playerPressureFatigue?.fatigueProgress ?? 0,
      weakestTackleLimitKg: weakestFrame.weakestTackleLimitKg,
      currentStamina: fishCondition?.currentStamina,
      maxStamina: fishCondition?.maxStamina ?? fishCondition?.maxPoints,
      lineAngleDeg: this.#resolveLineAngleDeg({
        floatEntity,
        rodTipPosition,
        rodControlResult,
      }),
      fishLateralContext: this.#resolveStaminaLateralContext({
        rodControlResult,
      }),
      controlDirectionX: rodControlResult?.inputDirectionX ?? 0,
      rawStaminaInputActive: this.#resolveRawStaminaInputActive({
        fightInput,
      }),
      fishStaminaResistanceKg: this.#resolveFishStaminaResistanceKg({
        forceData,
        fishRetrieveResult,
      }),
      isLineFullyExtended: !!lineState?.isFullyExtended,
      fishWonRadialForceKg:
        fishRetrieveResult?.fishWonRadialForceKg ??
        forceData?.fishWonRadialForceKg,
      dragBlockedForceKg:
        fishRetrieveResult?.dragBlockedForceKg ??
        forceData?.dragBlockedForceKg,
      lineTaut:
        fishRetrieveResult?.lineTaut ??
        forceData?.lineTaut ??
        this.#isLineTaut(lineState),
      lineTautRatio: this.#resolveLineTautRatio({
        fishRetrieveResult,
        forceData,
        lineState,
      }),
      fishBehaviorName: this.#resolveFishBehaviorName(forceData),
      shouldSlipDrag:
        fishRetrieveResult?.shouldSlipDrag ?? forceData?.shouldSlipDrag,
      hardLineLimit:
        !!lineState?.isFullyExtended ||
        !!fishRetrieveResult?.tensionBlocked,
      currentExhaustion: fishCondition?.currentExhaustion,
      maxEndurance:
        fishCondition?.maxEndurance ?? fishCondition?.maxPoints,
      dtSec,
      config:
        this.#config?.stamina?.mechanics ||
        physics?.stamina?.mechanics ||
        {},
    });

    if (frame) {
      this.#warnStaminaBudgetOverflow(frame);
      return Object.freeze({
        ...frame,
        angleStressRatio: frame.angleStressRatio,
        staminaPressureRatio: frame.activeDrainRatio,
        weakestTackleLimitComponent: weakestFrame.component,
        weakestTackleLimitCandidates: weakestFrame.candidates,
      });
    }

    return Object.freeze({
      playerPowerIsPulling: playerIsPulling,
      angleStressRatio: Math.max(
        0,
        Math.min(1, Number(forceData?.player?.angleStressRatio) || 0),
      ),
      staminaPressureRatio: 0,
      framePhase: fishCondition?.phase || "stamina",
      frameCurrentExhaustion: Math.max(
        0,
        Number(fishCondition?.currentExhaustion) || 0,
      ),
      frameMaxEndurance: Math.max(
        0,
        Number(fishCondition?.maxEndurance ?? fishCondition?.maxPoints) || 0,
      ),
      frameEnduranceProgress:
        this.#resolveFrameEnduranceProgress(fishCondition),
      isLineFullyExtended: !!lineState?.isFullyExtended,
      source: "legacy_fallback",
    });
  }

  #resolveFrameEnduranceProgress(fishCondition) {
    const maxEndurance = Math.max(
      0,
      Number(fishCondition?.maxEndurance ?? fishCondition?.maxPoints) || 0,
    );
    if (maxEndurance <= 0) return 0;
    return Math.max(
      0,
      Math.min(
        1,
        1 - (Number(fishCondition?.currentExhaustion) || 0) / maxEndurance,
      ),
    );
  }

  #resolveLineTautRatio({ fishRetrieveResult, forceData, lineState } = {}) {
    const explicit = Number(
      fishRetrieveResult?.lineTautRatio ?? forceData?.lineTautRatio,
    );
    if (Number.isFinite(explicit)) {
      return Math.max(0, Math.min(1, explicit));
    }
    const lineTaut =
      fishRetrieveResult?.lineTaut ??
      forceData?.lineTaut ??
      this.#isLineTaut(lineState);
    return lineTaut ? 1 : 0;
  }

  #resolveFishBehaviorName(forceData) {
    const value =
      forceData?.behavior?.name ??
      forceData?.diagnostics?.fishState ??
      forceData?.fishState ??
      forceData?.fishBehaviorName ??
      "unknown";
    const normalized = String(value || "unknown").trim().toLowerCase();
    return normalized || "unknown";
  }

  #resolveLineAngleDeg({ floatEntity, rodTipPosition, rodControlResult } = {}) {
    const fishPosition = floatEntity.getPosition();
    if (this.#hasPoint(fishPosition) && this.#hasPoint(rodTipPosition)) {
      const absOffsetX = Math.abs(fishPosition.x - rodTipPosition.x);
      const dy = Math.abs(rodTipPosition.y - fishPosition.y);
      return Math.atan2(absOffsetX, Math.max(1, dy)) * 180 / Math.PI;
    }
    const existing = Number(rodControlResult?.lineAngleDeg);
    return Number.isFinite(existing) && existing >= 0 ? existing : 0;
  }

  #resolveStaminaLateralContext({ rodControlResult } = {}) {
    const fishOffsetX = Number(rodControlResult?.fishOffsetX) || 0;
    const angleRatio = Math.max(
      0,
      Math.min(1, Number(rodControlResult?.angleRatio) || 0),
    );
    const absOffset = Math.abs(fishOffsetX);
    const maxAllowedLateralOffsetPx =
      angleRatio > 0.000001 ? absOffset / angleRatio : 0;
    return Object.freeze({
      fishLateralOffsetPx: fishOffsetX,
      maxAllowedLateralOffsetPx,
      angleRatio,
    });
  }

  #resolveRawStaminaInputActive({ fightInput } = {}) {
    const actions = fightInput?.fightActions;
    if (actions?.hold?.active === true) return true;
    if (actions?.lateralControl?.active === true) return true;
    return (
      fightInput?.isPulling === true ||
      fightInput?.pullHeld === true ||
      fightInput?.rodControlActive === true
    );
  }

  #resolveFishStaminaResistanceKg({ forceData, fishRetrieveResult } = {}) {
    const candidates = [
      forceData?.fishCurrentStateMaxForceKg,
      forceData?.diagnostics?.fishCurrentStateMaxForceKg,
      forceData?.fishStateMaxForceWithoutPowerDebuffKg,
      fishRetrieveResult?.fishOppositionKg,
      forceData?.fishOppositionKg,
      forceData?.totalFishForceKg,
      forceData?.fishWeightKg,
    ];
    for (const candidate of candidates) {
      const value = Number(candidate);
      if (Number.isFinite(value) && value > 0) return value;
    }
    return 0;
  }

  #warnStaminaBudgetOverflow(frame) {
    if (!frame?.budgetOverflowWarning) {
      this.#staminaBudgetOverflowWarningActive = false;
      return;
    }
    if (this.#staminaBudgetOverflowWarningActive) return;
    this.#staminaBudgetOverflowWarningActive = true;
    this.#logger?.warn(
      "[STAMINA] Stamina received applied player pressure above available tackle budget. This means physics budget and stamina frame are out of sync.",
      frame,
    );
  }

  #resolveLandingReadiness({ landingLiftFrame, tensionFrame }) {
    const config = this.#physicsConfig.getLandingLiftConfig() || {};
    if (this.#landingLiftReadinessPolicy?.evaluate) {
      return this.#landingLiftReadinessPolicy.evaluate({
        landingLiftFrame,
        tensionFrame,
        config,
      });
    }

    const liftMaxKg = Math.max(0, Number(landingLiftFrame?.liftMaxKg) || 0);
    const liftHoldKg = Math.max(0, Number(landingLiftFrame?.liftHoldKg) || 0);
    const supportedTensionKg = Math.max(
      0,
      Number(tensionFrame?.supportedTensionKg) || 0,
    );
    return Object.freeze({
      ready:
        config.enabled === false ||
        (
          !!landingLiftFrame?.inLandingZone &&
          !!landingLiftFrame?.playerHoldActive &&
          !!landingLiftFrame?.active &&
          liftMaxKg > 0 &&
          liftHoldKg >= liftMaxKg - 0.001 &&
          supportedTensionKg >= liftMaxKg - 0.001
        ),
      reason: "fallback",
      liftRequiredKg: liftMaxKg,
      liftHoldKg,
      supportedTensionKg,
      rawTensionKg: Math.max(0, Number(tensionFrame?.rawTensionKg) || 0),
      visibleTensionKg: Math.max(
        0,
        Number(tensionFrame?.visibleTensionKg) || 0,
      ),
      dragSlipping: !!tensionFrame?.shouldSlipDrag,
    });
  }

  #resolveFishWeightKg(forceData) {
    return Math.max(
      0,
      Number(forceData?.fishWeightKg) || 0,
    );
  }

  #recoverLineCredit({
    dtSec,
    reelSystem,
    lineSystem,
    reel,
    tensionKg,
    isRecoverMode,
    loadLimitKg = null,
    maxRecoverMeters = null,
  }) {
    return reelSystem.recoverLineCredit({
      dtSec,
      lineSystem,
      reel,
      tensionKg,
      inputRecover: isRecoverMode,
      loadLimitKg,
      maxRecoverMeters,
    });
  }

  #recoverRodStrokeCredit({
    dtSec,
    reelSystem,
    lineSystem,
    reel,
    tensionKg,
    blockedReason,
    playerHoldActive,
    strokeWonMeters,
    fishDistanceMeters,
  }) {
    if (!reelSystem?.recoverRodStrokeCredit) {
      return {
        active: false,
        blockedReason: "missing_reel_recovery",
        reelLoadRatio: 1,
        reelEfficiency: 0,
        recoverSpeedMetersPerSec: 0,
        desiredRecoverMeters: 0,
        maxRecoverByLineMeters: 0,
        recoveredMeters: 0,
      };
    }

    return reelSystem.recoverRodStrokeCredit({
      dtSec,
      lineSystem,
      reel,
      tensionKg,
      blockedReason,
      playerHoldActive,
      strokeWonMeters,
      fishDistanceMeters,
    });
  }

  #resolveReelRecoveryLoad({ tensionResult, dragContext }) {
    const rawLoadKg = Math.max(0, Number(tensionResult?.rawTensionKg) || 0);
    const dragLimitKg = Math.max(0, Number(dragContext?.effectiveDragLimitKg) || 0);
    if (!dragContext?.dragLocked && rawLoadKg > dragLimitKg + 0.001) {
      return {
        tensionKg: rawLoadKg,
        blockedReason: "raw_load_above_drag_limit",
      };
    }
    return {
      tensionKg: rawLoadKg,
      blockedReason: null,
    };
  }

  #updateHoldReelRecovery({
    dtMs,
    isPullMode,
    hasReel,
    reel,
    rodPullResult,
    tensionPreview,
    dragContext,
    physics,
    lineState,
  }) {
    const reelHoldConfig =
      this.#physicsConfig.getReelHoldConfig() ||
      this.#physicsConfig.getReelConfig() ||
      {};
    const lineRecoverableMeters = Math.max(
      0,
      Number(lineState?.recoverableLineMeters) ||
        (
          (Number(lineState?.releasedMeters) || 0) -
          (Number(lineState?.distanceMeters) || 0)
        ),
    );

    const rodStrokeRatio = Math.max(
      0,
      Math.min(1, Number(rodPullResult?.rodStrokeRatio) || 0),
    );
    this.#holdReelRecoverState = this.#reelHoldRecoverySystem.update({
      dtMs,
      config: reelHoldConfig,
      hasReel,
      playerHoldActive: isPullMode,
      rodPullActive: rodPullResult?.active,
      strokeRatio: rodStrokeRatio,
      rawTensionKg: tensionPreview?.rawTensionKg,
      dragLimitKg: dragContext?.effectiveDragLimitKg,
      dragLocked: dragContext?.dragLocked,
      shouldSlipDrag: tensionPreview?.shouldSlipDrag,
      reelMaxLoadKg:
        reel.getEffectiveMaxLoadKg() ??
        reel.getMaxLoadKg() ??
        0,
      retrieveSpeedMetersPerSecond: reel.getRetrieveSpeedMetersPerSec() ?? 0,
      lineRecoverableMeters,
      physics,
    });
    this.#holdReelRecoverState.source = "reel_hold_recovery";
    return this.#holdReelRecoverState;
  }

  #resolveLineLimit({
    floatEntity,
    rodTipPosition,
    lineSystem,
    dragSystem,
    dragContext,
    tensionResult,
    physics,
    velocity,
    hardLineLimitBeforeRelease,
  }) {
    lineSystem.updateDistance(floatEntity.getPosition(), rodTipPosition);
    const releaseResult = lineSystem.releaseForDistance({
      dragRatio: dragSystem.value,
      shouldSlip: tensionResult.shouldSlipDrag,
      slipReleaseRatio: tensionResult.shouldSlipDrag ? 1 : 0,
      creepReleaseRatio:
        this.#physicsConfig?.getReelDragConfig?.()?.creepReleaseRatio ??
        0,
    });
    const constraintResult = lineSystem.constrainPosition(
      floatEntity.getPosition(),
      floatEntity.getVelocity() || velocity,
      rodTipPosition,
    );
    const lineStateBeforeRecover = lineSystem.updateDistance(
      floatEntity.getPosition(),
      rodTipPosition,
    );
    const hardLineLimit =
      hardLineLimitBeforeRelease ||
      !!releaseResult.hardLimitReached ||
      !!constraintResult.hardLimit ||
      !!lineStateBeforeRecover.isFullyExtended;
    const lineState = lineSystem.updateDistance(floatEntity.getPosition(), rodTipPosition);
    const lineConstraintState = this.#resolveLineConstraintState({
      lineState,
      dragContext,
      fishRetrieveResult: tensionResult,
      payoutResult: releaseResult,
    });
    const finalRecoverableLineMeters = this.#recoverableLineCalculator.calculateRecoverableLineMeters({
      releasedMeters: lineState.releasedMeters,
      fishDistanceMeters: lineState.distanceMeters,
    });
    const actualSlackMeters = this.#looseLineCalculator.calculateActualSlackMeters({
      releasedMeters: lineState.releasedMeters,
      fishDistanceMeters: lineState.distanceMeters,
      fishMovingTowardPlayer: false,
      playerPulling: false,
      reelRecovering: false,
    });

    return {
      releaseResult,
      constraintResult,
      lineState,
      lineConstraintState,
      hardLineLimit,
      finalRecoverableLineMeters,
      actualSlackMeters,
    };
  }

  #inspectPoleFightSector({
    floatEntity,
    rodTipPosition,
    lineSystem,
  }) {
    const fallback = {
      enabled: false,
      active: false,
      clamped: false,
      side: "none",
      angleDeg: 0,
      clampedAngleDeg: 0,
      maxAngleFromCenterDeg: 60,
      radiusPx: 0,
      originX: Number(rodTipPosition?.x) || 0,
      originY: Number(rodTipPosition?.y) || 0,
      radialOriginX: Number(rodTipPosition?.x) || 0,
      radialOriginY: Number(rodTipPosition?.y) || 0,
      sectorApexX: Number(rodTipPosition?.x) || 0,
      sectorApexY: Number(rodTipPosition?.y) || 0,
      apexOffsetPx: 0,
      shoreOpeningWidthMeters: 0,
      positionX: Number(floatEntity?.getPosition?.()?.x) || 0,
      positionY: Number(floatEntity?.getPosition?.()?.y) || 0,
      lineState: null,
    };
    if (!this.#poleFightSectorConstraint?.inspect) return fallback;

    const lineState = lineSystem.updateDistance(
      floatEntity.getPosition(),
      rodTipPosition,
    );
    const frame = this.#poleFightSectorConstraint.inspect({
      position: floatEntity.getPosition(),
      origin: rodTipPosition,
      limitRadiusPx: this.#resolvePoleFightSectorLimitRadiusPx({ lineState }),
      pixelsPerMeter:
        this.#physicsConfig.getPixelsPerMeter() || 50,
      config:
        this.#physicsConfig.getPoleFightSectorConfig() ||
        this.#getRuntimePhysicsConfig()?.fight?.poleFightSector ||
        {},
    });
    return {
      ...frame,
      lineState,
    };
  }

  #applyPoleFightSectorMovement({
    fromPosition,
    proposedPosition,
    velocity,
    origin,
    limitRadiusPx = 0,
    adjustVelocity = false,
    enforceRadius = true,
  }) {
    if (!this.#poleFightSectorConstraint?.resolveMovement) {
      return {
        active: false,
        clamped: false,
        positionX: Number(proposedPosition?.x) || 0,
        positionY: Number(proposedPosition?.y) || 0,
      };
    }

    const frame = this.#poleFightSectorConstraint.resolveMovement({
      fromPosition,
      proposedPosition,
      velocity: adjustVelocity ? velocity : null,
      origin,
      limitRadiusPx,
      pixelsPerMeter:
        this.#physicsConfig.getPixelsPerMeter() || 50,
      config:
        this.#physicsConfig.getPoleFightSectorConfig() ||
        this.#getRuntimePhysicsConfig()?.fight?.poleFightSector ||
        {},
      enforceRadius,
    });
    if (!frame.active) return frame;

    proposedPosition.x = frame.positionX;
    proposedPosition.y = frame.positionY;
    if (adjustVelocity && frame.velocityAdjusted && velocity) {
      velocity.x = frame.velocityX;
      velocity.y = frame.velocityY;
    }
    return frame;
  }

  #applyPoleFightSectorAngleMovement({
    fromPosition,
    proposedPosition,
    velocity,
    origin,
    limitRadiusPx = 0,
    adjustVelocity = false,
  }) {
    if (!this.#poleFightSectorAngleConstraint?.resolveMovement) {
      return {
        active: false,
        clamped: false,
        positionX: Number(proposedPosition?.x) || 0,
        positionY: Number(proposedPosition?.y) || 0,
        enforceRadius: false,
      };
    }

    const frame = this.#poleFightSectorAngleConstraint.resolveMovement({
      fromPosition,
      proposedPosition,
      velocity: adjustVelocity ? velocity : null,
      origin,
      limitRadiusPx,
      pixelsPerMeter:
        this.#physicsConfig.getPixelsPerMeter() || 50,
      config:
        this.#physicsConfig.getPoleFightSectorConfig() ||
        this.#getRuntimePhysicsConfig()?.fight?.poleFightSector ||
        {},
    });
    if (!frame.active) return frame;

    proposedPosition.x = frame.positionX;
    proposedPosition.y = frame.positionY;
    if (adjustVelocity && frame.velocityAdjusted && velocity) {
      velocity.x = frame.velocityX;
      velocity.y = frame.velocityY;
    }
    return frame;
  }

  // Production read model of the fight frame: every value that gameplay, HUD and render read, written in place
  // each step. The DEV snapshot reads these same values instead of recomputing them.
  #writeFightFrame({
    forceData,
    lineState,
    releaseResult,
    hardLineLimit,
    rodPullDisplay,
    rodPullResult,
    rodControlResult,
    rodControlMovementBlockReason,
    fishRetrieveResult,
    landingLiftResult,
    tensionResult,
    stressSystem,
    dragContext,
    playerPressureFatigue,
    poleFightSectorFrame,
  }) {
    const frame = this.#fightFrame;
    // Fish force values the snapshot takes from its first spread source.
    frame.fishWeightKg = forceData.diagnostics?.fishWeightKg;
    frame.lastDash = forceData.diagnostics?.lastDash;
    frame.activeRodPullForceKg = rodPullResult.forceKg;
    frame.dragLimitKg = dragContext.effectiveDragLimitKg;
    frame.dragLocked = dragContext.dragLocked;
    frame.dragSupported = !!dragContext.dragSupported;
    frame.effectiveRodHoldKg = fishRetrieveResult?.effectiveRodHoldKg ?? rodPullResult.effectiveForceKg;
    frame.fishTensionKg = tensionResult.fishTensionKg;
    frame.hardLineLimit = hardLineLimit;
    frame.holdTensionRatio = rodPullResult.holdTensionRatio;
    frame.landingLiftActive = !!landingLiftResult?.active;
    frame.landingLiftFishTensionKg = landingLiftResult?.fishTensionKg ?? 0;
    frame.landingLiftGainKgPerSecond = landingLiftResult?.gainKgPerSecond ?? 0;
    frame.landingLiftHoldKg = landingLiftResult?.liftHoldKg ?? 0;
    frame.landingLiftInZone = !!landingLiftResult?.inLandingZone;
    frame.landingLiftMaxKg = landingLiftResult?.liftMaxKg ?? 0;
    frame.landingLiftProgressRatio = landingLiftResult?.progressRatio ?? 0;
    frame.landingLiftSlowdownRatio = landingLiftResult?.slowdownRatio ?? 0;
    frame.landingLiftSpeedRatio = landingLiftResult?.speedRatio ?? 0;
    frame.landingLiftTackleLoadProgressRatio = landingLiftResult?.tackleLoadProgressRatio ?? 0;
    frame.landingLiftWaterTensionKg = landingLiftResult?.waterFightTensionKg ?? 0;
    frame.lineCanRelease = hasLineReserve(lineState);
    frame.lineDistanceMeters = lineState.distanceMeters;
    frame.lineReleasedThisFrameMeters = releaseResult.releasedMeters;
    frame.lineRemainingMeters = lineState.remainingMeters;
    frame.playerHoldTensionKg = tensionResult.playerHoldTensionKg;
    frame.playerPressureFatigueEfficiency = playerPressureFatigue?.appliedEfficiency ??
      playerPressureFatigue?.efficiency ??
      1;
    frame.playerPressureFatigueEnabled = playerPressureFatigue?.enabled === true;
    frame.playerPressureFatigueGraceDurationMs = playerPressureFatigue?.graceDurationMs ?? 0;
    frame.playerPressureFatigueGraceElapsedMs = playerPressureFatigue?.graceElapsedMs ?? 0;
    frame.playerPressureFatigueProgress = playerPressureFatigue?.fatigueProgress ?? 0;
    frame.playerPressureFatigueRecoveryProgress = playerPressureFatigue?.recoveryProgress ?? 0;
    frame.playerPressureFatigueSourceActive = playerPressureFatigue?.sourceActive === true;
    frame.playerPressureFatigueSourceMode = playerPressureFatigue?.sourceMode || "reel_hold_session";
    frame.playerPressureFatigueState = playerPressureFatigue?.stateName || "idle";
    frame.poleFightSectorActive = poleFightSectorFrame?.active === true;
    frame.poleFightSectorLimitRadiusPx = Math.max(0, Number(poleFightSectorFrame?.limitRadiusPx) || 0);
    frame.rawTensionKg = tensionResult.rawTensionKg;
    frame.reelSlip = releaseResult.didSlip;
    frame.rodControlActive = !!rodControlResult?.active;
    frame.rodControlBlockedReason = rodControlResult?.blockedReason || "none";
    frame.rodControlDirectionFactor = rodControlResult?.directionFactor ?? 0;
    frame.rodControlDirectionX = rodControlResult?.directionX ?? 0;
    frame.rodControlInputDirectionX = rodControlResult?.inputDirectionX ?? 0;
    frame.rodControlInputRatio = rodControlResult?.inputRatio ?? 0;
    frame.rodControlLoadReserveRatio = rodControlResult?.loadReserveRatio ?? 0;
    frame.rodControlMovementBlockReason = rodControlMovementBlockReason ||
      rodControlResult?.blockedReason ||
      "none";
    frame.rodControlPlayerTensionKg = rodControlResult?.playerTensionKg ?? 0;
    frame.rodHoldMaxKg = rodPullResult.rodHoldMaxKg;
    frame.rodPullBlockedReason = rodPullDisplay.blockedReason;
    frame.rodPullDragSlipping = rodPullDisplay.dragSlipping;
    frame.rodStrokeCapacityMeters = rodPullDisplay.rodStrokeCapacityMeters;
    frame.rodStrokeRatio = rodPullDisplay.rodStrokeRatio;
    frame.rodStrokeUnrecoveredMeters = rodPullDisplay.rodStrokeUnrecoveredMeters;
    frame.shouldSlipDrag = !!fishRetrieveResult?.shouldSlipDrag;
    frame.totalTensionKg = tensionResult.totalTensionKg;
    this.#playerMaxPowerY = stressSystem.getEffectiveMaxTackleLoadKg() || 0;
  }

  #resolveFishActualBlockedReason({
    allowedVelocityX = 0,
    allowedVelocityY = 0,
    actualSpeedPxPerSec = 0,
    sectorMovementFrame = null,
    lineConstraintResult = null,
  } = {}) {
    const allowedSpeed = Math.hypot(
      Number(allowedVelocityX) || 0,
      Number(allowedVelocityY) || 0,
    );
    if (allowedSpeed <= 0.001 || Number(actualSpeedPxPerSec) > 0.001) {
      return "none";
    }
    if (sectorMovementFrame?.clamped === true) {
      const boundaryType = sectorMovementFrame.boundaryType || "unknown";
      const radiusDuplicate =
        boundaryType.includes("radius") &&
        sectorMovementFrame.enforceRadius !== false;
      return radiusDuplicate
        ? "sector_radius_duplicate"
        : `sector_${boundaryType}`;
    }
    if (
      lineConstraintResult?.constrained === true ||
      lineConstraintResult?.hardLimit === true
    ) {
      return "line_radius";
    }
    return "unknown_post_constraint";
  }

  #isLineTaut(lineState) {
    const recoverableLineMeters = Math.max(
      0,
      Number(lineState?.recoverableLineMeters) ||
        (
          (Number(lineState?.releasedMeters) || 0) -
          (Number(lineState?.distanceMeters) || 0)
        ),
    );
    return recoverableLineMeters <= 0.001;
  }

  #calculateAllowedPullMoveMeters({
    requestedMoveMeters,
    remainingStrokeMeters,
    fishPosition,
    rodTipPosition,
  }) {
    const requested = Math.max(0, Number(requestedMoveMeters) || 0);
    const remainingStroke = Math.max(0, Number(remainingStrokeMeters) || 0);
    if (requested <= 0 || remainingStroke <= 0) return 0;

    const dx = (Number(rodTipPosition?.x) || 0) - (Number(fishPosition?.x) || 0);
    const dy = (Number(rodTipPosition?.y) || 0) - (Number(fishPosition?.y) || 0);
    const distance = Math.hypot(dx, dy);
    if (distance <= 0.001) return 0;

    const yRatio = Math.abs(dy) / distance;
    if (yRatio <= 0.000001) return requested;
    return Math.min(requested, remainingStroke / yRatio);
  }

  #smoothPlayerPullAxis({ axis, desiredMoveMeters, dtSec }) {
    const config =
      this.#physicsConfig.getPlayerPullMotionConfig() ||
      this.#getRuntimePhysicsConfig()?.fight?.playerPullMotion ||
      {};
    return this.#playerPullMotionSmoother.updateAxis({
      axis,
      desiredMove: Number(desiredMoveMeters) || 0,
      deltaTime: dtSec,
      config,
    }).move;
  }


  #limitRodControlMoveTowardTarget({
    signedMoveMeters,
    fishPosition,
    rodControlResult,
    pixelsPerMeter,
  }) {
    const move = Number(signedMoveMeters) || 0;
    if (move === 0) return 0;
    if (rodControlResult?.active !== true) return move;
    const rawTargetX = rodControlResult?.targetRodX;
    if (rawTargetX === null || rawTargetX === undefined) return move;
    const targetX = Number(rawTargetX);
    if (!Number.isFinite(targetX)) return move;
    const fishX = Number(fishPosition?.x);
    if (!Number.isFinite(fishX)) return move;

    const direction = Math.sign(move);
    const distancePx = Math.abs(targetX - fishX);
    const thresholdPx = 0.001;
    if (distancePx <= thresholdPx) return 0;

    const towardTarget = Math.sign(targetX - fishX);
    if (towardTarget !== 0 && direction !== towardTarget) return 0;

    const scale = Math.max(1, Number(pixelsPerMeter) || 50);
    const maxMoveMeters = distancePx / scale;
    return direction * Math.min(Math.abs(move), maxMoveMeters);
  }

  #applyRodPullMovement({
    floatEntity,
    rodTipPosition,
    deltaMeters,
    pixelsPerMeter,
    bounds,
    checkWater,
    limitRadiusPx = 0,
  }) {
    const meters = Math.max(0, Number(deltaMeters) || 0);
    if (meters <= 0) return this.#movementResult();

    const position = floatEntity.getPosition();
    const dx = rodTipPosition.x - position.x;
    const dy = rodTipPosition.y - position.y;
    const distancePx = Math.hypot(dx, dy);
    if (distancePx <= 0.001) {
      return this.#movementResult({ blockedReason: "target_reached" });
    }

    const scale = Math.max(1, Number(pixelsPerMeter) || 50);
    const movePx = Math.min(distancePx, meters * scale);
    const rawNext = {
      x: position.x + (dx / distancePx) * movePx,
      y: position.y + (dy / distancePx) * movePx,
    };
    const next = this.#clampToBounds(
      rawNext,
      bounds,
    );
    let hardBlocked =
      Math.abs(next.x - rawNext.x) > 0.001 ||
      Math.abs(next.y - rawNext.y) > 0.001;
    let blockedReason = hardBlocked ? "bounds_blocked" : "none";

    if (typeof checkWater === "function" && !checkWater(next.x, next.y)) {
      const waterEdgePoint = this.#findLastWaterPoint({
        from: position,
        to: next,
        checkWater,
      });
      hardBlocked = true;
      blockedReason = "water_blocked";
      if (!waterEdgePoint) {
        return this.#movementResult({ blockedReason, hardBlocked });
      }
      next.x = waterEdgePoint.x;
      next.y = waterEdgePoint.y;
    }

    const sectorFrame = this.#applyPoleFightSectorMovement({
      fromPosition: position,
      proposedPosition: next,
      origin: rodTipPosition,
      limitRadiusPx,
    });
    const directionalBlocked = sectorFrame.clamped === true;
    if (directionalBlocked && blockedReason === "none") {
      blockedReason = "pole_fight_sector";
    }

    const appliedPx = Math.hypot(next.x - position.x, next.y - position.y);
    position.x = next.x;
    position.y = next.y;
    return this.#movementResult({
      meters: appliedPx / scale,
      blockedReason,
      hardBlocked,
      directionalBlocked,
    });
  }

  #applyRodControlMovement({
    floatEntity,
    rodTipPosition,
    directionX,
    deltaMeters,
    pixelsPerMeter,
    bounds,
    checkWater,
    lineConstraintState,
    limitRadiusPx = 0,
    projectLockedMovementToArc,
  }) {
    const direction = Math.sign(Number(directionX) || 0);
    const meters = Math.max(0, Number(deltaMeters) || 0);
    if (direction === 0 || meters <= 0) {
      return this.#movementResult();
    }

    const position = floatEntity.getPosition();
    const scale = Math.max(1, Number(pixelsPerMeter) || 50);
    const requestedMovePx = meters * scale;
    const rawNext = this.#rodControlMovementProjector.resolveNextPoint({
      position,
      rodTipPosition,
      directionX: direction,
      deltaMeters: meters,
      pixelsPerMeter: scale,
      lineConstraintState,
      projectLockedMovementToArc,
    });
    const movementStart = {
      x: Number(rawNext.normalizedStartX) || position.x,
      y: Number(rawNext.normalizedStartY) || position.y,
    };
    const next = this.#clampToBounds(rawNext, bounds);
    let hardBlocked =
      Math.abs(next.x - rawNext.x) > 0.001 ||
      Math.abs(next.y - rawNext.y) > 0.001;
    let blockedReason = hardBlocked ? "bounds_blocked" : "none";
    let postProjectionClamped = hardBlocked;

    if (typeof checkWater === "function" && !checkWater(next.x, next.y)) {
      const waterEdgePoint = this.#findLastWaterPoint({
        from: movementStart,
        to: next,
        checkWater,
      });
      hardBlocked = true;
      postProjectionClamped = true;
      blockedReason = "water_blocked";
      if (!waterEdgePoint) {
        position.x = movementStart.x;
        position.y = movementStart.y;
        return this.#movementResult({
          blockedReason,
          hardBlocked,
          constraintCorrectionPx: rawNext.constraintCorrectionPx,
        });
      }
      next.x = waterEdgePoint.x;
      next.y = waterEdgePoint.y;
    }

    const sectorFrame = this.#applyPoleFightSectorMovement({
      fromPosition: movementStart,
      proposedPosition: next,
      origin: rodTipPosition,
      limitRadiusPx,
    });
    const directionalBlocked = sectorFrame.clamped === true;
    if (directionalBlocked) {
      postProjectionClamped = true;
      if (blockedReason === "none") blockedReason = "pole_fight_sector";
    }

    const endpointMovePx = Math.hypot(
      next.x - movementStart.x,
      next.y - movementStart.y,
    );
    const projectedPathPx = Math.min(
      requestedMovePx,
      Math.max(0, Number(rawNext.appliedPathPx) || 0),
    );
    const appliedControlPx = postProjectionClamped
      ? Math.min(projectedPathPx, endpointMovePx)
      : projectedPathPx;
    const movementInvariantViolated =
      appliedControlPx > requestedMovePx + 0.001;

    position.x = next.x;
    position.y = next.y;
    return this.#movementResult({
      meters: movementInvariantViolated ? meters : appliedControlPx / scale,
      px: movementInvariantViolated ? requestedMovePx : appliedControlPx,
      signedMeters: direction * (
        movementInvariantViolated ? meters : appliedControlPx / scale
      ),
      requestedPx: requestedMovePx,
      blockedReason: movementInvariantViolated
        ? "movement_invariant_violation"
        : blockedReason,
      hardBlocked: hardBlocked || movementInvariantViolated,
      directionalBlocked,
      constraintCorrectionPx: rawNext.constraintCorrectionPx,
      mode: rawNext.mode,
    });
  }

  #resolvePoleFightSectorLimitRadiusPx({
    lineState = null,
    lineConstraintState = null,
  } = {}) {
    const releasedMeters = Math.max(
      0,
      Number(
        lineConstraintState?.lockedLengthMeters ??
        lineConstraintState?.releasedMeters ??
        lineState?.releasedMeters,
      ) || 0,
    );
    const pixelsPerMeter = Math.max(
      1,
      Number(this.#physicsConfig.getPixelsPerMeter()) || 50,
    );
    return releasedMeters * pixelsPerMeter;
  }

  #resolveLineConstraintState({
    lineState,
    dragContext,
    fishRetrieveResult,
    payoutResult = null,
    config = null,
  } = {}) {
    const payoutContext = this.#buildLinePayoutContext({
      lineState,
      dragContext,
      fishRetrieveResult,
      payoutResult,
    });
    return this.#lineConstraintStateResolver.resolve({
      lineState,
      payoutContext,
      config: this.#getLineConstraintConfig(config),
    });
  }

  #getLineConstraintConfig(config = null) {
    if (config?.lineConstraint) return config.lineConstraint;
    if (
      config &&
      (
        Object.prototype.hasOwnProperty.call(config, "tautThresholdRatio") ||
        Object.prototype.hasOwnProperty.call(config, "epsilonMeters") ||
        Object.prototype.hasOwnProperty.call(config, "projectLockedMovementToArc")
      )
    ) {
      return config;
    }
    return (
      this.#physicsConfig?.getRodControlConfig?.()?.lineConstraint ||
      this.#getRuntimePhysicsConfig()?.fight?.rodControl?.lineConstraint ||
      {}
    );
  }

  #buildLinePayoutContext({
    lineState,
    dragContext,
    fishRetrieveResult,
    payoutResult,
  }) {
    const lineHasReserve = hasLineReserve(lineState);
    const dragSupported = !!dragContext?.dragSupported;
    const dragLocked = dragContext?.dragLocked !== false;
    const dragOpen = dragContext?.dragOpen === true;
    const dragSlipResolved = fishRetrieveResult?.shouldSlipDrag === true;
    const dragCanPayout =
      lineHasReserve &&
      dragSupported &&
      !dragLocked &&
      (dragOpen || dragSlipResolved);
    const dragPayoutBlocked =
      lineHasReserve && !dragCanPayout;

    return Object.freeze({
      lineHasReserve,
      dragCanPayout,
      dragPayoutBlocked,
      dragOpen,
      dragSlipResolved,
      payoutOccurred: payoutResult?.didSlip === true,
      payoutBlockedReason:
        payoutResult?.releaseBlockedReason || "none",
      reason: !lineHasReserve
        ? "spool_empty"
        : dragCanPayout
          ? "none"
          : "drag_holding",
    });
  }

  #movementResult({
    meters = 0,
    px = 0,
    signedMeters = 0,
    requestedPx = 0,
    constraintCorrectionPx = 0,
    blockedReason = "none",
    hardBlocked = false,
    directionalBlocked = false,
    mode = "none",
  } = {}) {
    return {
      meters: Math.max(0, Number(meters) || 0),
      px: Math.max(0, Number(px) || 0),
      signedMeters: Number(signedMeters) || 0,
      requestedPx: Math.max(0, Number(requestedPx) || 0),
      constraintCorrectionPx: Math.max(
        0,
        Number(constraintCorrectionPx) || 0,
      ),
      blockedReason,
      hardBlocked: !!hardBlocked,
      directionalBlocked: !!directionalBlocked,
      mode,
    };
  }

  #findLastWaterPoint({ from, to, checkWater }) {
    if (!checkWater(from.x, from.y)) return null;

    let low = 0;
    let high = 1;
    let found = false;
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    for (let i = 0; i < 8; i++) {
      const t = (low + high) * 0.5;
      const x = from.x + dx * t;
      const y = from.y + dy * t;

      if (checkWater(x, y)) {
        low = t;
        found = true;
      } else {
        high = t;
      }
    }

    if (!found || low <= 0.0001) return null;

    this.#waterProbePoint.x = from.x + dx * low;
    this.#waterProbePoint.y = from.y + dy * low;
    return this.#waterProbePoint;
  }

  #clampToBounds(point, bounds) {
    if (!bounds) return point;
    const minX = Number.isFinite(Number(bounds.left)) ? Number(bounds.left) : -Infinity;
    const maxX = Number.isFinite(Number(bounds.right)) ? Number(bounds.right) : Infinity;
    const minY = Number.isFinite(Number(bounds.top)) ? Number(bounds.top) : -Infinity;
    const maxY = Number.isFinite(Number(bounds.bottom)) ? Number(bounds.bottom) : Infinity;
    return {
      x: Math.max(minX, Math.min(maxX, point.x)),
      y: Math.max(minY, Math.min(maxY, point.y)),
    };
  }

  getDiagnostics() {
    return this.#debug;
  }

  #getRuntimePhysicsConfig() {
    return this.#config.physics || {};
  }

}
