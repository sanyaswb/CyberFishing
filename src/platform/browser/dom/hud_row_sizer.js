export class HudRowSizer {
  #row;
  #window;
  #unsubscribe;
  #observer;
  #frame = null;
  #scale = null;
  #disposed = false;
  #schedule = () => {
    if (this.#disposed || this.#frame !== null) return;
    this.#frame = this.#window.requestAnimationFrame(() => {
      this.#frame = null;
      if (this.#disposed) return;
      const style = this.#window.getComputedStyle(this.#row);
      const pixels = name => Number.parseFloat(style.getPropertyValue(name)) || 0;
      const required = pixels("--ui-clock-width") + pixels("--house-play-width") +
        pixels("--ui-hud-control-size") + pixels("--house-leading-width") + 3 * pixels("--ui-toolbar-gap");
      const scale = required > 0 ? Math.min(1, Math.max(0, this.#row.clientWidth) / required) : 1;
      if (scale === this.#scale) return;
      this.#scale = scale;
      this.#row.style.setProperty("--ui-hud-scale", String(scale));
    });
  };

  constructor({ row, uiSurface, windowTarget }) {
    this.#row = row;
    this.#window = windowTarget;
    this.#unsubscribe = uiSurface.subscribe(this.#schedule);
    if (windowTarget.MutationObserver) {
      this.#observer = new windowTarget.MutationObserver(this.#schedule);
      this.#observer.observe(uiSurface.mountRoot.parentNode, { attributes: true, attributeFilter: ["class"] });
    }
    this.#schedule();
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    if (this.#frame !== null) this.#window.cancelAnimationFrame(this.#frame);
    this.#frame = null;
    this.#unsubscribe();
    this.#observer?.disconnect();
  }
}
