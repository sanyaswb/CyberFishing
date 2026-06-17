class WorldRenderPass extends RenderPass {
  #scene;
  #debug;
  #boatChum;

  constructor({ sceneRenderer, debugRenderer, boatChumRenderer }) {
    super();
    this.#scene = WorldRenderPass.#requireRenderer(
      sceneRenderer,
      "sceneRenderer",
    );
    this.#debug = WorldRenderPass.#requireRenderer(
      debugRenderer,
      "debugRenderer",
    );
    this.#boatChum = WorldRenderPass.#requireRenderer(
      boatChumRenderer,
      "boatChumRenderer",
    );
  }

  render(frame) {
    if (!frame.world.visible) return;
    this.#scene.render(frame.world);
    this.#debug.render(frame.world);
    this.#boatChum.render(frame.world);
    this.#scene.renderInvalidCastMarker(frame.world.invalidCastMarker);
  }

  static #requireRenderer(renderer, name) {
    if (!renderer || typeof renderer.render !== "function") {
      throw new TypeError(`WorldRenderPass requires ${name}`);
    }
    return renderer;
  }
}
