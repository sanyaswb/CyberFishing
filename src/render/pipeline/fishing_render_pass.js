class FishingRenderPass extends RenderPass {
  #renderer;

  constructor({ renderer }) {
    super();
    if (!renderer || typeof renderer.render !== "function") {
      throw new TypeError("FishingRenderPass requires renderer");
    }
    this.#renderer = renderer;
  }

  render(frame) {
    if (!frame.fishing.visible) return;
    this.#renderer.render(frame.fishing);
  }
}
