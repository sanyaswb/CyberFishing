"use strict";

class DomainScopeSelector {
  constructor({ targetBoundary = "game-domain" } = {}) {
    this.targetBoundary = targetBoundary;
  }

  includes(entry) {
    return entry?.architecture?.targetBoundary === this.targetBoundary &&
      !(entry.architecture.roles || []).includes("compatibility-bridge");
  }
}

module.exports = { DomainScopeSelector };
