class ProviderObservationAssembler {
  assemble(currentPath, observations) {
    const items = this.#uniqueProviders(
      observations.flatMap((observation) => observation.providers),
    );
    const issues = this.#uniqueIssues(
      observations.flatMap((observation) => observation.issues),
    );
    return {
      currentPath,
      providers: {
        status: issues.length > 0 ? "partial" : "verified",
        items,
        issues,
      },
    };
  }

  failed(currentPath, issue) {
    return {
      currentPath,
      providers: {
        status: "failed",
        items: [],
        issues: [issue],
      },
    };
  }

  #uniqueProviders(providers) {
    const unique = new Map();
    for (const provider of providers) {
      const key = this.#providerKey(provider);
      unique.set(key, provider);
    }
    return [...unique.values()].sort((left, right) =>
      this.#compareText(this.#providerKey(left), this.#providerKey(right))
    );
  }

  #uniqueIssues(issues) {
    const unique = new Map();
    for (const issue of issues) {
      unique.set(`${issue.code}\u0000${issue.message}`, issue);
    }
    return [...unique.values()].sort((left, right) =>
      this.#compareText(left.code, right.code) ||
      this.#compareText(left.message, right.message)
    );
  }

  #providerKey(provider) {
    return [
      provider.symbol,
      provider.mechanism,
      provider.availability,
    ].join("\u0000");
  }

  #compareText(left, right) {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }
}

module.exports = { ProviderObservationAssembler };
