class OverlayMetricCatalog {
  #entriesByLabel = new Map();
  #readyPromise;

  constructor({
    url = "src/config/metadata/overlay_metric_descriptions.json",
    fetchSource = typeof fetch === "function" ? fetch.bind(window) : null,
  } = {}) {
    this.#readyPromise = this.#load(url, fetchSource);
  }

  get ready() {
    return this.#readyPromise;
  }

  async #load(url, fetchSource) {
    if (!fetchSource) return;
    try {
      const response = await fetchSource(url, { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const entries = await response.json();
      this.#entriesByLabel = new Map(Object.entries(entries || {}));
    } catch (error) {
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

window.OverlayMetricCatalog = OverlayMetricCatalog;
