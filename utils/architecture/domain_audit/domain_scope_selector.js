"use strict";

class DomainScopeSelector {
  constructor({ targetBoundary = "game-domain" } = {}) {
    this.targetBoundary = targetBoundary;
  }

  includes(entry) {
    const preliminaryEsmTarget =
      entry?.architecture?.migrationStatus === "migrating" &&
      entry.architecture.targetPath === entry.currentPath &&
      entry?.observed?.legacyLoadOrder === null;
    return entry?.architecture?.targetBoundary === this.targetBoundary &&
      !preliminaryEsmTarget &&
      !(entry.architecture.roles || []).includes("compatibility-bridge");
  }
}

module.exports = { DomainScopeSelector };
