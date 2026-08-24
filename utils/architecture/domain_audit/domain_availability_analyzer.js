"use strict";

const {
  ProviderResolutionContract,
} = require("../observation/resolution/provider_resolution_contract");

class DomainAvailabilityAnalyzer {
  constructor(resolutionModel) {
    this.contract = new ProviderResolutionContract(resolutionModel);
  }

  analyze({ entry, moduleByPath }) {
    const records = [];
    for (const consumer of entry.analysis.dependencies.confirmed) {
      records.push({
        symbol: consumer.symbol,
        target: consumer.target,
        consumerPhase: consumer.executionPhase,
        providerAvailability: this.#confirmedAvailability(
          consumer,
          moduleByPath.get(consumer.target),
        ),
        resolution: "confirmed",
      });
    }
    for (const consumer of entry.analysis.dependencies.unresolved) {
      records.push({
        symbol: consumer.symbol,
        target: null,
        consumerPhase: consumer.executionPhase,
        providerAvailability: "missing",
        resolution: "unresolved",
      });
    }
    for (const consumer of entry.analysis.dependencies.ambiguous) {
      records.push({
        symbol: consumer.symbol,
        target: null,
        consumerPhase: consumer.executionPhase,
        providerAvailability: "ambiguous",
        resolution: "ambiguous",
      });
    }
    return this.#aggregate(records);
  }

  #confirmedAvailability(consumer, target) {
    const compatible = (target?.observed?.providers?.items || []).filter((provider) =>
      provider.symbol === consumer.symbol &&
      this.contract.isMechanismCompatible(provider.mechanism, consumer.mechanism) &&
      this.contract.isAvailabilityTrustworthy(provider.availability)
    );
    const availabilities = [...new Set(
      compatible.map((provider) => provider.availability),
    )];
    if (availabilities.length === 1) return availabilities[0];
    if (availabilities.length === 0) return "missing";
    return "ambiguous";
  }

  #aggregate(records) {
    const unique = new Map();
    for (const record of records) {
      const key = `${record.symbol}\u0000${record.target || ""}\u0000` +
        `${record.consumerPhase}\u0000${record.resolution}`;
      const previous = unique.get(key);
      if (!previous) {
        unique.set(key, record);
      } else if (previous.providerAvailability !== record.providerAvailability) {
        unique.set(key, { ...record, providerAvailability: "ambiguous" });
      }
    }
    return [...unique.entries()]
      .sort(([left], [right]) => this.#compareText(left, right))
      .map(([, record]) => record);
  }

  #compareText(left, right) {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }
}

module.exports = { DomainAvailabilityAnalyzer };
