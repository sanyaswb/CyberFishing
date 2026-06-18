class WorldRenderPass extends RenderPass {
  #composite;

  constructor({ components }) {
    super();
    this.#composite = new CompositeRenderer({ components });
  }

  render(frame) {
    if (!frame.world.visible) return;
    this.#composite.render(frame);
  }
}
