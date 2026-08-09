const AssemblyPreparationStatus = Object.freeze({
  DRAFT: "DRAFT",
  PREPARED: "PREPARED",
});

class AssemblyState {
  #rootInstanceId;
  #profileId;
  #status;
  #refillSignatures = new Map();

  constructor({
    rootInstanceId,
    profileId,
    status = AssemblyPreparationStatus.DRAFT,
    refillSignatures = {},
  } = {}) {
    this.#assertId(rootInstanceId, "rootInstanceId");
    this.#assertId(profileId, "profileId");
    if (!Object.values(AssemblyPreparationStatus).includes(status)) {
      throw new RangeError(`Unknown assembly preparation status: ${status}`);
    }
    this.#rootInstanceId = rootInstanceId;
    this.#profileId = profileId;
    this.#status = status;

    const entries =
      refillSignatures instanceof Map
        ? [...refillSignatures.entries()]
        : Object.entries(refillSignatures || {});
    for (const [path, signature] of entries) {
      this.rememberRefill(path, signature);
    }
  }

  get rootInstanceId() {
    return this.#rootInstanceId;
  }

  get profileId() {
    return this.#profileId;
  }

  get status() {
    return this.#status;
  }

  get isDraft() {
    return this.#status === AssemblyPreparationStatus.DRAFT;
  }

  get isPrepared() {
    return this.#status === AssemblyPreparationStatus.PREPARED;
  }

  markPrepared() {
    this.#status = AssemblyPreparationStatus.PREPARED;
    return this;
  }

  rememberRefill(path, signature) {
    this.#assertPath(path);
    if (!signature || typeof signature !== "object") {
      throw new TypeError("A refill signature must be an object");
    }
    this.#refillSignatures.set(path, this.#clone(signature));
    return this;
  }

  getRefillSignature(path) {
    this.#assertPath(path);
    const signature = this.#refillSignatures.get(path);
    return signature ? this.#clone(signature) : null;
  }

  clearRefill(path, { descendants = true } = {}) {
    this.#assertPath(path);
    for (const storedPath of [...this.#refillSignatures.keys()]) {
      const isDescendant = storedPath.startsWith(`${path}.`);
      if (storedPath === path || (descendants && isDescendant)) {
        this.#refillSignatures.delete(storedPath);
      }
    }
    return this;
  }

  toSnapshot() {
    return {
      rootInstanceId: this.#rootInstanceId,
      profileId: this.#profileId,
      status: this.#status,
      refillSignatures: Object.fromEntries(
        [...this.#refillSignatures.entries()].map(([path, signature]) => [
          path,
          this.#clone(signature),
        ]),
      ),
    };
  }

  #assertId(value, name) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new TypeError(`${name} must be a non-empty string`);
    }
  }

  #assertPath(path) {
    if (typeof path !== "string" || path.trim().length === 0) {
      throw new TypeError("Assembly slot path must be a non-empty string");
    }
  }

  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
}
