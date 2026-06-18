class AssetLoadResult {
  #records;

  constructor(records = []) {
    this.#records = Object.freeze(records.slice());
  }

  get ok() {
    for (let index = 0; index < this.#records.length; index += 1) {
      const record = this.#records[index];
      if (record.critical && !record.loaded) return false;
    }
    return true;
  }

  get count() {
    return this.#records.length;
  }

  getAt(index) {
    return index >= 0 && index < this.#records.length
      ? this.#records[index]
      : null;
  }

  assertCriticalReady(scope) {
    if (this.ok) return this;
    throw new Error(`${scope} critical assets failed to load`);
  }
}
