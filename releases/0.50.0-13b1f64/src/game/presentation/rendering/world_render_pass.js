import { CompositeRenderer } from "../../../engine/rendering/composite_renderer.js";
import { RenderPass } from "../../../engine/rendering/render_pass.js";

export class WorldRenderPass extends RenderPass {
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
