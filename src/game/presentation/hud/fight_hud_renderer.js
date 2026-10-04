import { CompositeRenderer } from "../../../engine/rendering/composite_renderer.js";

export class FightHudRenderer {
  #composite;

  constructor({ components }) {
    this.#composite = new CompositeRenderer({ components });
  }

  render(model) {
    if (!model.visible) return;
    this.#composite.render(model);
  }
}
