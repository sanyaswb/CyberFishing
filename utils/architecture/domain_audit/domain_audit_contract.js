class DomainAuditContract {
  get schemaVersion() {
    return 2;
  }

  get kind() {
    return "cyber-fishing-stage-3-domain-audit";
  }

  get manifestPath() {
    return "architecture/migration/module_migration_manifest.json";
  }

  get scopeRule() {
    return Object.freeze({
      field: "architecture.targetBoundary",
      operator: "equals",
      value: "game-domain",
    });
  }

  get statuses() {
    return Object.freeze(["pending", "verified", "partial", "failed"]);
  }

  get rootFields() {
    return Object.freeze(["schemaVersion", "kind", "source", "entries"]);
  }

  get sourceFields() {
    return Object.freeze([
      "releaseVersion",
      "manifestPath",
      "manifestSchemaVersion",
      "scope",
      "manifestScopeFingerprint",
    ]);
  }

  get entryFields() {
    return Object.freeze([
      "currentPath",
      "targetPath",
      "roles",
      "manifestEvidence",
      "dependencyAudit",
      "stateOwnership",
      "configurationInput",
      "performanceRisk",
    ]);
  }

  get evidenceFields() {
    return Object.freeze([
      "fingerprint",
      "legacyLoadOrder",
      "providers",
      "consumers",
      "environment",
      "dependencies",
      "blockers",
      "reverseConsumers",
    ]);
  }

  get analysisFields() {
    return Object.freeze(["status", "facts"]);
  }

  get dependencyAuditFactFields() {
    return Object.freeze([
      "graphFingerprint",
      "internalDependencies",
      "externalDependencies",
      "reverseConsumers",
      "scc",
      "dependencyDepth",
      "capabilities",
      "availabilityConstraints",
      "topLevelEffects",
      "evidence",
      "issues",
    ]);
  }

  get internalDependencyFields() {
    return Object.freeze(["target", "symbols", "executionPhases"]);
  }

  get externalDependencyFields() {
    return Object.freeze([
      "target",
      "targetBoundary",
      "symbols",
      "executionPhases",
      "policy",
    ]);
  }

  get dependencyReverseConsumerFields() {
    return Object.freeze(["source", "sourceBoundary", "symbols"]);
  }

  get sccFields() {
    return Object.freeze(["id", "members", "internalEdges", "cyclic"]);
  }

  get sccEdgeFields() {
    return Object.freeze(["source", "target"]);
  }

  get capabilityFields() {
    return Object.freeze(["capability", "identifiers", "policy"]);
  }

  get availabilityConstraintFields() {
    return Object.freeze([
      "symbol",
      "target",
      "consumerPhase",
      "providerAvailability",
      "resolution",
    ]);
  }

  get topLevelEffectFields() {
    return Object.freeze(["kind", "location", "classification"]);
  }

  get stateOwnershipFactFields() {
    return Object.freeze([
      "classification",
      "authoritativeOwners",
      "reads",
      "writes",
      "derivedCaches",
      "persistenceBoundaries",
      "evidence",
      "issues",
    ]);
  }

  get configurationInputFactFields() {
    return Object.freeze([
      "inputs",
      "forbiddenDirectReads",
      "evidence",
      "issues",
    ]);
  }

  get performanceRiskFactFields() {
    return Object.freeze([
      "hotLoopParticipation",
      "perFrameAllocations",
      "browserAccess",
      "deltaTimeSemantics",
      "updateRenderSeparation",
      "evidence",
      "issues",
    ]);
  }

  get auditEvidenceFields() {
    return Object.freeze(["sourcePath", "observation"]);
  }

  get configurationInputFields() {
    return Object.freeze(["source", "delivery"]);
  }

  createPendingAnalysis() {
    return { status: "pending", facts: null };
  }
}

module.exports = { DomainAuditContract };
