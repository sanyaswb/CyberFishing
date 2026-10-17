// Animate one bottom sheet's height between its content and the persistent compact footer.
export class SheetHeightController {
  #window;
  #surface;
  #duration;
  #records = new Map();
  #active = null;
  #frame = null;
  #observer;
  #unsubscribe;
  #disposed = false;
  #motionPreference;

  constructor({ windowTarget, uiSurface, durationMs }) {
    this.#window = windowTarget; this.#surface = uiSurface; this.#duration = durationMs;
    this.#motionPreference = windowTarget.matchMedia?.("(prefers-reduced-motion: reduce)");
    this.#unsubscribe = uiSurface?.subscribe(() => this.#requestMeasure());
    if (windowTarget.ResizeObserver) {
      this.#observer = new windowTarget.ResizeObserver(entries => {
        if (entries.some(entry => entry.target === this.#active?.content)) this.#requestMeasure();
      });
    }
  }

  attach(panel, content) {
    this.#records.set(panel, { panel, content, fullHeight: 0, height: null, dragging: false, closing: false, timer: null });
    this.#observer?.observe(content);
  }

  open(panel) {
    const record = this.#records.get(panel);
    this.#cancelFrame();
    this.#active = record; record.closing = false;
    this.#setDragging(record, false);
    this.#write(record, "auto");
    record.fullHeight = this.#naturalHeight(record);
    record.compactHeight = this.#compactHeight(record);
    if (this.#motionPreference?.matches) { this.#write(record, record.fullHeight); return; }
    this.#setDragging(record, true);
    this.#write(record, record.compactHeight);
    this.#schedule(() => {
      this.#setDragging(record, false);
      this.#write(record, record.fullHeight);
    });
  }

  startDrag(panel) {
    const record = this.#records.get(panel);
    if (!record || record.closing) return;
    this.#cancelFrame();
    const physicalHeight = panel.getBoundingClientRect().height;
    record.dragBaseHeight = this.#surface?.physicalToLogicalDelta({ y: physicalHeight }).y ?? physicalHeight;
    this.#setDragging(record, true);
    this.#write(record, record.dragBaseHeight);
  }

  drag(panel, distance) {
    const record = this.#records.get(panel);
    if (!record?.dragging || record.closing) return;
    this.#write(record, Math.max(record.compactHeight, record.dragBaseHeight - distance));
  }

  settle(panel) {
    const record = this.#records.get(panel);
    if (!record?.dragging || record.closing) return;
    this.#setDragging(record, false);
    this.#write(record, record.fullHeight);
  }

  close(panel, onComplete) {
    const record = this.#records.get(panel);
    this.startDrag(panel);
    record.closing = true;
    this.#schedule(() => {
      this.#setDragging(record, false);
      this.#write(record, record.compactHeight);
      record.timer = this.#window.setTimeout(() => {
        record.timer = null; record.closing = false;
        if (this.#active === record) this.#active = null;
        onComplete();
      }, this.#duration);
    });
    return () => {
      if (this.#active === record) this.#cancelFrame();
      if (record.timer !== null) this.#window.clearTimeout(record.timer);
      record.timer = null; record.closing = false;
    };
  }

  detach(panel) {
    const record = this.#records.get(panel);
    if (!record) return;
    this.#observer?.unobserve?.(record.content);
    this.hide(panel);
    this.#records.delete(panel);
  }

  hide(panel) {
    const record = this.#records.get(panel);
    if (!record) return;
    if (record.timer !== null) this.#window.clearTimeout(record.timer);
    record.timer = null; record.closing = false;
    this.#setDragging(record, false);
    if (this.#active === record) { this.#cancelFrame(); this.#active = null; }
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const panel of this.#records.keys()) this.detach(panel);
    this.#observer?.disconnect(); this.#unsubscribe?.();
  }

  #requestMeasure() {
    const record = this.#active;
    if (!record || record.panel.hidden || record.dragging || record.closing || this.#frame !== null) return;
    this.#schedule(() => {
      record.fullHeight = this.#naturalHeight(record); record.compactHeight = this.#compactHeight(record);
      this.#write(record, record.fullHeight);
    });
  }

  #naturalHeight(record) {
    const style = this.#window.getComputedStyle(record.panel);
    const height = record.content.scrollHeight + (Number.parseFloat(style.borderTopWidth) || 0);
    return Math.min(height, Number.parseFloat(style.maxHeight) || Infinity);
  }

  #compactHeight(record) {
    const style = this.#window.getComputedStyle(record.panel);
    const pixels = name => Number.parseFloat(style.getPropertyValue(name)) || 0;
    return Math.min(record.fullHeight, pixels("--ui-sheet-handle-size") + pixels("--house-dock-collapsed-height") +
      pixels("--ui-safe-area-bottom") + (Number.parseFloat(style.borderTopWidth) || 0));
  }

  #write(record, height) {
    if (record.height === height) return;
    record.height = height;
    record.panel.style.setProperty("--house-sheet-height", height === "auto" ? height : `${height}px`);
  }

  #setDragging(record, dragging) {
    if (record.dragging === dragging) return;
    record.dragging = dragging; record.panel.classList.toggle("house__sheet--dragging", dragging);
  }

  #schedule(callback) {
    this.#frame = this.#window.requestAnimationFrame(() => { this.#frame = null; callback(); });
  }

  #cancelFrame() {
    if (this.#frame !== null) this.#window.cancelAnimationFrame(this.#frame);
    this.#frame = null;
  }
}
