class AssetManifest {
  #records = [];

  add(id, src, { critical = true } = {}) {
    const normalizedId = String(id || "").trim();
    const normalizedSrc = String(src || "").trim();
    if (!normalizedId || !normalizedSrc) return this;
    this.#records.push({
      id: normalizedId,
      src: normalizedSrc,
      critical: critical !== false,
    });
    return this;
  }

  get count() {
    return this.#records.length;
  }

  getAt(index) {
    return index >= 0 && index < this.#records.length
      ? this.#records[index]
      : null;
  }

  toProviderManifest() {
    const manifest = {};
    for (let index = 0; index < this.#records.length; index += 1) {
      const record = this.#records[index];
      manifest[record.id] = record.src;
    }
    return manifest;
  }
}
