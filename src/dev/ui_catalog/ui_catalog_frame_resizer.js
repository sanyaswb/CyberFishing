// Drag handles on a preview frame's right edge, bottom edge and corner (spec 140 D3). The frame is the surface host,
// so the components follow their own layout logic; a focused handle takes arrow keys, a double click restores the
// default size. A size is written only when it changes.
const MIN_WIDTH = 120;
const MIN_HEIGHT = 48;
const MAX_HEIGHT = 1600;
const KEY_STEP = 10;
const AXES = Object.freeze([["x", "resizeWidth", "vertical"], ["y", "resizeHeight", "horizontal"], ["xy", "resizeBoth", null]]);

export class UiCatalogFrameResizer {
  #frame;
  #defaultSize;
  #getMaxWidth;
  #onChange;
  #width = 0;
  #height = 0;
  #drag = null;
  #handles = [];
  #removals = [];

  // size: the default { width, height }; getMaxWidth: () => the page's width for the frame (0 = unbounded);
  // onChange({ width, height }) after every written change.
  constructor({ documentRef, frame, size, labels, getMaxWidth = () => 0, onChange = () => {} }) {
    this.#frame = frame;
    this.#defaultSize = { width: size.width, height: size.height };
    this.#getMaxWidth = getMaxWidth;
    this.#onChange = onChange;
    for (const [axis, label, orientation] of AXES) {
      const handle = documentRef.createElement("span");
      handle.className = `ui-catalog-card__handle ui-catalog-card__handle--${axis}`;
      handle.tabIndex = 0;
      handle.setAttribute("role", "separator");
      handle.setAttribute("aria-label", labels[label]);
      if (orientation) handle.setAttribute("aria-orientation", orientation);
      this.#listen(handle, "pointerdown", (event) => this.#start(event, axis, handle));
      this.#listen(handle, "pointermove", (event) => this.#move(event));
      this.#listen(handle, "pointerup", (event) => this.#end(event, handle));
      this.#listen(handle, "pointercancel", (event) => this.#end(event, handle));
      this.#listen(handle, "dblclick", () => this.reset());
      this.#listen(handle, "keydown", (event) => this.#key(event, axis));
      frame.append(handle);
      this.#handles.push(handle);
    }
    this.resize(size.width, size.height);
  }

  get size() {
    return { width: this.#width, height: this.#height };
  }

  // Clamped to the bounds; returns whether the size changed.
  resize(width, height) {
    const maxWidth = Number(this.#getMaxWidth()) || 0;
    const nextWidth = Math.round(Math.max(MIN_WIDTH, maxWidth > 0 ? Math.min(maxWidth, width) : width));
    const nextHeight = Math.round(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, height)));
    if (nextWidth === this.#width && nextHeight === this.#height) return false;
    if (nextWidth !== this.#width) this.#frame.style.setProperty("--ui-catalog-frame-width", `${nextWidth}px`);
    if (nextHeight !== this.#height) this.#frame.style.setProperty("--ui-catalog-frame-height", `${nextHeight}px`);
    this.#width = nextWidth;
    this.#height = nextHeight;
    this.#onChange(this.size);
    return true;
  }

  reset() {
    return this.resize(this.#defaultSize.width, this.#defaultSize.height);
  }

  dispose() {
    for (const remove of this.#removals) remove();
    this.#removals = [];
    for (const handle of this.#handles) handle.remove();
    this.#handles = [];
    this.#drag = null;
  }

  #listen(node, type, listener) {
    node.addEventListener(type, listener);
    this.#removals.push(() => node.removeEventListener(type, listener));
  }

  #start(event, axis, handle) {
    if (event.button !== 0) return;
    event.preventDefault();
    handle.setPointerCapture?.(event.pointerId);
    this.#drag = { axis, pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      width: this.#width, height: this.#height };
  }

  #move(event) {
    const drag = this.#drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    this.resize(drag.axis === "y" ? this.#width : drag.width + event.clientX - drag.x,
      drag.axis === "x" ? this.#height : drag.height + event.clientY - drag.y);
  }

  #end(event, handle) {
    if (!this.#drag || event.pointerId !== this.#drag.pointerId) return;
    handle.releasePointerCapture?.(event.pointerId);
    this.#drag = null;
  }

  #key(event, axis) {
    const dx = axis === "y" ? 0 : event.key === "ArrowRight" ? KEY_STEP : event.key === "ArrowLeft" ? -KEY_STEP : 0;
    const dy = axis === "x" ? 0 : event.key === "ArrowDown" ? KEY_STEP : event.key === "ArrowUp" ? -KEY_STEP : 0;
    if (dx === 0 && dy === 0) return;
    event.preventDefault();
    this.resize(this.#width + dx, this.#height + dy);
  }
}
