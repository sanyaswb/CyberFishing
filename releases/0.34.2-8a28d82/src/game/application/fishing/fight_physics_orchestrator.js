import { FightInputActionComposer } from "../input/fight_input_action_composer.js";
import { FightFishMotionStage } from "./fight_fish_motion_stage.js";
import { FightLandingTensionStage } from "./fight_landing_tension_stage.js";
import { FightLineConstraint } from "./fight_line_constraint.js";
import { FightLineRecoveryStage } from "./fight_line_recovery_stage.js";
import { FightPhysicsPipeline } from "./fight_physics_pipeline.js";
import { FightPlayerPressureStage } from "./fight_player_pressure_stage.js";
import { FightPoleSector } from "./fight_pole_sector.js";
import { FightRodMovementStage } from "./fight_rod_movement_stage.js";
import { FightStaminaFrameBuilder } from "./fight_stamina_frame_builder.js";
import { FishRetrieveSystem } from "../../domain/fishing/fish_retrieve_system.js";
import { RecoverableLineCalculator } from "../../domain/fishing/recoverable_line_calculator.js";
import { PlayerPullMotionSmoother } from "../../domain/fishing/player_pull_motion_smoother.js";
import { ReelRecoveryFishSlowdownPolicy } from "../../domain/fishing/reel_recovery_fish_slowdown_policy.js";
import { hasLineReserve } from "../../domain/fishing/line_state_queries.js";
import { hasFinitePoint } from "../../../engine/math/number_normalization.js";

export class FightPhysicsOrchestrator {
  #config;
  #physicsConfig;
  #recoverableLineCalculator = new RecoverableLineCalculator();
  #playerPullMotionSmoother = new PlayerPullMotionSmoother();
  #recoveryFishSlowdownPolicy = new ReelRecoveryFishSlowdownPolicy();
  #fightInputActionComposer = new FightInputActionComposer();
  #composedInputScratch = {};
  #pipeline;
  #playerPressure;
  #landingTension;
  #staminaFrameBuilder;
  #lineConstraint;
  #poleSector;
  #fishMotion;
  #rodMovement;
  #lineRecovery;
  #logger;
  #fishRetrieveSystem;
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
    // Pipeline stages of this fight session, built once; shared helpers are passed to the stages that use them.
    const settings = { config: this.#config, physicsConfig: this.#physicsConfig };
    this.#playerPressure = new FightPlayerPressureStage(settings);
    this.#landingTension = new FightLandingTensionStage(settings);
    this.#staminaFrameBuilder = new FightStaminaFrameBuilder({ config: this.#config, logger: this.#logger });
    this.#lineConstraint = new FightLineConstraint(settings);
    this.#poleSector = new FightPoleSector(settings);
    this.#fishMotion = new FightFishMotionStage({
      ...settings,
      recoveryFishSlowdownPolicy: this.#recoveryFishSlowdownPolicy,
      lineConstraint: this.#lineConstraint,
      poleSector: this.#poleSector,
    });
    this.#rodMovement = new FightRodMovementStage({
      ...settings,
      playerPullMotionSmoother: this.#playerPullMotionSmoother,
      recoverableLineCalculator: this.#recoverableLineCalculator,
      lineConstraint: this.#lineConstraint,
      poleSector: this.#poleSector,
    });
    this.#lineRecovery = new FightLineRecoveryStage({
      physicsConfig: this.#physicsConfig,
      recoverableLineCalculator: this.#recoverableLineCalculator,
      lineConstraint: this.#lineConstraint,
    });
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
    const motion = pipelineFrame.run("update_fish_motion", () => this.#fishMotion.updateFishMotion({
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
          budget: this.#playerPressure.resolvePlayerForceBudget({
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
      () => this.#playerPressure.resolvePlayerPressureGain({
        playerForceBudget,
        physics,
      }),
    );
    const playerTensionBuildRateFrame = pipelineFrame.run(
      "resolve_player_tension_build_rate",
      () => this.#playerPressure.resolvePlayerTensionBuildRate({
        playerForceBudget,
        physics,
      }),
    );
    const playerPressureFatigueApplication = pipelineFrame.run(
      "resolve_player_pressure_fatigue_application",
      () => this.#playerPressure.buildPlayerPressureFatigueApplicationFrame({ physics }),
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
      () => this.#rodMovement.updateRodPull({
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
      holdReelRecover: this.#lineRecovery.holdReelRecoverState,
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
      () => this.#rodMovement.updateRodControl({
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
      () => this.#landingTension.calculateTension({
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
      () => this.#rodMovement.recordRodStrokeDistance({
        rodPullSystem,
        previousLineState: rodPullFrame.lineStateBeforePull,
        currentLineState: rodPullFrame.lineStateAfterPull,
      }),
    );
    const postStrokeRodPullResult = rodPullSystem.getState() ||
      rodPullFrame.rodPullResult;
    const recoverFrame = pipelineFrame.run("recover_line", () => {
      const recoveryLoad = this.#lineRecovery.resolveReelRecoveryLoad({
        tensionResult: tensionPreview,
        dragContext,
      });
      const holdReelRecover = this.#lineRecovery.updateHoldReelRecovery({
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
      const autoRecovery = this.#lineRecovery.recoverRodStrokeCredit({
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
        ? this.#lineRecovery.recoverLineCredit({
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
      () => this.#playerPressure.updatePlayerReelFatigueSession({
        recoverFrame,
      }),
    );
    const playerPressureFatigueSourceFrame = pipelineFrame.run(
      "resolve_player_pressure_fatigue_source",
      () => this.#playerPressure.resolvePlayerPressureFatigueSource({
        physics,
        recoverFrame,
        playerReelFatigueSession: playerReelFatigueSessionFrame,
        rodPullResult: postStrokeRodPullResult,
        rodControlResult: rodControlFrame.rodControlResult,
      }),
    );
    const playerPressureFatigueFrame = pipelineFrame.run(
      "update_player_pressure_fatigue",
      () => this.#playerPressure.updatePlayerPressureFatigueFrame({
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
      () => this.#lineRecovery.resolveLineLimit({
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
      () => this.#poleSector.inspectPoleFightSector({
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
      () => this.#landingTension.updateTension({
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
      () => this.#landingTension.buildLandingFrame({
        forceData,
        lineState: finalLineState,
        tensionResult,
      }),
    );
    const staminaFrame = pipelineFrame.run(
      "resolve_stamina_frame",
      () => this.#staminaFrameBuilder.buildStaminaFrame({
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
      requestedMode === "cast_base" && hasFinitePoint(castBaseRodTipPosition)
        ? "cast_base"
        : "current_base";
    const source =
      mode === "cast_base"
        ? castBaseRodTipPosition
        : currentBaseRodTipPosition;
    if (!hasFinitePoint(source)) return null;
    return Object.freeze({
      x: Number(source.x),
      y: Number(source.y),
      mode,
    });
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

  resetPlayerPullMotion() {
    this.#playerPullMotionSmoother.reset();
    this.#poleSector.reset();
    this.#staminaFrameBuilder.reset();
    this.#playerPressure.reset();
    this.#recoveryFishSlowdownPolicy.reset(
      this.#lineRecoveryFishSlowdownState,
    );
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

  getDiagnostics() {
    return this.#debug;
  }

  #getRuntimePhysicsConfig() {
    return this.#config.physics || {};
  }

}
