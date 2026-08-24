"use strict";

const { immutableRecord } = require("../guards/core/guard_models");

class DomainCandidateEvidenceJoiner {
  join({ audit, manifest }) {
    const manifestByPath = new Map(
      (manifest?.modules || []).map((entry) => [entry.currentPath, entry]),
    );
    const records = [];
    for (const entry of audit?.entries || []) {
      const manifestEntry = manifestByPath.get(entry.currentPath);
      if (!manifestEntry) {
        throw new Error(`Candidate evidence lacks Manifest entry: ${entry.currentPath}`);
      }
      if (
        manifestEntry.architecture?.targetBoundary !== "game-domain" ||
        manifestEntry.architecture?.targetPath !== entry.targetPath
      ) {
        throw new Error(`Candidate evidence architecture mismatch: ${entry.currentPath}`);
      }
      records.push({
        ...entry,
        targetArea: this.#targetArea(entry.targetPath),
        migrationStatus: manifestEntry.architecture.migrationStatus,
      });
    }
    const manifestScope = (manifest?.modules || [])
      .filter((entry) => entry.architecture?.targetBoundary === "game-domain")
      .map((entry) => entry.currentPath)
      .sort();
    const auditScope = records.map((entry) => entry.currentPath).sort();
    if (!this.#sameArray(manifestScope, auditScope)) {
      throw new Error("Candidate evidence scope differs from exact game-domain Manifest scope");
    }
    return immutableRecord(records.sort((left, right) =>
      left.currentPath.localeCompare(right.currentPath)));
  }

  #targetArea(targetPath) {
    const prefix = "src/game/domain/";
    if (!targetPath.startsWith(prefix)) {
      throw new Error(`Candidate target is outside game-domain: ${targetPath}`);
    }
    const suffix = targetPath.slice(prefix.length);
    const first = suffix.split("/")[0];
    return first.endsWith(".js") ? "domain-root" : first;
  }

  #sameArray(left, right) {
    return left.length === right.length &&
      left.every((value, index) => value === right[index]);
  }
}

module.exports = { DomainCandidateEvidenceJoiner };
