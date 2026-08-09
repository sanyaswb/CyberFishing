const AutoRefillTrigger = Object.freeze({
  ROD_RETRIEVED: "rod-retrieved",
  HAND_CHUM_USED: "hand-chum-used",
  BOAT_RETURNED: "boat-returned",
});

const AutoRefillScope = Object.freeze({
  TACKLE_BAIT: "tackle-bait",
  TACKLE_CHUM: "tackle-chum",
  HAND_CHUM: "hand-chum",
  BOAT_CHUM: "boat-chum",
});

class AutoRefillSettings {
  #autoBait;
  #autoChum;

  constructor({ autoBait = false, autoChum = false } = {}) {
    this.#autoBait = autoBait === true;
    this.#autoChum = autoChum === true;
  }

  get autoBait() {
    return this.#autoBait;
  }

  get autoChum() {
    return this.#autoChum;
  }

  setAutoBait(enabled) {
    this.#autoBait = enabled === true;
    return this;
  }

  setAutoChum(enabled) {
    this.#autoChum = enabled === true;
    return this;
  }

  snapshot() {
    return Object.freeze({ autoBait: this.#autoBait, autoChum: this.#autoChum });
  }
}

class AutoRefillMemory {
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

class AutoRefillPolicy {
  #settings;

  constructor({ settings = null } = {}) {
    this.#settings = settings || new AutoRefillSettings();
  }

  resolveScopes(trigger, context = {}) {
    if (trigger === AutoRefillTrigger.ROD_RETRIEVED) {
      const scopes = [];
      if (this.#settings.autoBait) scopes.push(AutoRefillScope.TACKLE_BAIT);
      if (this.#settings.autoChum) scopes.push(AutoRefillScope.TACKLE_CHUM);
      return Object.freeze(scopes);
    }
    if (trigger === AutoRefillTrigger.HAND_CHUM_USED) {
      return Object.freeze(
        this.#settings.autoChum ? [AutoRefillScope.HAND_CHUM] : [],
      );
    }
    if (trigger === AutoRefillTrigger.BOAT_RETURNED) {
      const allBaysEmptied =
        context.allBaysEmptied === true || context.allSectionsUsed === true;
      const returned =
        context.hasReturnedToPlayer === true || context.isAtPlayer === true;
      return Object.freeze(
        this.#settings.autoChum && allBaysEmptied && returned
          ? [AutoRefillScope.BOAT_CHUM]
          : [],
      );
    }
    return Object.freeze([]);
  }
}
