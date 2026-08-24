"use strict";

class DomainSemanticAuditPersistence {
  apply({ dependencyAuditDocument, analyses }) {
    const byPath = new Map(
      analyses.map((record) => [record.currentPath, record]),
    );
    if (byPath.size !== analyses.length) {
      throw new Error("Duplicate semantic audit analysis path");
    }
    const result = this.#clone(dependencyAuditDocument);
    for (const entry of result.entries) {
      const analysis = byPath.get(entry.currentPath);
      if (!analysis) throw new Error(`Missing semantic audit analysis: ${entry.currentPath}`);
      entry.stateOwnership = this.#clone(analysis.stateOwnership);
      entry.configurationInput = this.#clone(analysis.configurationInput);
      entry.performanceRisk = this.#clone(analysis.performanceRisk);
    }
    if (byPath.size !== result.entries.length) {
      throw new Error("Semantic audit analyses must equal exact inventory scope");
    }
    return result;
  }

  reconcileStale({ inventoryDocument, existingDocument }) {
    const existingByPath = new Map(
      (existingDocument?.entries || []).map((entry) => [entry.currentPath, entry]),
    );
    const result = this.#clone(inventoryDocument);
    for (const entry of result.entries) {
      const previous = existingByPath.get(entry.currentPath);
      if (!previous) continue;
      entry.dependencyAudit = this.#clone(previous.dependencyAudit);
      if (
        previous.manifestEvidence?.fingerprint === entry.manifestEvidence.fingerprint
      ) {
        for (const field of [
          "stateOwnership",
          "configurationInput",
          "performanceRisk",
        ]) entry[field] = this.#clone(previous[field]);
      }
    }
    return result;
  }

  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
}

module.exports = { DomainSemanticAuditPersistence };
