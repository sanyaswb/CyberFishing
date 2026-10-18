import { FRAME_SECTIONS } from "../../../engine/diagnostics/inactive_frame_probe.js";
import { GameRenderIntent } from "./game_render_intent.js";

export class GameRenderCoordinator {
  #stateMachine;
  #frameBuffer;
  #frameBuilder;
  #pipeline;
  #sceneLayer;
  #sceneRouter;
  #probe;
  #getBounds;
  #getInvalidCastMarker;
  #isDebugEnabled;
  #invalidateStyles;
  #beginFrame;
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
    sceneLayer,
    sceneRouter,
    probe,
    getBounds,
    getInvalidCastMarker,
    isDebugEnabled,
    invalidateStyles,
    beginFrame,
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
    // sceneLayer: the WebGL scene under the 2D canvas (spec 103), inactive in "canvas" mode; sceneRouter: which layer
    // draws each world kind, decided once per frame (spec 104); probe: frame timing (spec 101).
    if (typeof sceneLayer?.render !== "function") {
      throw new TypeError("GameRenderCoordinator requires sceneLayer");
    }
    if (typeof sceneRouter?.update !== "function" || typeof sceneRouter.rendersScene !== "function") {
      throw new TypeError("GameRenderCoordinator requires sceneRouter");
    }
    if (typeof probe?.begin !== "function" || typeof probe.end !== "function") {
      throw new TypeError("GameRenderCoordinator requires a frame probe");
    }
    // beginFrame: the surface's frame start (spec 100: base transform and smoothing before any pass draws).
    const ports = { getBounds, getInvalidCastMarker, isDebugEnabled, beginFrame };
    for (const [name, port] of Object.entries(ports)) {
      if (typeof port !== "function") {
        throw new TypeError(`GameRenderCoordinator requires ${name}`);
      }
    }
    this.#stateMachine = stateMachine;
    this.#frameBuffer = frameBuffer;
    this.#frameBuilder = frameBuilder;
    this.#pipeline = pipeline;
    this.#sceneLayer = sceneLayer;
    this.#sceneRouter = sceneRouter;
    this.#probe = probe;
    this.#getBounds = getBounds;
    this.#getInvalidCastMarker = getInvalidCastMarker;
    this.#isDebugEnabled = isDebugEnabled;
    this.#invalidateStyles =
      typeof invalidateStyles === "function" ? invalidateStyles : () => {};
    this.#beginFrame = beginFrame;
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
    // Both layers follow one routing decision per frame. The scene is under every 2D pass, so it draws first
    // (docs/rendering.md rule 14).
    this.#sceneRouter.update();
    if (this.#sceneRouter.rendersScene()) {
      this.#probe.begin(FRAME_SECTIONS.scene);
      this.#sceneLayer.render(frame);
      this.#probe.end(FRAME_SECTIONS.scene);
    }
    this.#beginFrame();
    this.#pipeline.render(frame);
    return frame;
  }

  invalidateStyles() {
    this.#invalidateStyles();
  }
}
