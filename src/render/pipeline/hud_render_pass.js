class HudRenderPass extends RenderPass {
  #renderer;

  constructor({ renderer }) {
    super();
    if (!renderer || typeof renderer.render !== "function") {
      throw new TypeError("HudRenderPass requires renderer");
    }
    this.#renderer = renderer;
  }

  render(frame) {
    if (!frame.hud.visible) return;
    this.#renderer.render(frame.hud);
  }
}
