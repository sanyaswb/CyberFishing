import { FRAME_SECTIONS } from "../../../engine/diagnostics/inactive_frame_probe.js";

export class GameLoop {
  #clock;
  #onUpdate;
  #onDraw;
  #activeLoopGuard;
  #probe;
  #isRunning = false;
  #rafId = 0;

  // probe: the frame timing port (spec 101), composed in bootstrap (InactiveFrameProbe in production).
  constructor(clock, onUpdate, onDraw, activeLoopGuard, probe) {
    if (typeof probe?.beginFrame !== "function") throw new TypeError("GameLoop requires a frame probe");
    this.#clock = clock;
    this.#onUpdate = onUpdate;
    this.#onDraw = onDraw;
    this.#activeLoopGuard = activeLoopGuard;
    this.#probe = probe;
  }

  start() {
    if (this.#isRunning) return true;
    if (!this.#activeLoopGuard.acquire(this)) return false;

    this.#isRunning = true;
    this.#clock.reset();

    const probe = this.#probe;
    const loop = (frameTime) => {
      if (!this.#isRunning) return;
      probe.beginFrame(frameTime);
      const dt = this.#clock.tick(frameTime);
      probe.begin(FRAME_SECTIONS.update);
      this.#onUpdate(dt);
      probe.end(FRAME_SECTIONS.update);
      probe.begin(FRAME_SECTIONS.draw);
      this.#onDraw();
      probe.end(FRAME_SECTIONS.draw);
      probe.endFrame();
      this.#rafId = requestAnimationFrame(loop);
    };

    this.#rafId = requestAnimationFrame(loop);
    return true;
  }

  stop() {
    if (!this.#isRunning) return;
    this.#isRunning = false;
    if (this.#rafId) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = 0;
    }
    this.#activeLoopGuard.release(this);
  }

  get isRunning() {
    return this.#isRunning;
  }
}
