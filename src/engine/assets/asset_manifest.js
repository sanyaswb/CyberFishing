const recordsByManifest = new WeakMap();

export class AssetManifest {
  constructor() {
    recordsByManifest.set(this, []);
  }

  add(id, src, { critical = true } = {}) {
    const normalizedId = String(id || "").trim();
    const normalizedSrc = String(src || "").trim();
    if (!normalizedId || !normalizedSrc) return this;
    recordsByManifest.get(this).push({
      id: normalizedId,
      src: normalizedSrc,
      critical: critical !== false,
    });
    return this;
  }

  get count() {
    return recordsByManifest.get(this).length;
  }

  getAt(index) {
    const records = recordsByManifest.get(this);
    return index >= 0 && index < records.length
      ? records[index]
      : null;
  }

  toProviderManifest() {
    const manifest = {};
    const records = recordsByManifest.get(this);
    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      manifest[record.id] = record.src;
    }
    return manifest;
  }
}
