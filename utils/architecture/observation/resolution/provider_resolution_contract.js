class ProviderResolutionContract {
  constructor(resolutionModel) {
    this.model = resolutionModel;
  }

  consumerKey(consumer) {
    return this.model.resolutionUnit.keyFields
      .map((field) => consumer[field])
      .join("\u0000");
  }

  providerCandidateIdentity(providerSource) {
    return providerSource[this.model.candidateModel.identity];
  }

  isMechanismCompatible(providerMechanism, consumerMechanism) {
    const compatible = this.model.classicScriptCompatibility
      .providerToConsumerMechanisms[providerMechanism] || [];
    return compatible.includes(consumerMechanism);
  }

  isAvailabilityTrustworthy(availability) {
    return this.model.availabilityCompatibility
      .trustworthyProviderAvailabilities.includes(availability);
  }

  guardedConsumerRelaxesProviderProof() {
    return this.model.availabilityCompatibility
      .guardedConsumerRelaxesProviderProof;
  }

  guardedConsumerPreservesSemantics() {
    return this.model.availabilityCompatibility
      .guardedConsumerPreservesSemantics;
  }

  assessLoadOrder({
    providerPath,
    providerLoadOrder,
    consumerPath,
    consumerLoadOrder,
    executionPhase,
  }) {
    if (providerPath === consumerPath) {
      return this.model.legacyLoadOrder.sameFileProgramInit;
    }
    if (providerLoadOrder === null || consumerLoadOrder === null) {
      return this.model.legacyLoadOrder.missingOrderResult;
    }
    const rule = this.model.legacyLoadOrder
      .executionPhaseRules[executionPhase];
    if (rule === undefined) {
      throw new Error(`Unsupported consumer execution phase: ${executionPhase}`);
    }
    if (rule === "later-provider-allowed") return "eligible";
    return providerLoadOrder < consumerLoadOrder ? "eligible" : "ineligible";
  }

  classifyTrustworthyProviderCount(count) {
    if (count === this.model.unresolvedProviderCount) return "unresolved";
    if (count === this.model.confirmedProviderCount) return "confirmed";
    if (count >= this.model.ambiguousProviderMinimum) return "ambiguous";
    throw new Error(`Unsupported trustworthy provider count: ${count}`);
  }

  shouldCreateDependencyEdge({ source, target, resolution }) {
    return resolution === "confirmed" && source !== target;
  }
}

module.exports = { ProviderResolutionContract };
