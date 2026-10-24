// Shows one element alone (spec 140 R3-D3). The stage lays the surface out at the chosen viewport size; the view takes
// the rectangle of the first visible node matching the focus selector, or else the union of the visible top-level
// nodes of the content root, and the stage is shifted so only that rectangle shows. Rectangles are read in page pixels
// and divided by the preview scale. Values are written only when they change; measurements run once per frame.
export class UiCatalogBlockCrop {
  #view;
  #stage;
  #contentRoot;
  #selector;
  #window;
  #getScale;
  #observer = null;
  #observed = new Set();
  #scheduled = null;
  #crop = { x: NaN, y: NaN, width: NaN, height: NaN };
  #disposed = false;

  constructor({ view, stage, contentRoot, selector = null, windowTarget, getScale = () => 1 }) {
    this.#view = view;
    this.#stage = stage;
    this.#contentRoot = contentRoot;
    this.#selector = selector;
    this.#window = windowTarget;
    this.#getScale = getScale;
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
    const scale = Number(this.#getScale()) > 0 ? Number(this.#getScale()) : 1;
    const stageRect = this.#stage.getBoundingClientRect();
    const nodes = this.#nodes();
    this.#observe(nodes);
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const rect of nodes.length ? nodes.map((node) => node.getBoundingClientRect()) : [stageRect]) {
      left = Math.min(left, rect.left);
      top = Math.min(top, rect.top);
      right = Math.max(right, rect.left + rect.width);
      bottom = Math.max(bottom, rect.top + rect.height);
    }
    this.#write("x", Math.round((left - stageRect.left) / scale), "--ui-catalog-crop-x");
    this.#write("y", Math.round((top - stageRect.top) / scale), "--ui-catalog-crop-y");
    this.#write("width", Math.round((right - left) / scale), "--ui-catalog-crop-width");
    this.#write("height", Math.round((bottom - top) / scale), "--ui-catalog-crop-height");
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    if (this.#scheduled !== null) this.#window.cancelAnimationFrame(this.#scheduled);
    this.#scheduled = null;
    this.#observer?.disconnect();
    this.#observer = null;
    this.#observed.clear();
  }

  #nodes() {
    const candidates = this.#selector ? this.#stage.querySelectorAll(this.#selector) : this.#contentRoot.children;
    const visible = [];
    for (const node of candidates) {
      const rect = node.getBoundingClientRect();
      if (!(rect.width > 0 && rect.height > 0)) continue;
      visible.push(node);
      if (this.#selector) break;
    }
    return visible;
  }

  #observe(nodes) {
    if (!this.#observer) return;
    for (const node of this.#observed) {
      if (!nodes.includes(node)) { this.#observer.unobserve(node); this.#observed.delete(node); }
    }
    for (const node of nodes) {
      if (!this.#observed.has(node)) { this.#observer.observe(node); this.#observed.add(node); }
    }
  }

  #write(key, value, property) {
    if (this.#crop[key] === value) return;
    this.#crop[key] = value;
    this.#view.style.setProperty(property, `${value}px`);
  }
}
