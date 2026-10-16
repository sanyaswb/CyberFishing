// One browser DOM coordinate space; game Canvas and world input never use this adapter.
export class UiSurfaceAdapter {
  #host;
  #window;
  #viewport;
  #root;
  #frame;
  #probe;
  #observer;
  #listeners = new Set();
  #scheduled = null;
  #disposed = false;
  #footprintHeight = null;
  #desktopHoverQuery;
  #coarsePointerQuery;
  #metrics = Object.freeze({ physicalWidth: 0, physicalHeight: 0, logicalWidth: 320,
    logicalHeight: 0, scale: 1, originX: 0, originY: 0, valid: false, hoverEnabled: false,
    safeArea: Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 }) });
  #onResize = () => this.requestMeasure();

  constructor({ hostElement, documentRef, windowRef, viewport = false } = {}) {
    if (!hostElement?.appendChild || !documentRef?.createElement || !windowRef) {
      throw new TypeError("UiSurfaceAdapter requires hostElement, documentRef and windowRef");
    }
    this.#host = hostElement;
    this.#window = windowRef;
    this.#viewport = viewport;
    this.#desktopHoverQuery = windowRef.matchMedia?.("(min-width: 1025px) and (orientation: landscape) and (hover: hover) and (pointer: fine)");
    this.#coarsePointerQuery = windowRef.matchMedia?.("(any-pointer: coarse)");
    this.#desktopHoverQuery?.addEventListener?.("change", this.#onResize);
    this.#coarsePointerQuery?.addEventListener?.("change", this.#onResize);
    this.#frame = documentRef.createElement("div");
    this.#frame.className = viewport ? "ui-surface-frame ui-surface-frame--viewport" : "ui-surface-frame";
    this.#root = documentRef.createElement("div");
    this.#root.className = "ui-surface";
    this.mountRoot = documentRef.createElement("div");
    this.mountRoot.className = "ui-surface__content";
    this.portalRoot = documentRef.createElement("div");
    this.portalRoot.className = "ui-surface__portals";
    this.#probe = documentRef.createElement("div");
    this.#probe.className = "ui-surface-frame__safe-area";
    this.#probe.setAttribute("aria-hidden", "true");
    this.#root.appendChild(this.mountRoot);
    this.#root.appendChild(this.portalRoot);
    this.#frame.appendChild(this.#root);
    this.#frame.appendChild(this.#probe);
    hostElement.appendChild(this.#frame);
    if (typeof windowRef.ResizeObserver === "function") {
      this.#observer = new windowRef.ResizeObserver(this.#onResize);
      this.#observer.observe(this.#frame);
      // A viewport is sized by its frame, never by the UI it resizes.
      if (!viewport) this.#observer.observe(this.mountRoot);
    }
    windowRef.addEventListener?.("resize", this.#onResize);
    windowRef.visualViewport?.addEventListener?.("resize", this.#onResize);
    // Scrolling changes the physical origin of a preview and its portals.
    windowRef.addEventListener?.("scroll", this.#onResize, true);
    this.measure();
  }

  getMetrics() { return this.#metrics; }

  subscribe(listener) {
    if (this.#disposed || typeof listener !== "function") return () => {};
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  requestMeasure() {
    if (this.#disposed || this.#scheduled !== null) return;
    this.#scheduled = this.#window.requestAnimationFrame(() => {
      this.#scheduled = null;
      this.measure();
    });
  }

  measure() {
    if (this.#disposed) return this.#metrics;
    const rect = this.#frame.getBoundingClientRect();
    const physicalWidth = this.#viewport ? Number(rect.width) : Number(this.#host.clientWidth);
    const physicalHeight = this.#viewport ? Number(rect.height) : Number(this.#host.clientHeight);
    if (!(physicalWidth > 0) || !(physicalHeight > 0) || rect.width === 0 || rect.height === 0 || this.#frame.isConnected === false) {
      if (!this.#root.classList.contains("ui-surface--unmeasured")) this.#root.classList.add("ui-surface--unmeasured");
      if (this.#metrics.valid) {
        this.#root.classList.remove("ui-surface--desktop-hover");
        this.#metrics = Object.freeze({ ...this.#metrics, valid: false, hoverEnabled: false });
        this.#notify();
      }
      return this.#metrics;
    }
    const scale = Math.min(1, physicalWidth / 320);
    const computed = this.#window.getComputedStyle?.(this.#probe);
    const inset = side => Math.max(0, Number.parseFloat(computed?.["padding" + side]) || 0) / scale;
    const next = { physicalWidth, physicalHeight, logicalWidth: Math.max(320, physicalWidth),
      logicalHeight: physicalHeight / scale, scale, originX: Number(rect.left) || 0,
      originY: Number(rect.top) || 0, valid: true,
      hoverEnabled: physicalWidth > 1024 && this.#desktopHoverQuery?.matches === true &&
        this.#coarsePointerQuery?.matches === false && Number(this.#window.navigator?.maxTouchPoints) === 0,
      safeArea: Object.freeze({ top: inset("Top"), right: inset("Right"), bottom: inset("Bottom"), left: inset("Left") }) };
    const previous = this.#metrics;
    if (next.hoverEnabled !== previous.hoverEnabled) this.#root.classList.toggle("ui-surface--desktop-hover", next.hoverEnabled);
    if (this.#root.classList.contains("ui-surface--unmeasured")) this.#root.classList.remove("ui-surface--unmeasured");
    const scaled = scale < 1 || !this.#viewport;
    if (this.#root.classList.contains("ui-surface--scaled") !== scaled) this.#root.classList.toggle("ui-surface--scaled", scaled);
    if (!previous.valid || scale !== previous.scale) this.#root.style.setProperty("--ui-scale", String(scale));
    if (!previous.valid || next.logicalWidth !== previous.logicalWidth) this.#root.style.setProperty("--ui-logical-width", `${next.logicalWidth}px`);
    if (!previous.valid || next.logicalHeight !== previous.logicalHeight) this.#root.style.setProperty("--ui-logical-height", `${next.logicalHeight}px`);
    for (const side of ["top", "right", "bottom", "left"]) {
      if (!previous.valid || next.safeArea[side] !== previous.safeArea[side]) {
        this.#root.style.setProperty(`--ui-safe-area-${side}`, `${next.safeArea[side]}px`);
      }
    }
    if (!this.#viewport) {
      const logicalContentHeight = Math.max(next.logicalHeight, Number(this.mountRoot.scrollHeight) || 0);
      const footprintHeight = logicalContentHeight * scale;
      if (footprintHeight !== this.#footprintHeight) {
        this.#frame.style.setProperty("--ui-physical-height", `${footprintHeight}px`);
        this.#footprintHeight = footprintHeight;
      }
    }
    const changed = Object.keys(next).some(key => key !== "safeArea" && next[key] !== previous[key]) ||
      Object.keys(next.safeArea).some(side => next.safeArea[side] !== previous.safeArea[side]);
    if (changed) {
      this.#metrics = Object.freeze(next);
      this.#notify();
    }
    return this.#metrics;
  }

  physicalToLogicalPoint({ x, y }) {
    const metrics = this.#metrics;
    return { x: (x - metrics.originX) / metrics.scale, y: (y - metrics.originY) / metrics.scale };
  }

  logicalToPhysicalPoint({ x, y }) {
    const metrics = this.#metrics;
    return { x: x * metrics.scale + metrics.originX, y: y * metrics.scale + metrics.originY };
  }

  physicalToLogicalDelta({ x = 0, y = 0 }) { return { x: x / this.#metrics.scale, y: y / this.#metrics.scale }; }
  logicalToPhysicalDelta({ x = 0, y = 0 }) { return { x: x * this.#metrics.scale, y: y * this.#metrics.scale }; }

  physicalToLogicalRect(rect) {
    const point = this.physicalToLogicalPoint({ x: rect.left, y: rect.top });
    const size = this.physicalToLogicalDelta({ x: rect.width, y: rect.height });
    return { left: point.x, top: point.y, width: size.x, height: size.y,
      right: point.x + size.x, bottom: point.y + size.y };
  }

  logicalToPhysicalRect(rect) {
    const point = this.logicalToPhysicalPoint({ x: rect.left, y: rect.top });
    const size = this.logicalToPhysicalDelta({ x: rect.width, y: rect.height });
    return { left: point.x, top: point.y, width: size.x, height: size.y,
      right: point.x + size.x, bottom: point.y + size.y };
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    if (this.#scheduled !== null) this.#window.cancelAnimationFrame(this.#scheduled);
    this.#scheduled = null;
    this.#observer?.disconnect();
    this.#desktopHoverQuery?.removeEventListener?.("change", this.#onResize);
    this.#coarsePointerQuery?.removeEventListener?.("change", this.#onResize);
    this.#window.removeEventListener?.("resize", this.#onResize);
    this.#window.visualViewport?.removeEventListener?.("resize", this.#onResize);
    this.#window.removeEventListener?.("scroll", this.#onResize, true);
    this.#listeners.clear();
    this.#frame.remove();
  }

  #notify() { for (const listener of this.#listeners) listener(this.#metrics); }
}
