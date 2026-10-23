// Shows one block of a whole production layout (spec 140 R2-D3). The stage keeps the surface size the resizer sets;
// the window takes the rectangle of the first visible block that matches the selector and the stage is shifted so
// only that block shows. Without a visible block the window shows the whole stage. Values are written only when they
// change; measurements are coalesced into one per frame.
export class UiCatalogBlockCrop {
  #frame;
  #stage;
  #selector;
  #window;
  #observer = null;
  #observedBlock = null;
  #scheduled = null;
  #crop = { x: NaN, y: NaN, width: NaN, height: NaN };
  #disposed = false;

  constructor({ frame, stage, selector, windowTarget }) {
    this.#frame = frame;
    this.#stage = stage;
    this.#selector = selector;
    this.#window = windowTarget;
    frame.classList.add("ui-catalog-card__frame--cropped");
    if (typeof windowTarget.ResizeObserver === "function") {
      this.#observer = new windowTarget.ResizeObserver(() => this.request());
      this.#observer.observe(stage);
    }
  }

  // The crop for the current layout, measured on the next frame.
  request() {
    if (this.#disposed || this.#scheduled !== null) return;
    this.#scheduled = this.#window.requestAnimationFrame(() => {
      this.#scheduled = null;
      this.update();
    });
  }

  update() {
    if (this.#disposed) return;
    const stageRect = this.#stage.getBoundingClientRect();
    const block = this.#visibleBlock();
    if (block !== this.#observedBlock && this.#observer) {
      if (this.#observedBlock) this.#observer.unobserve(this.#observedBlock);
      if (block) this.#observer.observe(block);
    }
    this.#observedBlock = block;
    const rect = block ? block.getBoundingClientRect() : stageRect;
    this.#write("x", Math.round(rect.left - stageRect.left), "--ui-catalog-crop-x");
    this.#write("y", Math.round(rect.top - stageRect.top), "--ui-catalog-crop-y");
    this.#write("width", Math.round(rect.width), "--ui-catalog-crop-width");
    this.#write("height", Math.round(rect.height), "--ui-catalog-crop-height");
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    if (this.#scheduled !== null) this.#window.cancelAnimationFrame(this.#scheduled);
    this.#scheduled = null;
    this.#observer?.disconnect();
    this.#observer = null;
    this.#observedBlock = null;
  }

  #visibleBlock() {
    for (const node of this.#stage.querySelectorAll(this.#selector)) {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return node;
    }
    return null;
  }

  #write(key, value, property) {
    if (this.#crop[key] === value) return;
    this.#crop[key] = value;
    this.#frame.style.setProperty(property, `${value}px`);
  }
}
