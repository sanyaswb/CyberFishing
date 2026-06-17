class CastingRenderPass extends RenderPass {
  #renderer;

  constructor({ renderer }) {
    super();
    if (!renderer || typeof renderer.render !== "function") {
      throw new TypeError("CastingRenderPass requires renderer");
    }
    this.#renderer = renderer;
  }

  render(frame) {
    if (!frame.casting.visible) return;
    this.#renderer.render(frame.casting);
  }
}
