class GameRenderPipeline {
  #passes;
  #passIds;

  constructor({ passes }) {
    if (!Array.isArray(passes) || passes.length === 0) {
      throw new TypeError("GameRenderPipeline requires render passes");
    }
    const passIds = [];
    const seenIds = new Set();
    for (let index = 0; index < passes.length; index += 1) {
      const pass = passes[index];
      if (!pass || typeof pass.render !== "function") {
        throw new TypeError(
          `GameRenderPipeline pass ${index} must implement render(frame)`,
        );
      }
      const id = String(pass.id || pass.renderPassId || RenderOrder.sequence[index] || `pass:${index}`);
      if (seenIds.has(id)) {
        throw new Error(`Duplicate render pass id: ${id}`);
      }
      seenIds.add(id);
      passIds.push(id);
      if (typeof RenderAllocationDiagnostics !== "undefined") {
        RenderAllocationDiagnostics.recordRenderPassCreated();
      }
    }
    this.#passes = Object.freeze(passes.slice());
    this.#passIds = Object.freeze(passIds);
  }

  render(frame) {
    for (let index = 0; index < this.#passes.length; index += 1) {
      this.#passes[index].render(frame);
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
