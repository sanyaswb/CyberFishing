export class AutoRefillMemory {
  #signatures = new Map();

  constructor(entries = {}) {
    for (const [targetKey, signature] of Object.entries(entries || {})) {
      this.remember(targetKey, signature);
    }
  }

  remember(targetKey, signature) {
    if (!targetKey || !signature) return this;
    this.#signatures.set(targetKey, this.#clone(signature));
    return this;
  }

  forget(targetKey) {
    this.#signatures.delete(targetKey);
    return this;
  }

  get(targetKey) {
    const signature = this.#signatures.get(targetKey);
    return signature ? this.#clone(signature) : null;
  }

  snapshot() {
    const result = {};
    for (const [targetKey, signature] of this.#signatures) {
      result[targetKey] = this.#clone(signature);
    }
    return Object.freeze(result);
  }

  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
}
