import { STARTUP_MARK_PREFIX, STARTUP_STAGES, STARTUP_STAGE_ORDER } from "../../../engine/diagnostics/startup_stages.js";

// Startup marks of the page (spec 157 R9): one performance mark per stage on the browser's own timeline (from the
// start of navigation), so the DEV overlay and the measurer read the same numbers. Each stage is marked once; the
// "ready" stage also sets data-game-ready on the document element, the signal the measurer waits for. Production
// composes it: a mark costs a few microseconds and no frame work.
export class PerformanceStartupMarks {
  #performance;
  #rootElement;
  #marked = new Set();

  constructor({ performance, rootElement }) {
    if (typeof performance?.mark !== "function") throw new TypeError("PerformanceStartupMarks requires performance");
    if (typeof rootElement?.setAttribute !== "function") {
      throw new TypeError("PerformanceStartupMarks requires rootElement");
    }
    this.#performance = performance;
    this.#rootElement = rootElement;
  }

  mark(stage) {
    if (!STARTUP_STAGE_ORDER.includes(stage)) throw new RangeError(`Unknown startup stage ${stage}`);
    if (this.#marked.has(stage)) return;
    this.#marked.add(stage);
    this.#performance.mark(`${STARTUP_MARK_PREFIX}${stage}`);
  }

  markReady() {
    if (this.#marked.has(STARTUP_STAGES.ready)) return;
    this.mark(STARTUP_STAGES.ready);
    this.#rootElement.setAttribute("data-game-ready", "");
  }
}
