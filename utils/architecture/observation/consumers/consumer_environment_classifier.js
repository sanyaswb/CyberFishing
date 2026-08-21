class ConsumerEnvironmentClassifier {
  constructor({ builtins, browserApis }) {
    this.builtins = new Set(builtins);
    this.browserApis = new Set(browserApis);
  }

  classify(candidates) {
    const consumers = [];
    const builtins = [];
    const browserApis = [];
    for (const candidate of candidates) {
      if (this.builtins.has(candidate.symbol)) {
        builtins.push(candidate.symbol);
      } else if (this.browserApis.has(candidate.symbol)) {
        browserApis.push(candidate.symbol);
      } else {
        consumers.push(this.#toConsumer(candidate));
      }
    }
    return { consumers, builtins, browserApis };
  }

  #toConsumer(candidate) {
    return {
      symbol: candidate.symbol,
      mechanism: candidate.mechanism,
      accessRequirement: candidate.accessRequirement,
      executionPhase: candidate.executionPhase,
    };
  }
}

module.exports = { ConsumerEnvironmentClassifier };
