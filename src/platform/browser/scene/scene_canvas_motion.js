// Spec 179 stages J and L (TK-372 the emission's shake, TK-374 the vodka's sway; owner Q26: «мінімум затрат на
// продуктивність трішки збільшити нічого страшного»): the view moves by a CSS transform of the scene's canvas — the
// browser's compositor moves the drawn frame, the scene is not drawn again, the HUD (the 2D canvas and the DOM) stays.
// The canvas is enlarged around its centre just enough that an offset up to the margins never shows its edges.
// TK-374.3 (owner: «CSS-вигин без фільтра»): the drunk waves warp the frame too — a skew (degrees per axis) and an
// uneven stretch (a share added to each axis's scale, never below the cover); the cover grows by what the skew shears in.
// apply(x, y, marginX, marginY, width, height, skewXDeg, skewYDeg, stretchX, stretchY): logical px, degrees, shares;
// writes the element's style only on a visible change (¼ px, 0.001 of scale, 0.01°); all zero — the transform and the
// compositor hint are removed.
const STEP_PX = 0.25;
const STEP_SCALE = 0.001;
const STEP_DEG = 0.01;
const RADIANS = Math.PI / 180;

export class SceneCanvasMotion {
  #element;
  #x = 0;
  #y = 0;
  #scaleX = 1;
  #scaleY = 1;
  #skewX = 0;
  #skewY = 0;
  #moving = false;

  constructor({ element }) {
    if (!element?.style) throw new TypeError("SceneCanvasMotion requires an element");
    this.#element = element;
  }

  get status() {
    return { moving: this.#moving, x: this.#x, y: this.#y, scaleX: this.#scaleX, scaleY: this.#scaleY,
      skewX: this.#skewX, skewY: this.#skewY };
  }

  apply(x, y, marginX, marginY, width, height, skewXDeg = 0, skewYDeg = 0, stretchX = 0, stretchY = 0) {
    const offsetX = Math.round(finite(x) / STEP_PX) * STEP_PX;
    const offsetY = Math.round(finite(y) / STEP_PX) * STEP_PX;
    const skewX = Math.round(finite(skewXDeg) / STEP_DEG) * STEP_DEG;
    const skewY = Math.round(finite(skewYDeg) / STEP_DEG) * STEP_DEG;
    const halfWidth = Math.max(1, finite(width)) / 2;
    const halfHeight = Math.max(1, finite(height)) / 2;
    // The skew shears an edge in by tan(angle) × the other half-size; the scale must still reach past the screen's edge
    // plus the offset's margin: scale × (half − shear) ≥ half + margin on each axis.
    const coverX = (halfWidth + Math.abs(finite(marginX))) /
      Math.max(1, halfWidth - Math.abs(Math.tan(skewX * RADIANS)) * halfHeight);
    const coverY = (halfHeight + Math.abs(finite(marginY))) /
      Math.max(1, halfHeight - Math.abs(Math.tan(skewY * RADIANS)) * halfWidth);
    const warped = skewX !== 0 || skewY !== 0 || finite(stretchX) > 0 || finite(stretchY) > 0;
    // Without the waves one uniform scale (the larger cover); with them each axis its own, the stretch on top.
    const uniform = Math.max(coverX, coverY);
    const scaleX = roundUp(warped ? coverX * (1 + Math.max(0, finite(stretchX))) : uniform);
    const scaleY = roundUp(warped ? coverY * (1 + Math.max(0, finite(stretchY))) : uniform);
    if (offsetX === 0 && offsetY === 0 && scaleX === 1 && scaleY === 1 && !warped) return this.reset();
    if (this.#moving && offsetX === this.#x && offsetY === this.#y && scaleX === this.#scaleX && scaleY === this.#scaleY &&
      skewX === this.#skewX && skewY === this.#skewY) return false;
    const style = this.#element.style;
    if (!this.#moving) style.willChange = "transform";
    style.transform = warped
      ? `translate3d(${offsetX}px, ${offsetY}px, 0) scale(${scaleX}, ${scaleY}) skew(${skewX}deg, ${skewY}deg)`
      : `translate3d(${offsetX}px, ${offsetY}px, 0) scale(${scaleX})`;
    this.#moving = true;
    this.#x = offsetX;
    this.#y = offsetY;
    this.#scaleX = scaleX;
    this.#scaleY = scaleY;
    this.#skewX = skewX;
    this.#skewY = skewY;
    return true;
  }

  reset() {
    if (!this.#moving) return false;
    this.#element.style.transform = "";
    this.#element.style.willChange = "";
    this.#moving = false;
    this.#x = 0;
    this.#y = 0;
    this.#scaleX = 1;
    this.#scaleY = 1;
    this.#skewX = 0;
    this.#skewY = 0;
    return true;
  }
}

// Rounded up to the scale's step, so the edges stay covered.
function roundUp(scale) {
  return 1 + Math.ceil((scale - 1) / STEP_SCALE - 1e-9) * STEP_SCALE;
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
