class RenderSystem {
  #renderer;
  #map;
  #projector;
  #chum;
  #renderConfig;
  #locationConfig;

  constructor({
    renderer,
    map,
    projector,
    chum,
    renderConfig,
    locationConfig,
  }) {
    this.#renderer = renderer;
    this.#map = map;
    this.#projector = projector;
    this.#chum = chum;
    this.#renderConfig = renderConfig;
    this.#locationConfig = locationConfig;
  }

  drawWorld(invalidCastMarker, debugEnabled) {
    const r = this.#renderer;
    const locations = this.#locationConfig;

    r.clear(this.#renderConfig.canvas.backgroundColor);
    r.drawBackground(this.#map, this.#projector);

    if (debugEnabled && locations?.debugVisuals) {
      r.drawLocationDebug?.(this.#map, this.#projector, locations);
    }

    if (locations?.showChumZones !== false) {
      r.drawChumZones(this.#chum, this.#projector);
    }

    if (this.#chum) {
      r.drawBoatWaypoints?.(this.#chum, this.#projector);
      r.drawBoats?.(this.#chum, this.#projector);

      const boats = this.#chum.getBoats();
      for (let i = 0; i < boats.length; i++) {
        r.renderSensors?.(boats[i], this.#projector);
      }
    }

    if (invalidCastMarker) {
      r.drawInvalidCastMarker(invalidCastMarker);
    }

    return r;
  }
}

class FishingRenderService {
  #inventory;
  #input;
  #getInputState;
  #projector;
  #canvasMetrics;
  #clock;
  #config;
  #equipmentRules;
  #baitRules;
  #getFloat;
  #getNet;
  #getCastDistanceRatio;
  #getCurrentHookDepth;
  #scratch;
  #scratch2;

  constructor({
    inventory,
    input,
    projector,
    canvasMetrics,
    clock,
    config,
    equipmentRules,
    baitRules,
    getFloat,
    getNet,
    getInputState,
    getCastDistanceRatio,
    getCurrentHookDepth,
    scratch,
    scratch2,
  }) {
    this.#inventory = inventory;
    this.#input = input;
    this.#getInputState = getInputState || (() => this.#input.getState());
    this.#projector = projector;
    this.#canvasMetrics = canvasMetrics;
    this.#clock = clock;
    this.#config = config;
    this.#equipmentRules = equipmentRules;
    this.#baitRules = baitRules;
    this.#getFloat = getFloat;
    this.#getNet = getNet;
    this.#getCastDistanceRatio = getCastDistanceRatio;
    this.#getCurrentHookDepth = getCurrentHookDepth;
    this.#scratch = scratch;
    this.#scratch2 = scratch2;
  }

  draw(renderer, bottom, state, tMeter, fCond, startTime) {
    const eq = this.#inventory.getEquipped();
    const floatEntity = this.#getFloat();
    const floatPos = floatEntity.getPosition();
    const sPos = this.#projector.virtualToScreen(
      floatPos.x,
      floatPos.y,
      this.#scratch,
    );
    const elapsed = this.#clock.now - startTime;
    let ratio = 1.0;
    let drop = 0;
    const lineCfg = this.#config.ui.line;

    if (state === "waiting" || state === "biting") {
      const minDelay = lineCfg.distanceDelayMinMs ?? 1500;
      const maxDelay = lineCfg.distanceDelayMaxMs ?? 5000;
      const distanceDelay =
        minDelay + this.#getCastDistanceRatio() * (maxDelay - minDelay);
      const activeItem =
        (this.#equipmentRules.isSpinning(eq) ? eq.baits?.[0] : eq.sinker) || {};
      const sinkRate = this.#baitRules.getSinkRate(activeItem, 1);
      const duration =
        (this.#getCurrentHookDepth() / sinkRate) * 1000 + distanceDelay;
      const prog = duration > 0 ? Math.min(1, elapsed / duration) : 1;
      const ease = 1 - Math.pow(1 - prog, lineCfg.shrinkEasePower ?? 4);
      ratio = 1.0 - ease * (1.0 - lineCfg.shrinkPercent / 100);
      drop = ease * (lineCfg.sinkDropPx || 120);
      if (this.#getInputState().isPulling) {
        ratio = 1.0;
        drop = 0;
      }
    } else if (state === "playing") {
      const baseSnap = lineCfg.snapDurationMs ?? 300;
      const depthRatio = Math.min(1, this.#getCurrentHookDepth() / 10.0);
      const snapDuration =
        baseSnap *
        (1.0 + depthRatio * ((lineCfg.snapDepthMaxMultiplier ?? 2.0) - 1.0));
      const prog = snapDuration > 0 ? Math.min(1, elapsed / snapDuration) : 1;
      const ease = 1 - Math.pow(1 - prog, 3);
      const startR = lineCfg.shrinkPercent / 100;
      ratio = startR + ease * (1.0 - startR);
      drop = (lineCfg.sinkDropPx || 120) * (1 - ease);
    }

    const mapBottomScreenY = this.#projector.virtualToScreen(
      0,
      bottom,
      this.#scratch2,
    ).y;
    const rodScreenY =
      this.#canvasMetrics.height - (this.#config.ui?.rod?.yOffset || 0);
    const rodTopY = rodScreenY - 200;
    const distY = sPos.y - rodTopY;
    if (distY < 0)
      ratio = Math.max(ratio, (mapBottomScreenY - rodTopY) / distY);
    const targetYAfterShrink = rodTopY + distY * ratio;
    drop = Math.min(drop, Math.max(0, mapBottomScreenY - targetYAfterShrink));

    renderer.drawCatchZone(
      this.#projector,
      this.#getNet(),
      bottom,
      this.#config.locations,
      this.#config.ui.catchZone,
    );
    renderer.drawRodLine(
      sPos,
      state,
      tMeter?.getTension() || 0,
      ratio,
      drop,
      this.#config.ui.rod,
      lineCfg,
      this.#clock.now,
    );
    renderer.drawFloat(sPos, floatEntity, eq.float || {}, this.#projector, eq);
    if (state === "playing" && tMeter && fCond) {
      renderer.drawTensionBar(
        tMeter,
        this.#config.tension,
        this.#config.ui.indicators,
      );
      renderer.drawFishCondition(fCond, this.#config.ui.indicators);
    }
  }
}
