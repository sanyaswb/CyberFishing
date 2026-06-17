class GameRenderPipeline {
  #passes;

  constructor({ passes }) {
    if (!Array.isArray(passes) || passes.length === 0) {
      throw new TypeError("GameRenderPipeline requires render passes");
    }
    for (let index = 0; index < passes.length; index += 1) {
      if (!passes[index] || typeof passes[index].render !== "function") {
        throw new TypeError(
          `GameRenderPipeline pass ${index} must implement render(frame)`,
        );
      }
    }
    this.#passes = passes.slice();
  }

  render(frame) {
    for (let index = 0; index < this.#passes.length; index += 1) {
      this.#passes[index].render(frame);
    }
  }

  get passes() {
    return this.#passes;
  }
}
