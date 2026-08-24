"use strict";

class ImmutableDomainAuditValue {
  constructor(value) {
    this.value = this.#deepFreeze(this.#clone(value));
    Object.freeze(this);
  }

  snapshot() {
    return this.#clone(this.value);
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

class DomainAuditDocument extends ImmutableDomainAuditValue {}

class DomainAuditEntry extends ImmutableDomainAuditValue {}

module.exports = { DomainAuditDocument, DomainAuditEntry };
