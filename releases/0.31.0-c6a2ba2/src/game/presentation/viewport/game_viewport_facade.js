import { RodVisualOffsetSystem } from "../fishing/rod_visual_offset_system.js";
import { Vector2 } from "../../../engine/math/vector2.js";

export class GameViewportFacade {
  #world;
  #projector;
  #canvasMetrics;
  #config;
  #biteEnvironmentService;
  #rodVirtualPos = new Vector2(0, 0);
  #baseRodVirtualPos = new Vector2(0, 0);
  #screenScratch = new Vector2(0, 0);
  #playableScratch = new Vector2(0, 0);
  #viewportSize = { width: 0, height: 0 };
  #rodVisualOffsetSystem = new RodVisualOffsetSystem();

  constructor({
    world,
    projector,
    canvasMetrics,
    config,
    biteEnvironmentService,
  }) {
    try {

    this.#world = world;
    this.#projector = projector;
    this.#canvasMetrics = canvasMetrics;
    this.#config = config;
    this.#biteEnvironmentService = biteEnvironmentService;
  
    } catch (error) { this.dispose(); throw error; }
}

  refreshViewport(recalculateMap = true) {
    this.#world.refreshViewport(recalculateMap);
  }

  refreshLocationConfig(locationsConfig, locationResources) {
    this.#world.refreshLocationConfig(locationsConfig, locationResources);
  }

  applyPan(input, stateName, isAimingChum) {
    if (!input.panDeltaX && !input.panDeltaY) return;
    if (stateName !== "scouting" && !isAimingChum) return;
    if (
      this.#config.casting?.enabled !== false &&
      input.pointerDown &&
      (stateName === "scouting" || isAimingChum)
    ) {
      return;
    }
    this.#world.pan(input.panDeltaX, 0);
  }

  getDynamicBounds() {
    return this.#biteEnvironmentService.getDynamicBounds();
  }

  checkWater(vx, vy) {
    return this.#biteEnvironmentService.checkWater(vx, vy);
  }

  getRodVirtualPos(bounds, screenXOverride = null) {
    const screenX = this.getRodScreenX(screenXOverride, bounds);

    this.#projector.screenToVirtual(screenX, 0, this.#rodVirtualPos);
    this.#rodVirtualPos.y = bounds.bottom;
    return this.#rodVirtualPos;
  }

  getBaseRodVirtualPos(bounds, screenXOverride = null) {
    const screenX = this.#resolveBaseRodScreenX(screenXOverride);

    this.#projector.screenToVirtual(screenX, 0, this.#baseRodVirtualPos);
    this.#baseRodVirtualPos.y = bounds.bottom;
    return this.#baseRodVirtualPos;
  }

  getScreenOffsetRatio(floatPos, screenXOverride = null) {
    const sPos = this.#projector.virtualToScreen(
      floatPos.x,
      floatPos.y,
      this.#screenScratch,
    );
    const screenX = this.getRodScreenX(screenXOverride, null);
    const halfWidth = Math.max(1, this.#canvasMetrics.width / 2);
    return Math.min(1, Math.abs(sPos.x - screenX) / halfWidth);
  }

