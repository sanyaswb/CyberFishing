// The startup screen's progress (spec 157 D5, owner Q7): a bar and the loaded / total megabytes in compressed bytes.
// The release writes the start's compressed size into the screen (data-startup-bytes on .startup-loader, from the
// startup manifest); the meter sums what the page has transferred (the document and every resource entry, a cached file
// by its body size) until the game is ready (data-game-ready on <html>). Without the attribute (the repository's pages,
// no build) the screen keeps its spinner only. It runs from the release's first module, before the game's bundle.
const MEBIBYTE = 1048576;

export function formatMegabytes(bytes) {
  return (Math.max(0, bytes) / MEBIBYTE).toFixed(2).replace(".", ",");
}

export class StartupLoadMeter {
  #document;
  #performance;
  #createPerformanceObserver;
  #createMutationObserver;
  #labels;
  #loader = null;
  #bytes = null;
  #total = 0;
  #loaded = 0;
  #observers = [];

  // createPerformanceObserver(callback), createMutationObserver(callback): the browser's observers (checks fake them);
  // labels: { bytes(loaded, total) } with the megabytes already formatted (STARTUP_LABELS).
  constructor({ documentRef, performanceRef, createPerformanceObserver, createMutationObserver, labels }) {
    this.#labels = labels;
    this.#document = documentRef;
    this.#performance = performanceRef;
    this.#createPerformanceObserver = createPerformanceObserver;
    this.#createMutationObserver = createMutationObserver;
  }

  // Returns whether the screen shows progress (a release page with the start's size).
  start() {
    this.#loader = this.#document.querySelector(".startup-loader[data-startup-bytes]");
    this.#total = Number(this.#loader?.getAttribute("data-startup-bytes")) || 0;
    if (!this.#loader || this.#total <= 0 || this.#isReady()) return false;
    this.#bytes = this.#loader.querySelector(".startup-loader__bytes");
    const navigation = this.#performance.getEntriesByType?.("navigation")?.[0];
    this.#loaded = navigation ? StartupLoadMeter.#size(navigation) : 0;
    const resources = this.#createPerformanceObserver((list) => {
      for (const entry of list.getEntries()) this.#loaded += StartupLoadMeter.#size(entry);
      this.#render();
    });
    resources.observe({ type: "resource", buffered: true });
    const ready = this.#createMutationObserver(() => { if (this.#isReady()) this.stop(); });
    ready.observe(this.#document.documentElement, { attributes: true, attributeFilter: ["data-game-ready"] });
    this.#observers.push(resources, ready);
    this.#render();
    return true;
  }

  stop() {
    for (const observer of this.#observers) observer.disconnect();
    this.#observers.length = 0;
  }

  get loadedBytes() {
    return this.#loaded;
  }

  #render() {
    const share = Math.min(1, this.#loaded / this.#total);
    this.#loader.style.setProperty("--startup-progress", share.toFixed(4));
    if (this.#bytes) {
      this.#bytes.textContent = this.#labels.bytes(formatMegabytes(Math.min(this.#loaded, this.#total)),
        formatMegabytes(this.#total));
    }
  }

  #isReady() {
    return this.#document.documentElement.hasAttribute("data-game-ready");
  }

  // Transferred bytes (compressed, with headers); a cache hit transfers nothing, so it counts by its compressed body.
  static #size(entry) {
    const transferred = Number(entry.transferSize) || 0;
    return transferred > 0 ? transferred : Math.max(0, Number(entry.encodedBodySize) || 0);
  }
}

// The meter over the page's document and the browser's observers.
export function startBrowserStartupLoadMeter(labels) {
  return new StartupLoadMeter({ documentRef: document, performanceRef: performance, labels,
    createPerformanceObserver: (callback) => new PerformanceObserver(callback),
    createMutationObserver: (callback) => new MutationObserver(callback) }).start();
}
