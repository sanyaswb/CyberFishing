class ObservationManifestProjector {
  constructor(dependencyProjector) {
    this.dependencyProjector = dependencyProjector;
  }

  project({ providerObservations, consumerObservations, resolutionResult }) {
    const providers = this.#index(providerObservations, "provider");
    const consumers = this.#index(consumerObservations, "consumer");
    const resolutions = this.#index(resolutionResult.sources, "resolution");
    this.#assertSameScope(providers, consumers, resolutions);

    return [...providers.keys()]
      .sort((left, right) => this.#compareText(left, right))
      .map((currentPath) => {
        const provider = providers.get(currentPath);
        const consumer = consumers.get(currentPath);
        const resolution = resolutions.get(currentPath);
        return {
          currentPath,
          observed: {
            providers: this.#clone(provider.providers),
            consumers: this.#clone(consumer.consumers),
            environment: this.#clone(consumer.environment),
          },
          dependencies: this.dependencyProjector.project(
            resolution,
            resolutionResult.graph.edges,
          ),
        };
      });
  }

  #index(observations, kind) {
    const indexed = new Map();
    for (const observation of observations) {
      const currentPath = observation?.currentPath;
      if (typeof currentPath !== "string" || currentPath.length === 0) {
        throw new Error(`${kind} observation requires currentPath`);
      }
      if (indexed.has(currentPath)) {
        throw new Error(`Duplicate ${kind} observation: ${currentPath}`);
      }
      indexed.set(currentPath, observation);
    }
    return indexed;
  }

  #assertSameScope(...indexes) {
    const expected = [...indexes[0].keys()].sort();
    for (const index of indexes.slice(1)) {
      const actual = [...index.keys()].sort();
      if (
        expected.length !== actual.length ||
        expected.some((currentPath, position) =>
          currentPath !== actual[position]
        )
      ) {
        throw new Error(
          "Provider, consumer, and resolution observations must cover the same source paths",
        );
      }
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

module.exports = { ObservationManifestProjector };
