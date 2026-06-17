class ImageAssetProvider {
  #entries = new Map();
  #imageFactory;
  #fallbackAssetId;

  constructor({
    imageFactory = null,
    fallbackAssetId = null,
  } = {}) {
    this.#imageFactory = imageFactory || this.#createBrowserImageFactory();
    this.#fallbackAssetId = fallbackAssetId;
  }

  preload(manifest) {
    const records = this.#normalizeManifest(manifest);
    return Promise.all(records.map((record) => this.#load(record)))
      .then(() => this);
  }

  tryGet(assetId) {
    const entry = this.#entries.get(assetId);
    if (entry?.status === "ready") return entry.image;

    const fallback = this.#entries.get(this.#fallbackAssetId);
    return fallback?.status === "ready" ? fallback.image : null;
  }

  isReady(assetId) {
    return this.#entries.get(assetId)?.status === "ready";
  }

  has(assetId) {
    return this.#entries.has(assetId);
  }

  static assetIdForSource(src, namespace = "asset") {
    const normalized = String(src || "").trim();
    return normalized ? `${namespace}:${normalized}` : "";
  }

  #load({ id, src }) {
    const existing = this.#entries.get(id);
    if (
      existing &&
      existing.src === src &&
      existing.status !== "failed"
    ) {
      return existing.promise;
    }

    const image = this.#imageFactory();
    if (!image) {
      return Promise.reject(
        new Error(`ImageAssetProvider could not create image for "${id}"`),
      );
    }

    const entry = {
      id,
      src,
      image,
      status: "loading",
      error: null,
      promise: null,
    };
    entry.promise = new Promise((resolve, reject) => {
      let settled = false;
      const markReady = () => {
        if (settled) return;
        settled = true;
        entry.status = "ready";
        resolve(image);
      };
      const markFailed = (error) => {
        if (settled) return;
        settled = true;
        entry.status = "failed";
        entry.error = error || new Error(`Failed to load image asset "${id}"`);
        reject(entry.error);
      };

      image.onload = markReady;
      image.onerror = markFailed;
      image.src = src;

      if (
        image.complete === true &&
        Math.max(0, Number(image.naturalWidth) || 0) > 0
      ) {
        markReady();
      }
    });
    this.#entries.set(id, entry);
    return entry.promise;
  }

  #normalizeManifest(manifest) {
    if (Array.isArray(manifest)) {
      return manifest.map((item) => this.#normalizeRecord(item));
    }
    if (manifest && typeof manifest === "object") {
      const records = [];
      for (const id of Object.keys(manifest)) {
        records.push(this.#normalizeRecord({ id, src: manifest[id] }));
      }
      return records;
    }
    throw new TypeError("ImageAssetProvider preload manifest must be an object or array");
  }

  #normalizeRecord(record) {
    const id = String(record?.id || "").trim();
    const src = String(record?.src || "").trim();
    if (!id || !src) {
      throw new Error("Image asset records require non-empty id and src");
    }
    return { id, src };
  }

  #createBrowserImageFactory() {
    if (typeof Image === "undefined") {
      throw new Error(
        "ImageAssetProvider requires Image or an injected imageFactory",
      );
    }
    return () => new Image();
  }
}
