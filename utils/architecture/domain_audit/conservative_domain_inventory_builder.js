const { CanonicalJson } = require("../guards/core/canonical_json");
const {
  PersistedDependencyGraph,
} = require("../observation/integrity/persisted_dependency_graph");
const {
  DerivedReverseConsumerIndex,
} = require("../observation/integrity/derived_reverse_consumer_index");
const { DomainScopeSelector } = require("./domain_scope_selector");

class ConservativeDomainInventoryBuilder {
  constructor(contract) {
    this.contract = contract;
    this.scopeSelector = new DomainScopeSelector({
      targetBoundary: contract.scopeRule.value,
    });
  }

  build({ manifest, releaseVersion }) {
    this.#requireManifest(manifest);
    const reverseConsumers = new DerivedReverseConsumerIndex(
      new PersistedDependencyGraph(manifest),
    );
    const entries = manifest.modules
      .filter((entry) => this.scopeSelector.includes(entry))
      .map((entry) => this.#buildEntry(entry, reverseConsumers))
      .sort((left, right) => this.#compareText(left.currentPath, right.currentPath));
    const manifestScopeFingerprint = CanonicalJson.fingerprint(
      entries.map((entry) => this.#scopeFingerprintValue(entry)),
    );

    return {
      schemaVersion: this.contract.schemaVersion,
      kind: this.contract.kind,
      source: {
        releaseVersion,
        manifestPath: this.contract.manifestPath,
        manifestSchemaVersion: manifest.schemaVersion,
        scope: { ...this.contract.scopeRule },
        manifestScopeFingerprint,
      },
      entries,
    };
  }

  reconcile({ manifest, releaseVersion, existingDocument = null }) {
    const next = this.build({ manifest, releaseVersion });
    if (
      existingDocument?.schemaVersion !== this.contract.schemaVersion ||
      existingDocument?.kind !== this.contract.kind ||
      !Array.isArray(existingDocument?.entries)
    ) return next;
    const existingByPath = new Map(
      existingDocument.entries.map((entry) => [entry.currentPath, entry]),
    );
    for (const entry of next.entries) {
      const previous = existingByPath.get(entry.currentPath);
      if (
        !previous ||
        previous.manifestEvidence?.fingerprint !==
          entry.manifestEvidence.fingerprint
      ) continue;
      for (const field of [
        "dependencyAudit",
        "stateOwnership",
        "configurationInput",
        "performanceRisk",
      ]) entry[field] = this.#clone(previous[field]);
    }
    return next;
  }

  #buildEntry(entry, reverseConsumers) {
    const manifestEvidence = {
      fingerprint: "",
      legacyLoadOrder: entry.observed.legacyLoadOrder,
      providers: this.#clone(entry.observed.providers),
      consumers: this.#clone(entry.observed.consumers),
      environment: this.#clone(entry.observed.environment),
      dependencies: this.#clone(entry.analysis.dependencies),
      blockers: this.#clone(entry.analysis.blockers),
      reverseConsumers: reverseConsumers.consumersOf(entry.currentPath),
    };
    manifestEvidence.fingerprint = this.#evidenceFingerprint({
      currentPath: entry.currentPath,
      targetPath: entry.architecture.targetPath,
      roles: entry.architecture.roles,
      manifestEvidence,
    });
    return {
      currentPath: entry.currentPath,
      targetPath: entry.architecture.targetPath,
      roles: this.#clone(entry.architecture.roles),
      manifestEvidence,
      dependencyAudit: this.contract.createPendingAnalysis(),
      stateOwnership: this.contract.createPendingAnalysis(),
      configurationInput: this.contract.createPendingAnalysis(),
      performanceRisk: this.contract.createPendingAnalysis(),
    };
  }

  #scopeFingerprintValue(entry) {
    return {
      currentPath: entry.currentPath,
      targetPath: entry.targetPath,
      roles: entry.roles,
      manifestEvidence: entry.manifestEvidence,
    };
  }

  #evidenceFingerprint(entry) {
    const evidence = this.#clone(entry.manifestEvidence);
    delete evidence.fingerprint;
    return CanonicalJson.fingerprint({
      currentPath: entry.currentPath,
      targetPath: entry.targetPath,
      roles: entry.roles,
      manifestEvidence: evidence,
    });
  }

  #requireManifest(manifest) {
    if (!Number.isInteger(manifest?.schemaVersion)) {
      throw new Error("Domain inventory requires a versioned Migration Manifest");
    }
    if (!Array.isArray(manifest.modules)) {
      throw new Error("Domain inventory requires Migration Manifest modules");
    }
  }

  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  #compareText(left, right) {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }
}

module.exports = { ConservativeDomainInventoryBuilder };
