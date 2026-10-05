export class OverlayMetricCatalog {
  #entriesByLabel = new Map();
  #readyPromise;
  #abortController = typeof AbortController === "function" ? new AbortController() : null;
  #disposed = false;

  constructor({
    url = "src/config/metadata/overlay_metric_descriptions.json",
    fetchSource = typeof fetch === "function" ? fetch.bind(window) : null,
  } = {}) {
    this.#readyPromise = this.#load(url, fetchSource);
  }

  get ready() {
    return this.#readyPromise;
  }

  dispose() {
    this.#disposed = true;
    this.#abortController?.abort();
    this.#entriesByLabel.clear();
  }

  async #load(url, fetchSource) {
    if (!fetchSource) return;
    try {
      const response = await fetchSource(url, { cache: "no-cache", signal: this.#abortController?.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const entries = await response.json();
      if (!this.#disposed) this.#entriesByLabel = new Map(Object.entries(entries || {}));
    } catch (error) {
      if (this.#disposed) return;
      console.warn("[OverlayMetricCatalog] Metadata failed to load:", url, error);
    }
  }

  getEntry(label) {
    const normalized = this.normalizeLabel(label);
    if (this.#entriesByLabel.has(normalized)) {
      return this.#entriesByLabel.get(normalized);
    }

    for (const [key, entry] of this.#entriesByLabel.entries()) {
      if (normalized.startsWith(key)) return entry;
    }
    return null;
  }

  normalizeLabel(label) {
    return String(label || "")
      .replace(/[：:]+$/u, "")
      .replace(/\s*\([^)]*\)\s*$/u, "")
      .trim();
  }
}
