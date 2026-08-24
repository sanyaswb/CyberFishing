class DomainAuditSchemaMigrator {
  constructor(contract) {
    this.contract = contract;
  }

  migrate(document) {
    const source = this.#clone(document);
    if (source?.schemaVersion === this.contract.schemaVersion) return source;
    if (source?.schemaVersion !== 1 || this.contract.schemaVersion !== 2) {
      throw new Error(
        "Unsupported domain audit schema migration: " +
          `${source?.schemaVersion} → ${this.contract.schemaVersion}`,
      );
    }
    this.#requireV1(source);
    source.schemaVersion = 2;
    source.entries = source.entries.map((entry) => ({
      currentPath: entry.currentPath,
      targetPath: entry.targetPath,
      roles: entry.roles,
      manifestEvidence: entry.manifestEvidence,
      dependencyAudit: this.contract.createPendingAnalysis(),
      stateOwnership: entry.stateOwnership,
      configurationInput: entry.configurationInput,
      performanceRisk: entry.performanceRisk,
    }));
    return source;
  }

  #requireV1(document) {
    if (
      document?.kind !== this.contract.kind ||
      !document?.source ||
      !Array.isArray(document?.entries)
    ) throw new Error("Invalid Stage 3 domain audit v1 document");
    const requiredFields = [
      "currentPath",
      "targetPath",
      "roles",
      "manifestEvidence",
      "stateOwnership",
      "configurationInput",
      "performanceRisk",
    ];
    for (const entry of document.entries) {
      const actual = Object.keys(entry).sort();
      const expected = [...requiredFields].sort();
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(
          `${entry?.currentPath || "Domain audit entry"} is not valid v1`,
        );
      }
    }
  }

  #clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }
}

module.exports = { DomainAuditSchemaMigrator };
