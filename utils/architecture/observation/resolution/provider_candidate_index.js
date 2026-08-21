class ProviderCandidateIndex {
  constructor(providerObservations) {
    this.bySymbol = new Map();
    this.paths = new Set();
    this.complete = true;
    this.#index(providerObservations);
  }

  candidatesFor(symbol) {
    const bySource = this.bySymbol.get(symbol);
    if (!bySource) return [];
    return [...bySource.entries()]
      .sort(([left], [right]) => this.#compareText(left, right))
      .map(([currentPath, providers]) => ({ currentPath, providers }));
  }

  isComplete() {
    return this.complete;
  }

  sourcePaths() {
    return [...this.paths].sort((left, right) =>
      this.#compareText(left, right),
    );
  }

  #index(observations) {
    for (const observation of observations) {
      const currentPath = observation?.currentPath;
      if (typeof currentPath !== "string" || currentPath.length === 0) {
        throw new Error("Provider observation requires currentPath");
      }
      if (this.paths.has(currentPath)) {
        throw new Error(`Duplicate provider observation: ${currentPath}`);
      }
      this.paths.add(currentPath);

      const providers = observation?.providers;
      if (!providers || providers.status === "pending") {
        throw new Error(`Provider observation is not analyzed: ${currentPath}`);
      }
      if (!["verified", "partial", "failed"].includes(providers.status)) {
        throw new Error(`Invalid provider observation status: ${currentPath}`);
      }
      if (providers.status !== "verified") this.complete = false;

      for (const provider of providers.items || []) {
        const bySource = this.#sourceMap(provider.symbol);
        const facts = bySource.get(currentPath) || [];
        const providerKey = this.#providerKey(provider);
        if (facts.some((fact) => this.#providerKey(fact) === providerKey)) {
          throw new Error(
            `Duplicate provider fact: ${currentPath} provides ${provider.symbol}`,
          );
        }
        facts.push(provider);
        facts.sort((left, right) =>
          this.#compareText(this.#providerKey(left), this.#providerKey(right)),
        );
        bySource.set(currentPath, facts);
      }
    }
  }

  #sourceMap(symbol) {
    if (!this.bySymbol.has(symbol)) this.bySymbol.set(symbol, new Map());
    return this.bySymbol.get(symbol);
  }

  #providerKey(provider) {
    return `${provider.mechanism}\u0000${provider.availability}`;
  }

  #compareText(left, right) {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }
}

module.exports = { ProviderCandidateIndex };
