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
  #fightAreaContext = {
    target: null,
    clipRegions: null,
    state: "",
    bottom: 0,
    fightDebug: null,
    equipment: null,
    floatVirtualPosition: null,
  };
  #rodLineContext = {
    target: null,
    floatPosition: null,
    state: "",
    tension: 0,
    lineFrame: null,
  };
  #floatContext = {
    target: null,
    screenPosition: null,
    floatEntity: null,
    equipment: null,
  };
  #hudContext = {
    target: null,
    tensionMeter: null,
    fishCondition: null,
    fightDebug: null,
    holdState: null,
    nowMs: 0,
  };
  #lineFrameContext = {
    state: "",
    nowMs: 0,
    castStartTime: 0,
    inputPulling: false,
    hookDepth: 0,
    castDistanceRatio: 0,
    tensionRatio: 0,
    sinkRate: 0,
    lineConfig: null,
  };

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
    const hasTensionMeter = !!tensionMeter;
    if (intent.state === "playing") {
      this.#assertTensionMeter(tensionMeter);
    } else if (hasTensionMeter) {
      this.#assertTensionMeter(tensionMeter);
    }
    const tension = hasTensionMeter ? tensionMeter.getTension() : 0;
    const fightDebug = hasTensionMeter ? tensionMeter.getDebugData() : null;
    const lineFrame = this.#resolveLineFrame(
      intent,
      equipment,
      tension,
      screenPosition,
    );

    fishingTarget.visible = true;
    const fightAreaContext = this.#fightAreaContext;
    fightAreaContext.target = fishingTarget.fightAreas;
    fightAreaContext.clipRegions = clipRegions;
    fightAreaContext.state = intent.state;
    fightAreaContext.bottom = intent.bottom;
    fightAreaContext.fightDebug = fightDebug;
    fightAreaContext.equipment = equipment;
    fightAreaContext.floatVirtualPosition = floatPosition;
    this.#fightAreaBuilder.buildInto(fightAreaContext);

    const rodLineContext = this.#rodLineContext;
    rodLineContext.target = fishingTarget.rodLine;
    rodLineContext.floatPosition = screenPosition;
    rodLineContext.state = intent.state;
    rodLineContext.tension = tension;
    rodLineContext.lineFrame = lineFrame;
    this.#equipmentModelBuilder.buildRodLine(rodLineContext);

    const floatContext = this.#floatContext;
    floatContext.target = fishingTarget.float;
    floatContext.screenPosition = screenPosition;
    floatContext.floatEntity = floatEntity;
    floatContext.equipment = equipment;
    this.#equipmentModelBuilder.buildFloat(floatContext);

    if (intent.state === "playing") {
      const hudContext = this.#hudContext;
      hudContext.target = hudTarget;
      hudContext.tensionMeter = tensionMeter;
      hudContext.fishCondition = intent.fishCondition;
      hudContext.fightDebug = fightDebug;
      hudContext.holdState = this.#getHoldState();
      hudContext.nowMs = this.#clock.now;
      this.#hudBuilder.buildInto(hudContext);
    }
  }

  #resolveLineFrame(intent, equipment, tension, screenPosition) {
    const lineConfig = this.#config.ui.line;
    const activeItem =
      (this.#equipmentRules.isSpinning(equipment)
        ? equipment.baits?.[0]
        : equipment.sinker) || {};
    const straightenThreshold = lineConfig.straightenTension || 50;
    const lineFrameContext = this.#lineFrameContext;
    lineFrameContext.state = intent.state;
    lineFrameContext.nowMs = this.#clock.now;
    lineFrameContext.castStartTime = intent.startTime;
    lineFrameContext.inputPulling = this.#getInputState().isPulling === true;
    lineFrameContext.hookDepth = this.#getCurrentHookDepth();
    lineFrameContext.castDistanceRatio = this.#getCastDistanceRatio();
    lineFrameContext.tensionRatio = tension / straightenThreshold;
    lineFrameContext.sinkRate = this.#baitRules.getSinkRate(activeItem, 1);
    lineFrameContext.lineConfig = lineConfig;
    const frame = this.#lineVisualState.update(lineFrameContext);
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

  #assertTensionMeter(tensionMeter) {
    const methods = ["getDebugData", "getTension"];
    for (let index = 0; index < methods.length; index += 1) {
      const method = methods[index];
      if (!tensionMeter || typeof tensionMeter[method] !== "function") {
        throw new TypeError(`FishingRenderFrameBuilder requires tensionMeter.${method}`);
      }
    }
  }

}
