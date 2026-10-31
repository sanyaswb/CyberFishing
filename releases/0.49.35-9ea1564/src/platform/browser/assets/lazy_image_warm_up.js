// Spec 157 R6 (prefetch after the barrier): UI images are lazy, so the closed inventory and hidden toolbar buttons
// request nothing before the game is ready. Once it is, warm() loads every lazy image of the page that has not loaded
// yet, one at a time, into the browser cache; opening the inventory then shows them without a network wait. A failed
// image is skipped (its view keeps its own fallback); dispose() stops the queue.
export class LazyImageWarmUp {
  #documentRef;
  #disposed = false;

  constructor({ documentRef }) {
    if (typeof documentRef?.querySelectorAll !== "function" || typeof documentRef.createElement !== "function") {
      throw new TypeError("LazyImageWarmUp requires documentRef");
    }
    this.#documentRef = documentRef;
  }

  // Resolves with the sources it loaded, in page order.
  async warm() {
    const sources = [...new Set([...this.#documentRef.querySelectorAll('img[loading="lazy"]')]
      .filter((image) => !image.complete).map((image) => image.src).filter(Boolean))];
    const loaded = [];
    for (const source of sources) {
      if (this.#disposed) break;
      if (await this.#load(source)) loaded.push(source);
    }
    return loaded;
  }

  dispose() {
    this.#disposed = true;
  }

  #load(source) {
    return new Promise((resolve) => {
      const image = this.#documentRef.createElement("img");
      image.decoding = "async";
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      image.src = source;
    });
  }
}
