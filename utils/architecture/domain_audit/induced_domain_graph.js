"use strict";

const { CanonicalJson } = require("../guards/core/canonical_json");

class InducedDomainGraph {
  #value;

  constructor(value) {
    this.#value = this.#deepFreeze(this.#clone(value));
    Object.freeze(this);
  }

  get fingerprint() {
    return this.#value.fingerprint;
  }

  nodes() {
    return this.#clone(this.#value.nodes);
  }

  internalDependencies() {
    return this.#clone(this.#value.internalDependencies);
  }

  externalDependencies() {
    return this.#clone(this.#value.externalDependencies);
  }

  incomingDependencies() {
    return this.#clone(this.#value.incomingDependencies);
  }

  dependenciesOf(currentPath) {
    return {
      internal: this.internalDependencies().filter((edge) =>
        edge.source === currentPath
      ),
      external: this.externalDependencies().filter((edge) =>
        edge.source === currentPath
      ),
    };
  }

  consumersOf(currentPath) {
    return this.#value.incomingDependencies
      .filter((edge) => edge.target === currentPath)
      .map((edge) => ({
        source: edge.source,
        sourceBoundary: edge.sourceBoundary,
        symbols: [...edge.symbols],
      }));
  }

  snapshot() {
    return this.#clone(this.#value);
  }

  static fingerprint(value) {
    return CanonicalJson.fingerprint({
      nodes: value.nodes,
      internalDependencies: value.internalDependencies,
      externalDependencies: value.externalDependencies,
      incomingDependencies: value.incomingDependencies,
    });
  }

  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  #deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) {
      return value;
    }
    for (const child of Object.values(value)) this.#deepFreeze(child);
    return Object.freeze(value);
  }
}

module.exports = { InducedDomainGraph };
