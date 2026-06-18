class GameRenderFrameBuilder {
  #canvasMetrics;
  #projector;
  #worldBuilder;
  #castingBuilder;
  #fishingBuilder;
  #outcomeBuilder;
  #worldContext = {
    target: null,
    invalidCastMarker: null,
    debugEnabled: false,
  };
  #castingContext = {
    target: null,
    intent: null,
    clipRegions: null,
  };
  #fishingContext = {
    fishingTarget: null,
    hudTarget: null,
    intent: null,
    clipRegions: null,
  };
  #outcomeContext = {
    target: null,
    intent: null,
  };

  constructor({
    canvasMetrics,
    projector,
    worldBuilder,
    castingBuilder,
    fishingBuilder,
    outcomeBuilder,
  }) {
    const builders = {
      worldBuilder,
      castingBuilder,
      fishingBuilder,
      outcomeBuilder,
    };
    for (const [name, builder] of Object.entries(builders)) {
      if (!builder || typeof builder.buildInto !== "function") {
        throw new TypeError(`GameRenderFrameBuilder requires ${name}`);
      }
    }
    this.#canvasMetrics = canvasMetrics;
    this.#projector = projector;
    this.#worldBuilder = worldBuilder;
    this.#castingBuilder = castingBuilder;
    this.#fishingBuilder = fishingBuilder;
    this.#outcomeBuilder = outcomeBuilder;
  }

  buildInto({
    frame,
    intent,
    invalidCastMarker,
    debugEnabled,
  }) {
    frame.stateName = intent.stateName;
    frame.viewport.width = this.#canvasMetrics.width;
    frame.viewport.height = this.#canvasMetrics.height;
    frame.viewport.scale = this.#projector.getScale();
    const worldContext = this.#worldContext;
    worldContext.target = frame.world;
    worldContext.invalidCastMarker = invalidCastMarker;
    worldContext.debugEnabled = debugEnabled;
    this.#worldBuilder.buildInto(worldContext);

    const castingContext = this.#castingContext;
    castingContext.target = frame.casting;
    castingContext.intent = intent;
    castingContext.clipRegions = frame.world.clipRegions;
    this.#castingBuilder.buildInto(castingContext);

    const fishingContext = this.#fishingContext;
    fishingContext.fishingTarget = frame.fishing;
    fishingContext.hudTarget = frame.hud;
    fishingContext.intent = intent.fishing;
    fishingContext.clipRegions = frame.world.clipRegions;
    this.#fishingBuilder.buildInto(fishingContext);

    const outcomeContext = this.#outcomeContext;
    outcomeContext.target = frame.outcome;
    outcomeContext.intent = intent.outcome;
    this.#outcomeBuilder.buildInto(outcomeContext);
    return frame;
  }
}