  updateRodVisualOffset({ dtMs, input, fightDebug, bounds, stateName } = {}) {
    const rodControlConfig = this.#config.fightPhysicsConfig?.getRodControlConfig?.() ||
      this.#config.physics?.fight?.rodControl ||
      {};
    const activeInput =
      stateName === "playing"
        ? input
        : {
            ...input,
            rodControlActive: false,
            rodControlDirectionX: 0,
            rodControlInputRatio: 0,
          };
    const offsetX = this.#rodVisualOffsetSystem.update({
      dtSec: Math.max(0, Number(dtMs) || 0) / 1000,
      inputState: activeInput,
      fightDebug,
      config: rodControlConfig,
      canvasWidth: this.#canvasMetrics.width,
    });
    if (fightDebug) {
      const visualFrame = this.#rodVisualOffsetSystem.getFrame();
      fightDebug.rodVisualOffsetX = offsetX;
      fightDebug.rodVisualClamped = this.#rodVisualOffsetSystem.isClamped();
      fightDebug.rodVisualDeltaX = visualFrame.deltaPx;
      fightDebug.rodVisualMaxOffsetX = visualFrame.maxOffsetPx;
      fightDebug.rodVisualStrokeRatio = visualFrame.strokeRatio;
      fightDebug.rodVisualAtLimit =
        visualFrame.atLimit || fightDebug.rodVisualClamped;
      fightDebug.rodVisualTargetOffsetX = visualFrame.targetOffsetPx;
      fightDebug.rodVisualWeightSpeedRatio = visualFrame.weightSpeedRatio;
      fightDebug.rodAimWeightSpeedRatio = visualFrame.weightSpeedRatio;
      fightDebug.rodAimFishLoadRatio = visualFrame.weightLoadRatio;
      fightDebug.rodAimEffectiveFishLoadKg = visualFrame.effectiveFishLoadKg;
      fightDebug.rodAimLoadLimitKg = visualFrame.weightLoadLimitKg;
      fightDebug.rodAimWeightCurvePower = visualFrame.weightCurvePower;
      fightDebug.rodAimWeightMinSpeedRatio = visualFrame.weightSpeedMinRatio;
      fightDebug.rodAimWeightMaxSpeedRatio = visualFrame.weightSpeedMaxRatio;
      fightDebug.rodAimLoadSpeedRatio = visualFrame.loadSpeedRatio;
      fightDebug.rodAimLineSpeedRatio = visualFrame.lineSpeedRatio;
      fightDebug.rodAimDirectionSpeedRatio = visualFrame.directionSpeedRatio;
      fightDebug.rodAimDirectionSpeedMode = visualFrame.directionSpeedMode;
      fightDebug.rodAimFishMoveX = visualFrame.fishMoveX;
      fightDebug.rodAimFishDirectionX = visualFrame.fishMoveDirectionX;
      fightDebug.rodAimSpeedPxPerSecond = visualFrame.aimSpeedPxPerSecond;
      fightDebug.rodAimLineMode = visualFrame.lineMode;
      fightDebug.rodControlVisualDrivenByInput = visualFrame.drivenByInput;
      fightDebug.rodControlVisualMode = visualFrame.mode;
      fightDebug.rodControlFreeLineVisualMode = visualFrame.freeLineMode;
    }
  }

  getRodScreenX(screenXOverride = null, bounds = null) {
    const baseX = this.#resolveBaseRodScreenX(screenXOverride);
    const playable = this.#resolvePlayableScreenBounds(bounds);
    const rodControlConfig = this.#config.fightPhysicsConfig?.getRodControlConfig?.() ||
      this.#config.physics?.fight?.rodControl ||
      {};
    return this.#rodVisualOffsetSystem.resolveScreenX({
      baseX,
      canvasWidth: this.#canvasMetrics.width,
      playableLeft: playable.left,
      playableRight: playable.right,
      config: rodControlConfig,
    });
  }

  #resolveBaseRodScreenX(screenXOverride = null) {
    const rodConfig = this.#config.ui?.rod || {};
    const rodX =
      Number.isFinite(screenXOverride)
        ? screenXOverride
        : rodConfig.x === "center"
          ? this.#canvasMetrics.width / 2
          : Number(rodConfig.x);
    return Number.isFinite(rodX)
      ? rodX
      : this.#canvasMetrics.width / 2;
  }

  #resolvePlayableScreenBounds(bounds) {
    if (!bounds) return { left: null, right: null };
    const left = Number(bounds.left);
    const right = Number(bounds.right);
    if (!Number.isFinite(left) || !Number.isFinite(right)) {
      return { left: null, right: null };
    }
    const leftScreen = this.#projector.virtualToScreen(
      left,
      Number(bounds.bottom) || 0,
      this.#playableScratch,
    ).x;
    const rightScreen = this.#projector.virtualToScreen(
      right,
      Number(bounds.bottom) || 0,
      this.#playableScratch,
    ).x;
    return {
      left: Math.min(leftScreen, rightScreen),
      right: Math.max(leftScreen, rightScreen),
    };
  }

  getViewportSize() {
    this.#viewportSize.width = this.#canvasMetrics.width;
    this.#viewportSize.height = this.#canvasMetrics.height;
    return this.#viewportSize;
  }
}
