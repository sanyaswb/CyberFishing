import { GameRenderFrame } from "./game_render_frame.js";

export class RenderFrameBuffer {
  #frame;

  constructor({ diagnostics = null } = {}) {
    this.#frame = new GameRenderFrame(diagnostics);
  }

  acquire(frameNumber = this.#frame.frameNumber + 1, dt = 0, stateName = "") {
    return this.#frame.reset(frameNumber, dt, stateName);
  }

  get current() {
    return this.#frame;
  }
}
