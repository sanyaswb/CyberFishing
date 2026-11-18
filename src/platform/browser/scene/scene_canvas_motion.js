// Spec 179 stages J and L (TK-372 the emission's shake, TK-374 the vodka's sway; owner Q26: «мінімум затрат на
// продуктивність трішки збільшити нічого страшного»): the view moves by a CSS transform of the scene's canvas — the
// browser's compositor moves the drawn frame, the scene is not drawn again, the HUD (the 2D canvas and the DOM) stays.
// The canvas is enlarged around its centre just enough that an offset up to the margins never shows its edges.
// apply(x, y, marginX, marginY, width, height): logical px; writes the element's style only on a visible change
// (¼ px, 0.001 of scale); all zero — the transform and the compositor hint are removed.
const STEP_PX = 0.25;
const STEP_SCALE = 0.001;

export class SceneCanvasMotion {
  #element;
  #x = 0;
  #y = 0;
  #scale = 1;
  #moving = false;

  constructor({ element }) {
    if (!element?.style) throw new TypeError("SceneCanvasMotion requires an element");
    this.#element = element;
  }

  get status() {
    return { moving: this.#moving, x: this.#x, y: this.#y, scale: this.#scale };
  }

  apply(x, y, marginX, marginY, width, height) {
    const offsetX = Math.round(finite(x) / STEP_PX) * STEP_PX;
    const offsetY = Math.round(finite(y) / STEP_PX) * STEP_PX;
    const cover = Math.max(Math.abs(finite(marginX)) / Math.max(1, finite(width)),
      Math.abs(finite(marginY)) / Math.max(1, finite(height)));
    // (scale − 1) × size / 2 ≥ margin on each axis; rounded up, so the edges stay covered.
    const scale = 1 + Math.ceil((2 * cover) / STEP_SCALE) * STEP_SCALE;
    if (offsetX === 0 && offsetY === 0 && scale === 1) return this.reset();
    if (this.#moving && offsetX === this.#x && offsetY === this.#y && scale === this.#scale) return false;
    const style = this.#element.style;
    if (!this.#moving) style.willChange = "transform";
    style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0) scale(${scale})`;
    this.#moving = true;
    this.#x = offsetX;
    this.#y = offsetY;
    this.#scale = scale;
    return true;
  }

  reset() {
    if (!this.#moving) return false;
    this.#element.style.transform = "";
    this.#element.style.willChange = "";
    this.#moving = false;
    this.#x = 0;
    this.#y = 0;
    this.#scale = 1;
    return true;
  }
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
