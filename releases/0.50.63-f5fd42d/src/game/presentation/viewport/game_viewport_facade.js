import { Vector2 } from "../../../engine/math/vector2.js";

export class GameViewportFacade {
  #world;
  #projector;
  #canvasMetrics;
  #config;
  #biteEnvironmentService;
  #getCastRodScreenX;
  #rodVirtualPos = new Vector2(0, 0);
  #baseRodVirtualPos = new Vector2(0, 0);
  #screenScratch = new Vector2(0, 0);
  #playableScratch = new Vector2(0, 0);
  #viewportSize = { width: 0, height: 0 };
  #rodVisualOffsetSystem;
  // Spec 153 (D3): the rod's world X. Its screen X is the camera's projection of it, so the window size and the camera
  // following the tackle never move the rod in the world; null until the camera is placed (then the configured screen X).
  #rodAnchorX = null;
  #anchorScratch = new Vector2(0, 0);

  constructor({
    world,
    projector,
    canvasMetrics,
    config,
    biteEnvironmentService,
    rodVisualOffsetSystem,
    getCastRodScreenX = () => null,
  }) {
    if (typeof rodVisualOffsetSystem?.update !== "function") {
      throw new TypeError("GameViewportFacade requires rodVisualOffsetSystem");
    }
    try {

    this.#world = world;
    this.#projector = projector;
    this.#canvasMetrics = canvasMetrics;
    this.#config = config;
    this.#biteEnvironmentService = biteEnvironmentService;
    this.#getCastRodScreenX = getCastRodScreenX;
    this.#rodVisualOffsetSystem = rodVisualOffsetSystem;
  
    } catch (error) { this.dispose(); throw error; }
}

  refreshViewport(recalculateMap = true) {
    this.#world.refreshViewport(recalculateMap);
  }

  refreshLocationConfig(locationsConfig, locationResources) {
    this.#world.refreshLocationConfig(locationsConfig, locationResources);
    // A new location places its camera anew; the rod takes the configured screen place in it.
    this.#rodAnchorX = null;
  }

  // Spec 153: after the canvas changed size the camera brings the rod's world place to the new canvas centre (as far as
  // the map allows); the rod itself stays where it is in the world.
  keepRodAnchored() {
    this.recenterRod(this.#rodAnchor());
  }

  // The player's pan (scouting, chum aim): the rod goes with the camera and keeps its screen place, as the fishing spot
  // is chosen by panning.
  panByPlayer(deltaX) {
    const before = this.#projector.screenToVirtual(0, 0, this.#anchorScratch).x;
    this.#world.pan(deltaX, 0);
    const moved = this.#projector.screenToVirtual(0, 0, this.#anchorScratch).x - before;
    if (this.#rodAnchorX !== null) this.#rodAnchorX += moved;
  }

  applyPan(input, stateName, isAimingChum) {
    if (!input.panDeltaX && !input.panDeltaY) return;
    if (stateName !== "scouting" && !isAimingChum) return;
    if (
      this.#config.casting?.enabled !== false &&
      input.pointerDown &&
      !input.pointerPanning &&
      (stateName === "scouting" || isAimingChum)
    ) {
      return;
    }
    this.panByPlayer(input.panDeltaX);
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

  // Split stage change (spec 098): the rod's world X before the canvas changes size, then a camera pan that puts that
  // point at the new canvas centre. Returns the rod's new screen X (the centre unless the camera reached a map edge).
  rodAnchorVirtualX(screenXOverride = null) {
    return this.#projector.screenToVirtual(this.#resolveBaseRodScreenX(screenXOverride), 0, this.#screenScratch).x;
  }

  // The camera puts the rod's world point at the rod's configured screen place (the centre for "center"); no pan when
  // it is there already.
  recenterRod(virtualX) {
    const currentX = this.#projector.virtualToScreen(virtualX, 0, this.#screenScratch).x;
    const delta = currentX - this.#configuredRodScreenX();
    if (Math.abs(delta) > 1e-9) this.#world.pan(delta, 0);
    return this.#projector.virtualToScreen(virtualX, 0, this.#screenScratch).x;
  }

  getBaseRodVirtualPos(bounds, screenXOverride = null) {
    const screenX = this.#resolveBaseRodScreenX(screenXOverride);

    this.#projector.screenToVirtual(screenX, 0, this.#baseRodVirtualPos);
    this.#baseRodVirtualPos.y = bounds.bottom;
    return this.#baseRodVirtualPos;
  }

  // Spec 153 (D2): the fish's side share = its distance from the rod along X in map units over half the reference
  // screen width (CONFIG.locations.baseResolution): on the reference 2560 px screen at scale 1 this is the screen share
  // the fight was tuned with, and no window size or camera changes it.
  getScreenOffsetRatio(floatPos, screenXOverride = null) {
    const rodScreenX = this.getRodScreenX(screenXOverride, this.getDynamicBounds());
    const rodX = this.#projector.screenToVirtual(rodScreenX, 0, this.#screenScratch).x;
    const halfWidth = Math.max(1, this.#referenceWidth() / 2);
    return Math.min(1, Math.abs(floatPos.x - rodX) / halfWidth);
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
      referenceWidth: this.#referenceWidth(),
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
    const castX = this.#getCastRodScreenX();
    if (Number.isFinite(castX)) return castX;
    const baseX = this.#resolveBaseRodScreenX(screenXOverride);
    const playable = this.#resolvePlayableScreenBounds(bounds);
    const rodControlConfig = this.#config.fightPhysicsConfig?.getRodControlConfig?.() ||
      this.#config.physics?.fight?.rodControl ||
      {};
    return this.#rodVisualOffsetSystem.resolveScreenX({
      baseX,
      playableLeft: playable.left,
      playableRight: playable.right,
      config: rodControlConfig,
      scale: this.#projector.getScale(),
    });
  }

  #resolveBaseRodScreenX(screenXOverride = null) {
    if (Number.isFinite(screenXOverride)) return screenXOverride;
    return this.#projector.virtualToScreen(this.#rodAnchor(), 0, this.#anchorScratch).x;
  }

  // The reference screen width in map units (CONFIG.locations.baseResolution): fight shares and the rod's travel are
  // measured against it, never against the canvas (spec 153).
  #referenceWidth() {
    return Number(this.#config.locations?.baseResolution?.width) || 2560;
  }

  // Screen pixels per map unit right now (the camera's scale).
  get pixelsPerUnit() {
    return this.#projector.getScale();
  }

  #rodAnchor() {
    this.#rodAnchorX ??= this.#projector.screenToVirtual(this.#configuredRodScreenX(), 0, this.#anchorScratch).x;
    return this.#rodAnchorX;
  }

  // The rod's screen place from CONFIG.ui.rod.x ("center" or pixels), where a new camera puts it.
  #configuredRodScreenX() {
    const rodConfig = this.#config.ui?.rod || {};
    const rodX = rodConfig.x === "center" ? this.#canvasMetrics.width / 2 : Number(rodConfig.x);
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

  getRodAimFrame() { return this.#rodVisualOffsetSystem.getFrame(); }
}
