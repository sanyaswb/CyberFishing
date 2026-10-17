// Spine mode of the rod (spec 099, D1): the controller draws the skeleton into its offscreen GL surface, then the
// surface is copied into the 2D game canvas in the same frame at the rod's place in the draw order.
export class RodSpineRenderer {
  #surface;
  #controller;

  constructor({ surface, controller }) {
    if (typeof surface?.drawImage !== "function") throw new TypeError("RodSpineRenderer requires surface");
    if (typeof controller?.renderScene !== "function") throw new TypeError("RodSpineRenderer requires controller");
    this.#surface = surface;
    this.#controller = controller;
  }

  render(model) {
    if (!model.visible || model.rodMode !== "spine") return;
    if (!this.#controller.renderScene()) return;
    this.#surface.drawImage(this.#controller.glSurface.canvas, model.rodDestX, model.rodDestY);
  }
}
