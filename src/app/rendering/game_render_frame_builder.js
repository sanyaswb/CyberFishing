class GameRenderFrameBuilder {
  #canvasMetrics;
  #projector;
  #worldBuilder;
  #castingBuilder;
  #fishingBuilder;
  #outcomeBuilder;

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
    this.#worldBuilder.buildInto({
      target: frame.world,
      invalidCastMarker,
      debugEnabled,
    });
    this.#castingBuilder.buildInto({
      target: frame.casting,
      intent,
      clipRegions: frame.world.clipRegions,
    });
    this.#fishingBuilder.buildInto({
      fishingTarget: frame.fishing,
      hudTarget: frame.hud,
      intent: intent.fishing,
      clipRegions: frame.world.clipRegions,
    });
    this.#outcomeBuilder.buildInto({
      target: frame.outcome,
      intent: intent.outcome,
    });
    return frame;
  }
}
