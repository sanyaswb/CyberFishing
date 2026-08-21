class ConsumerObservationAssembler {
  constructor(environmentClassifier) {
    this.environmentClassifier = environmentClassifier;
  }

  assemble(currentPath, observations) {
    const classified = this.environmentClassifier.classify(
      observations.flatMap((observation) => observation.candidates),
    );
    const issues = this.#uniqueSorted(
      observations.flatMap((observation) => observation.issues),
      (issue) => `${issue.code}\u0000${issue.message}`,
    );
    const dynamicConstructs = this.#uniqueSorted(
      observations.flatMap((observation) => observation.dynamicConstructs),
      (value) => value,
    );
    const status = issues.length > 0 ? "partial" : "verified";
    return {
      currentPath,
      consumers: {
        status,
        items: this.#uniqueSorted(
          classified.consumers,
          (consumer) => this.#consumerKey(consumer),
        ),
        issues,
      },
      environment: {
        status,
        builtins: this.#uniqueSorted(classified.builtins, (value) => value),
        browserApis: this.#uniqueSorted(
          classified.browserApis,
          (value) => value,
        ),
        dynamicConstructs,
        issues,
      },
    };
  }

  failed(currentPath, issue) {
    return {
      currentPath,
      consumers: {
        status: "failed",
        items: [],
        issues: [issue],
      },
      environment: {
        status: "failed",
        builtins: [],
        browserApis: [],
        dynamicConstructs: [],
        issues: [issue],
      },
    };
  }

  #consumerKey(consumer) {
    return `${consumer.symbol}\u0000${consumer.mechanism}\u0000` +
      `${consumer.accessRequirement}\u0000${consumer.executionPhase}`;
  }

  #uniqueSorted(values, keyOf) {
    const unique = new Map();
    for (const value of values) unique.set(keyOf(value), value);
    return [...unique.entries()]
      .sort(([left], [right]) => this.#compareText(left, right))
      .map(([, value]) => value);
  }

  #compareText(left, right) {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }
}

module.exports = { ConsumerObservationAssembler };
