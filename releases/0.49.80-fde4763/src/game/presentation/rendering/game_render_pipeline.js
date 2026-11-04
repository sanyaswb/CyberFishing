import { GameRenderOrder } from "./game_render_order.js";

export class GameRenderPipeline {
  #passes;
  #passIds;
  #probe;

  // probe: the frame timing port (spec 101); each pass is one section named by its id.
  constructor({ passes, diagnostics = null, probe }) {
    if (!Array.isArray(passes) || passes.length === 0) {
      throw new TypeError("GameRenderPipeline requires render passes");
    }
    if (typeof probe?.begin !== "function" || typeof probe.end !== "function") {
      throw new TypeError("GameRenderPipeline requires a frame probe");
    }
    this.#probe = probe;
    const passIds = [];
    const seenIds = new Set();
    for (let index = 0; index < passes.length; index += 1) {
      const pass = passes[index];
      if (!pass || typeof pass.render !== "function") {
        throw new TypeError(
          `GameRenderPipeline pass ${index} must implement render(frame)`,
        );
      }
      const id = String(pass.id || pass.renderPassId || GameRenderOrder.sequence[index] || `pass:${index}`);
      if (seenIds.has(id)) {
        throw new Error(`Duplicate render pass id: ${id}`);
      }
      seenIds.add(id);
      passIds.push(id);
      diagnostics?.recordRenderPassCreated();
    }
    this.#passes = Object.freeze(passes.slice());
    this.#passIds = Object.freeze(passIds);
  }

  render(frame) {
    const probe = this.#probe;
    for (let index = 0; index < this.#passes.length; index += 1) {
      const id = this.#passIds[index];
      probe.begin(id);
      this.#passes[index].render(frame);
      probe.end(id);
    }
  }

  getPassCount() {
    return this.#passes.length;
  }

  getPassIdAt(index) {
    return index >= 0 && index < this.#passIds.length
      ? this.#passIds[index]
      : null;
  }

  copyPassIdsInto(target) {
    if (!Array.isArray(target)) {
      throw new TypeError("GameRenderPipeline copyPassIdsInto requires array");
    }
    target.length = 0;
    for (let index = 0; index < this.#passIds.length; index += 1) {
      target.push(this.#passIds[index]);
    }
    return target;
  }
}
