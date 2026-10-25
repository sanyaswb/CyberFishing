// Calls back when the page is hidden (tab switched, app backgrounded) or closed: the moment to write pending state
// before the browser may discard the page (spec 143: battery consumption).
export class BrowserPageHideListener {
  #documentRef;
  #windowRef;
  #onVisibility;
  #onPageHide;

  constructor({ documentRef, windowRef, onHide }) {
    if (typeof onHide !== "function") throw new TypeError("BrowserPageHideListener requires onHide");
    this.#documentRef = documentRef;
    this.#windowRef = windowRef;
    this.#onVisibility = () => {
      if (this.#documentRef.visibilityState === "hidden") onHide();
    };
    this.#onPageHide = () => onHide();
    this.#documentRef.addEventListener("visibilitychange", this.#onVisibility);
    this.#windowRef.addEventListener("pagehide", this.#onPageHide);
  }

  dispose() {
    this.#documentRef?.removeEventListener("visibilitychange", this.#onVisibility);
    this.#windowRef?.removeEventListener("pagehide", this.#onPageHide);
    this.#documentRef = null;
    this.#windowRef = null;
  }
}
