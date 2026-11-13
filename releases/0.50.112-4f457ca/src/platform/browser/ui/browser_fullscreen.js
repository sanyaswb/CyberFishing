// The browser's fullscreen mode for the whole page (spec 173 F1): one place that asks for it and leaves it, shared by
// the game's ⛶ button (FullscreenControl) and the DEV zone editor. A browser without the Fullscreen API (iPhone Safari)
// is "not supported": request and exit do nothing. Browsers grant a request only inside a user gesture (a click).
export class BrowserFullscreen {
  #document;

  // documentRef: the document whose root element goes fullscreen.
  constructor({ documentRef }) {
    if (!documentRef) throw new TypeError("BrowserFullscreen requires documentRef");
    this.#document = documentRef;
  }

  get supported() {
    return typeof this.#document.documentElement?.requestFullscreen === "function";
  }

  get active() {
    return Boolean(this.#document.fullscreenElement);
  }

  // Resolves true when it asked the browser; rejects when the browser refuses.
  async request() {
    if (!this.supported || this.active) return false;
    await this.#document.documentElement.requestFullscreen();
    return true;
  }

  // Resolves true when it left fullscreen.
  async exit() {
    if (!this.active || typeof this.#document.exitFullscreen !== "function") return false;
    await this.#document.exitFullscreen();
    return true;
  }
}
