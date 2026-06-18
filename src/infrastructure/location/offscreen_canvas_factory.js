class OffscreenCanvasFactory {
  createCanvas(width, height) {
    const canvas = this.#createElement();
    canvas.width = Math.max(1, Math.floor(Number(width) || 1));
    canvas.height = Math.max(1, Math.floor(Number(height) || 1));
    return canvas;
  }

  createSurface(width, height, contextAttributes = {}) {
    return new Canvas2DSurface(this.createCanvas(width, height), {
      contextAttributes,
    });
  }

  #createElement() {
    if (typeof OffscreenCanvas !== "undefined") {
      return new OffscreenCanvas(1, 1);
    }
    if (typeof document === "undefined") {
      throw new Error("OffscreenCanvasFactory requires a canvas-capable environment");
    }
    return document.createElement("canvas");
  }
}
