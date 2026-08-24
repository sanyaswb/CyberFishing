"use strict";

class DomainDependencyAuditPersistence {
  apply({ inventoryDocument, existingDocument, analyses }) {
    const analysisByPath = new Map(
      analyses.map((record) => [record.currentPath, record.analysis]),
    );
    if (analysisByPath.size !== analyses.length) {
      throw new Error("Duplicate dependency audit analysis path");
    }
    const existingByPath = new Map(
      (existingDocument?.entries || []).map((entry) => [entry.currentPath, entry]),
    );
    const result = this.#clone(inventoryDocument);
    for (const entry of result.entries) {
      const analysis = analysisByPath.get(entry.currentPath);
      if (!analysis) {
        throw new Error(`Missing dependency audit analysis: ${entry.currentPath}`);
      }
      const previous = existingByPath.get(entry.currentPath);
      entry.dependencyAudit = this.#clone(analysis);
      if (previous) {
        for (const field of [
          "stateOwnership",
          "configurationInput",
          "performanceRisk",
        ]) entry[field] = this.#clone(previous[field]);
      }
    }
    if (analysisByPath.size !== result.entries.length) {
      throw new Error("Dependency audit analyses must equal exact inventory scope");
    }
    return result;
  }

  reconcileStale({ inventoryDocument, existingDocument, graphFingerprints }) {
    const existingByPath = new Map(
      (existingDocument?.entries || []).map((entry) => [entry.currentPath, entry]),
    );
    const result = this.#clone(inventoryDocument);
    for (const entry of result.entries) {
      const previous = existingByPath.get(entry.currentPath);
      if (!previous) continue;
      for (const field of [
        "stateOwnership",
        "configurationInput",
        "performanceRisk",
      ]) entry[field] = this.#clone(previous[field]);
      const evidenceCurrent = previous.manifestEvidence?.fingerprint ===
        entry.manifestEvidence.fingerprint;
      const graphCurrent = previous.dependencyAudit?.facts?.graphFingerprint ===
        graphFingerprints.get(entry.currentPath);
      if (evidenceCurrent && graphCurrent) {
        entry.dependencyAudit = this.#clone(previous.dependencyAudit);
      }
    }
    return result;
  }

  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
}

module.exports = { DomainDependencyAuditPersistence };
