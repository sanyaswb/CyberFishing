// Spine mode of the rod (spec 099, D1): the controller draws the skeleton into its offscreen GL surface, then the
// surface is copied into the 2D game canvas in the same frame at the rod's place in the draw order. The GL surface is
// in device pixels and the destination size is logical (spec 100 D3), so the copy is 1:1 under the base transform.
import { FRAME_GAUGES, FRAME_SECTIONS } from "../../../engine/diagnostics/inactive_frame_probe.js";

export class RodSpineRenderer {
  #surface;
  #controller;
  #probe;

  // probe: the frame timing port (spec 101): the GL draw plus the copy is one section, the GL surface size a gauge.
  constructor({ surface, controller, probe }) {
    if (typeof surface?.drawImage !== "function") throw new TypeError("RodSpineRenderer requires surface");
    if (typeof controller?.renderScene !== "function") throw new TypeError("RodSpineRenderer requires controller");
    if (typeof probe?.begin !== "function") throw new TypeError("RodSpineRenderer requires a frame probe");
    this.#surface = surface;
    this.#controller = controller;
    this.#probe = probe;
  }

  render(model) {
    if (!model.visible || model.rodMode !== "spine") return;
    const probe = this.#probe;
    probe.begin(FRAME_SECTIONS.rodSpine);
    if (this.#controller.renderScene()) {
      const canvas = this.#controller.glSurface.canvas;
      this.#surface.drawImage(canvas, model.rodDestX, model.rodDestY, model.rodDestWidth, model.rodDestHeight);
      probe.gauge(FRAME_GAUGES.glPixels, canvas.width * canvas.height);
    }
    probe.end(FRAME_SECTIONS.rodSpine);
  }
}
