const recordsByResult = new WeakMap();

export class AssetLoadResult {

  constructor(records = []) {
    recordsByResult.set(this, Object.freeze(records.slice()));
  }

  get ok() {
    const records = recordsByResult.get(this);
    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      if (record.critical && !record.loaded) return false;
    }
    return true;
  }

  get count() {
    return recordsByResult.get(this).length;
  }

  getAt(index) {
    const records = recordsByResult.get(this);
    return index >= 0 && index < records.length
      ? records[index]
      : null;
  }

  assertCriticalReady(scope) {
    if (this.ok) return this;
    throw new Error(`${scope} critical assets failed to load`);
  }
}
