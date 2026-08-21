class ProviderResolutionEngine {
  constructor({ candidateIndex, loadOrderIndex, resolutionContract }) {
    this.candidateIndex = candidateIndex;
    this.loadOrderIndex = loadOrderIndex;
    this.contract = resolutionContract;
  }

  resolve({ currentPath, consumer }) {
    const assessments = this.candidateIndex
      .candidatesFor(consumer.symbol)
      .map((candidate) => this.#assessCandidate(
        currentPath,
        consumer,
        candidate,
      ));
    const eligible = this.#pathsWithStatus(assessments, "eligible");
    const partial = this.#pathsWithStatus(assessments, "partial");
    const issues = [];

    if (!this.candidateIndex.isComplete()) {
      issues.push({
        code: "provider-corpus-incomplete",
        message:
          "Provider observations are incomplete; unique provider proof is suppressed.",
      });
    }
    if (partial.length > 0) {
      issues.push({
        code: "missing-legacy-load-order",
        message:
          `${consumer.symbol}: compatible provider evidence has no complete legacy load order.`,
      });
    }

    if (eligible.length >= this.contract.model.ambiguousProviderMinimum) {
      return {
        kind: "ambiguous",
        record: this.#ambiguousRecord(consumer, eligible),
        issues,
      };
    }
    if (
      !this.candidateIndex.isComplete() ||
      partial.length > 0 ||
      eligible.length === this.contract.model.unresolvedProviderCount
    ) {
      return {
        kind: "unresolved",
        record: this.#unresolvedRecord(consumer),
        issues,
      };
    }
    return {
      kind: "confirmed",
      record: this.#confirmedRecord(consumer, eligible[0]),
      issues,
    };
  }

  #assessCandidate(consumerPath, consumer, candidate) {
    const states = candidate.providers
      .filter((provider) =>
        this.contract.isMechanismCompatible(
          provider.mechanism,
          consumer.mechanism,
        ) && this.contract.isAvailabilityTrustworthy(provider.availability)
      )
      .map(() => this.contract.assessLoadOrder({
        providerPath: candidate.currentPath,
        providerLoadOrder: this.loadOrderIndex.get(candidate.currentPath),
        consumerPath,
        consumerLoadOrder: this.loadOrderIndex.get(consumerPath),
        executionPhase: consumer.executionPhase,
      }));

    if (states.some((state) =>
      state === "eligible" || state === "eligible-self-resolution"
    )) {
      return { currentPath: candidate.currentPath, status: "eligible" };
    }
    if (states.includes("partial")) {
      return { currentPath: candidate.currentPath, status: "partial" };
    }
    return { currentPath: candidate.currentPath, status: "ineligible" };
  }

  #pathsWithStatus(assessments, status) {
    return assessments
      .filter((assessment) => assessment.status === status)
      .map((assessment) => assessment.currentPath)
      .sort((left, right) => this.#compareText(left, right));
  }

  #confirmedRecord(consumer, target) {
    return {
      ...this.#provenance(consumer),
      target,
      resolution: "confirmed",
    };
  }

  #unresolvedRecord(consumer) {
    return {
      ...this.#provenance(consumer),
      resolution: "unresolved",
    };
  }

  #ambiguousRecord(consumer, candidates) {
    return {
      ...this.#provenance(consumer),
      resolution: "ambiguous",
      candidates,
    };
  }

  #provenance(consumer) {
    return Object.fromEntries(
      this.contract.model.resolutionUnit.keyFields.map((field) => [
        field,
        consumer[field],
      ]),
    );
  }

  #compareText(left, right) {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }
}

module.exports = { ProviderResolutionEngine };
