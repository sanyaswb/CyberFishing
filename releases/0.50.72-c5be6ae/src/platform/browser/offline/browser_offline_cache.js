// The page's side of the offline cache (spec 171 stage 4): registers the release's service worker once the game has
// loaded everything it loads (the "full-load" mark), so the worker never competes with the start, then hands it the
// same-origin files the page loaded before the worker controlled it; the worker stores them from the HTTP cache.
// Only a built release declares the worker (data-offline-worker on <html>, written by utils/build-release.js): npm run
// dev and dev.html never register one. The worker's URL resolves against the page's address, not its <base> (on Pages
// the root page's <base> points into the release folder, the worker lies beside the root page).
const WORKER_ATTRIBUTE = "data-offline-worker";
const RESOURCE_TIMING_BUFFER = 2000;

export class BrowserOfflineCache {
  #windowTarget;
  #workerUrl;
  #logger;
  #enabled = false;

  // The page's offline cache, or null when the page declares no worker or the browser has no service workers.
  static fromPage({ windowTarget, documentTarget, logger }) {
    const declared = documentTarget?.documentElement?.getAttribute?.(WORKER_ATTRIBUTE);
    if (!declared || !windowTarget?.navigator?.serviceWorker) return null;
    return new BrowserOfflineCache({ windowTarget, workerUrl: new URL(declared, windowTarget.location.href).href, logger });
  }

  constructor({ windowTarget, workerUrl, logger }) {
    if (typeof windowTarget?.navigator?.serviceWorker?.register !== "function") {
      throw new TypeError("BrowserOfflineCache requires service workers");
    }
    if (typeof workerUrl !== "string") throw new TypeError("BrowserOfflineCache requires the worker's URL");
    if (typeof logger?.warn !== "function") throw new TypeError("BrowserOfflineCache requires a logger");
    this.#windowTarget = windowTarget;
    this.#workerUrl = workerUrl;
    this.#logger = logger;
    // The first visit hands the worker every file it loaded: keep more timing entries than the browser's default 250.
    windowTarget.performance?.setResourceTimingBufferSize?.(RESOURCE_TIMING_BUFFER);
  }

  // Once per page, after the full load. Resolves when the worker has the page's files (or could not be registered).
  async enable() {
    if (this.#enabled) return;
    this.#enabled = true;
    const container = this.#windowTarget.navigator.serviceWorker;
    try {
      await container.register(this.#workerUrl, { updateViaCache: "none" });
      const registration = await container.ready;
      registration.active?.postMessage({ type: "cache-urls", urls: this.#loadedUrls() });
    } catch (error) {
      this.#logger.warn("[OfflineCache] The offline cache could not start; the game keeps loading from the network.", error);
    }
  }

  #loadedUrls() {
    const origin = this.#windowTarget.location.origin;
    const entries = this.#windowTarget.performance?.getEntriesByType?.("resource") ?? [];
    const urls = new Set([this.#windowTarget.location.href.split("#")[0]]);
    for (const entry of entries) {
      if (typeof entry.name === "string" && entry.name.startsWith(`${origin}/`)) urls.add(entry.name);
    }
    return [...urls];
  }
}
