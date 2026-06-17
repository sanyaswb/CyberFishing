class FishingRenderFrameBuilder {
  #inventory;
  #projector;
  #canvasMetrics;
  #clock;
  #config;
  #equipmentRules;
  #baitRules;
  #getFloat;
  #getInputState;
  #getCastDistanceRatio;
  #getCurrentHookDepth;
  #getHoldState;
  #lineVisualState;
  #fightAreaBuilder;
  #hudBuilder;
  #equipmentModelBuilder;
  #screenA = new Vector2(0, 0);
  #screenB = new Vector2(0, 0);

  constructor({
    inventory,
    projector,
    canvasMetrics,
    clock,
    config,
    equipmentRules,
    baitRules,
    getFloat,
    getInputState,
    getCastDistanceRatio,
    getCurrentHookDepth,
    getHoldState,
    lineVisualState,
    fightAreaBuilder,
    hudBuilder,
    equipmentModelBuilder,
  }) {
    const requiredFunctions = {
      getFloat,
      getInputState,
      getCastDistanceRatio,
      getCurrentHookDepth,
      getHoldState,
    };
    for (const [name, value] of Object.entries(requiredFunctions)) {
      if (typeof value !== "function") {
        throw new TypeError(`FishingRenderFrameBuilder requires ${name}`);
      }
    }
    if (!lineVisualState || typeof lineVisualState.update !== "function") {
      throw new TypeError(
        "FishingRenderFrameBuilder requires lineVisualState",
      );
    }
    if (!fightAreaBuilder || typeof fightAreaBuilder.buildInto !== "function") {
      throw new TypeError(
        "FishingRenderFrameBuilder requires fightAreaBuilder",
      );
    }
    if (!hudBuilder || typeof hudBuilder.buildInto !== "function") {
      throw new TypeError("FishingRenderFrameBuilder requires hudBuilder");
    }
    if (
      !equipmentModelBuilder ||
      typeof equipmentModelBuilder.buildRodLine !== "function" ||
      typeof equipmentModelBuilder.buildFloat !== "function"
    ) {
      throw new TypeError(
        "FishingRenderFrameBuilder requires equipmentModelBuilder",
      );
    }
    this.#inventory = inventory;
    this.#projector = projector;
    this.#canvasMetrics = canvasMetrics;
    this.#clock = clock;
    this.#config = config;
    this.#equipmentRules = equipmentRules;
    this.#baitRules = baitRules;
    this.#getFloat = getFloat;
    this.#getInputState = getInputState;
    this.#getCastDistanceRatio = getCastDistanceRatio;
    this.#getCurrentHookDepth = getCurrentHookDepth;
    this.#getHoldState = getHoldState;
    this.#lineVisualState = lineVisualState;
    this.#fightAreaBuilder = fightAreaBuilder;
    this.#hudBuilder = hudBuilder;
    this.#equipmentModelBuilder = equipmentModelBuilder;
  }

  buildInto({ fishingTarget, hudTarget, intent, clipRegions }) {
    if (!intent.visible) return;
    const floatEntity = this.#getFloat();
    if (!floatEntity) return;
    const equipment = this.#inventory.getEquipped();
    const floatPosition = floatEntity.getPosition();
    const screenPosition = this.#projector.virtualToScreen(
      floatPosition.x,
      floatPosition.y,
      this.#screenA,
    );
    const tensionMeter = intent.tensionMeter;
    const fightDebug = tensionMeter?.getDebugData?.() || null;
    const lineFrame = this.#resolveLineFrame(
      intent,
      equipment,
      tensionMeter,
      screenPosition,
    );

    fishingTarget.visible = true;
    this.#fightAreaBuilder.buildInto({
      target: fishingTarget.fightAreas,
      clipRegions,
      state: intent.state,
      bottom: intent.bottom,
      fightDebug,
      equipment,
      floatVirtualPosition: floatPosition,
    });
    this.#equipmentModelBuilder.buildRodLine({
      target: fishingTarget.rodLine,
      floatPosition: screenPosition,
      state: intent.state,
      tension: tensionMeter?.getTension?.() || 0,
      lineFrame,
    });
    this.#equipmentModelBuilder.buildFloat({
      target: fishingTarget.float,
      screenPosition,
      floatEntity,
      equipment,
    });

    if (intent.state === "playing") {
      this.#hudBuilder.buildInto({
        target: hudTarget,
        tensionMeter,
        fishCondition: intent.fishCondition,
        fightDebug,
        holdState: this.#getHoldState(),
      });
    }
  }

  #resolveLineFrame(intent, equipment, tensionMeter, screenPosition) {
    const lineConfig = this.#config.ui.line;
    const activeItem =
      (this.#equipmentRules.isSpinning(equipment)
        ? equipment.baits?.[0]
        : equipment.sinker) || {};
    const straightenThreshold = lineConfig.straightenTension || 50;
    const frame = this.#lineVisualState.update({
      state: intent.state,
      nowMs: this.#clock.now,
      castStartTime: intent.startTime,
      inputPulling: this.#getInputState().isPulling === true,
      hookDepth: this.#getCurrentHookDepth(),
      castDistanceRatio: this.#getCastDistanceRatio(),
      tensionRatio:
        (tensionMeter?.getTension?.() || 0) / straightenThreshold,
      sinkRate: this.#baitRules.getSinkRate(activeItem, 1),
      lineConfig,
    });
    let ratio = frame.lengthRatio;
    let drop = frame.dropOffset;
    const mapBottomY = this.#projector.virtualToScreen(
      0,
      intent.bottom,
      this.#screenB,
    ).y;
    const rodBaseY =
      this.#canvasMetrics.height - (this.#config.ui?.rod?.yOffset || 0);
    const rodTopY = rodBaseY - 200;
    const distanceY = screenPosition.y - rodTopY;
    if (distanceY < 0) {
      ratio = Math.max(ratio, (mapBottomY - rodTopY) / distanceY);
    }
    const targetY = rodTopY + distanceY * ratio;
    frame.renderRatio = ratio;
    frame.renderDrop = Math.min(
      drop,
      Math.max(0, mapBottomY - targetY),
    );
    return frame;
  }

}
