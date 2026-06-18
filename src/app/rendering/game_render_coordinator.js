class GameRenderCoordinator {
  #stateMachine;
  #frameBuffer;
  #frameBuilder;
  #pipeline;
  #getBounds;
  #getInvalidCastMarker;
  #isDebugEnabled;
  #invalidateStyles;
  #intent = new GameRenderIntent();
  #buildContext = {
    frame: null,
    intent: null,
    invalidCastMarker: null,
    debugEnabled: false,
  };
  #frameNumber = 0;

  constructor({
    stateMachine,
    frameBuffer,
    frameBuilder,
    pipeline,
    getBounds,
    getInvalidCastMarker,
    isDebugEnabled,
    invalidateStyles,
  }) {
    if (!stateMachine || typeof stateMachine.getRenderState !== "function") {
      throw new TypeError(
        "GameRenderCoordinator requires stateMachine",
      );
    }
    if (!frameBuffer || typeof frameBuffer.acquire !== "function") {
      throw new TypeError("GameRenderCoordinator requires frameBuffer");
    }
    if (!frameBuilder || typeof frameBuilder.buildInto !== "function") {
      throw new TypeError("GameRenderCoordinator requires frameBuilder");
    }
    if (!pipeline || typeof pipeline.render !== "function") {
      throw new TypeError("GameRenderCoordinator requires pipeline");
    }
    const ports = { getBounds, getInvalidCastMarker, isDebugEnabled };
    for (const [name, port] of Object.entries(ports)) {
      if (typeof port !== "function") {
        throw new TypeError(`GameRenderCoordinator requires ${name}`);
      }
    }
    this.#stateMachine = stateMachine;
    this.#frameBuffer = frameBuffer;
    this.#frameBuilder = frameBuilder;
    this.#pipeline = pipeline;
    this.#getBounds = getBounds;
    this.#getInvalidCastMarker = getInvalidCastMarker;
    this.#isDebugEnabled = isDebugEnabled;
    this.#invalidateStyles =
      typeof invalidateStyles === "function" ? invalidateStyles : () => {};
  }

  render(dt = 0) {
    const bounds = this.#getBounds();
    const intent = this.#intent.reset();
    this.#stateMachine.getRenderState(intent, bounds);
    const frame = this.#frameBuffer.acquire(
      ++this.#frameNumber,
      dt,
      intent.stateName,
    );
    const context = this.#buildContext;
    context.frame = frame;
    context.intent = intent;
    context.invalidCastMarker = this.#getInvalidCastMarker();
    context.debugEnabled = this.#isDebugEnabled();
    this.#frameBuilder.buildInto(context);
    this.#pipeline.render(frame);
    return frame;
  }

  invalidateStyles() {
    this.#invalidateStyles();
  }
}
