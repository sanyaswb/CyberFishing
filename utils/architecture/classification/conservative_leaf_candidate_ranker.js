class ConservativeLeafCandidateRanker {
  constructor(candidateContract) {
    this.contract = candidateContract;
  }

  rank(evidenceEntries) {
    if (!Array.isArray(evidenceEntries)) {
      throw new Error("Leaf candidate ranking requires evidence entries");
    }
    return evidenceEntries
      .filter((entry) => this.#isEligible(entry))
      .map((entry) => ({
        currentPath: entry.currentPath,
        incomingEdgeCount: entry.metrics.incomingEdgeCount,
        providerCount: entry.metrics.providerCount,
        browserApiCount: entry.metrics.browserApiCount,
        legacyLoadOrder: entry.observations.legacyLoadOrder,
        reviewRequired: true,
      }))
      .sort((left, right) => this.#compare(left, right));
  }

  #isEligible(entry) {
    const metrics = entry.metrics;
    const requiredStatus = this.contract.requiredObservationStatus;
    return entry.decision.migrationStatus ===
        this.contract.requiredMigrationStatus &&
      entry.observations.providers.status === requiredStatus &&
      entry.observations.consumers.status === requiredStatus &&
      entry.observations.environment.status === requiredStatus &&
      entry.dependencies.status === requiredStatus &&
      metrics.providerCount > 0 &&
      metrics.outgoingEdgeCount === 0 &&
      metrics.unresolvedCount === 0 &&
      metrics.ambiguousCount === 0 &&
      metrics.dynamicConstructCount === 0 &&
      metrics.observationIssueCount === 0 &&
      metrics.dependencyIssueCount === 0;
  }

  #compare(left, right) {
    if (left.browserApiCount !== right.browserApiCount) {
      return left.browserApiCount - right.browserApiCount;
    }
    if (left.incomingEdgeCount !== right.incomingEdgeCount) {
      return right.incomingEdgeCount - left.incomingEdgeCount;
    }
    if (left.providerCount !== right.providerCount) {
      return right.providerCount - left.providerCount;
    }
    if (left.currentPath < right.currentPath) return -1;
    if (left.currentPath > right.currentPath) return 1;
    return 0;
  }
}

module.exports = { ConservativeLeafCandidateRanker };
