"use strict";

class DomainDependencyTopology {
  #value;

  constructor(value) {
    this.#value = this.#deepFreeze(this.#clone(value));
    Object.freeze(this);
  }

  get fingerprint() {
    return this.#value.fingerprint;
  }

  get minimumDepth() {
    return this.#value.minimumDepth;
  }

  get maximumDepth() {
    return this.#value.maximumDepth;
  }

  components() {
    return this.#clone(this.#value.components);
  }

  cycles() {
    return this.#clone(this.#value.cycleDiagnostics);
  }

  depths() {
    return this.#clone(this.#value.moduleDepths);
  }

  componentOf(currentPath) {
    const component = this.#value.components.find((item) =>
      item.members.includes(currentPath)
    );
    return component ? this.#clone(component) : null;
  }

  depthOf(currentPath) {
    const record = this.#value.moduleDepths.find((item) =>
      item.currentPath === currentPath
    );
    return record ? record.depth : null;
  }

  snapshot() {
    return this.#clone(this.#value);
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

module.exports = { DomainDependencyTopology };
