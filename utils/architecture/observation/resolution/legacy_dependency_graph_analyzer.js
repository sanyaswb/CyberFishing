const {
  ProviderCandidateIndex,
} = require("./provider_candidate_index");
const {
  LegacyLoadOrderIndex,
} = require("./legacy_load_order_index");
const {
  ProviderResolutionEngine,
} = require("./provider_resolution_engine");
const {
  InMemoryDependencyGraphBuilder,
} = require("./in_memory_dependency_graph_builder");
const {
  ProviderResolutionContract,
} = require("./provider_resolution_contract");

class LegacyDependencyGraphAnalyzer {
  constructor({
    candidateIndexFactory,
    loadOrderIndexFactory,
    resolutionEngineFactory,
    graphBuilder,
    resolutionContract,
  }) {
    this.candidateIndexFactory = candidateIndexFactory;
    this.loadOrderIndexFactory = loadOrderIndexFactory;
    this.resolutionEngineFactory = resolutionEngineFactory;
    this.graphBuilder = graphBuilder;
    this.contract = resolutionContract;
  }

  analyze({ providerObservations, consumerObservations, legacyScripts }) {
    this.#assertMatchingSourceScope(
      providerObservations,
      consumerObservations,
    );
    const candidateIndex = this.candidateIndexFactory(providerObservations);
    const loadOrderIndex = this.loadOrderIndexFactory(legacyScripts);
    const engine = this.resolutionEngineFactory({
      candidateIndex,
      loadOrderIndex,
    });
    const sources = [...consumerObservations]
      .sort((left, right) =>
        this.#compareText(left.currentPath, right.currentPath),
      )
      .map((observation) => this.#analyzeSource(observation, engine));
    return {
      sources,
      graph: this.graphBuilder.build(sources),
    };
  }

  #analyzeSource(observation, engine) {
    const consumers = observation?.consumers;
    if (!consumers || consumers.status === "pending") {
      throw new Error(
        `Consumer observation is not analyzed: ${observation?.currentPath}`,
      );
    }
    if (!["verified", "partial", "failed"].includes(consumers.status)) {
      throw new Error(
        `Invalid consumer observation status: ${observation?.currentPath}`,
      );
    }
    if (consumers.status === "failed") {
      return {
        currentPath: observation.currentPath,
        status: "failed",
        confirmed: [],
        unresolved: [],
        ambiguous: [],
        issues: this.#uniqueIssues(consumers.issues || []),
      };
    }

    const buckets = {
      confirmed: [],
      unresolved: [],
      ambiguous: [],
    };
    const issues = [...(consumers.issues || [])];
    const consumerKeys = new Set();
    for (const consumer of consumers.items || []) {
      const consumerKey = this.contract.consumerKey(consumer);
      if (consumerKeys.has(consumerKey)) {
        throw new Error(
          `Duplicate consumer observation: ${observation.currentPath} consumes ${consumer.symbol}`,
        );
      }
      consumerKeys.add(consumerKey);
      const outcome = engine.resolve({
        currentPath: observation.currentPath,
        consumer,
      });
      buckets[outcome.kind].push(outcome.record);
      issues.push(...outcome.issues);
    }
    for (const records of Object.values(buckets)) {
      records.sort((left, right) =>
        this.#compareText(this.contract.consumerKey(left), this.contract.consumerKey(right)),
      );
    }
    const uniqueIssues = this.#uniqueIssues(issues);
    return {
      currentPath: observation.currentPath,
      status:
        consumers.status === "partial" || uniqueIssues.length > 0
          ? "partial"
          : "verified",
      confirmed: buckets.confirmed,
      unresolved: buckets.unresolved,
      ambiguous: buckets.ambiguous,
      issues: uniqueIssues,
    };
  }

  #assertMatchingSourceScope(providerObservations, consumerObservations) {
    const providerPaths = this.#uniquePaths(providerObservations, "provider");
    const consumerPaths = this.#uniquePaths(consumerObservations, "consumer");
    if (
      providerPaths.length !== consumerPaths.length ||
      providerPaths.some((currentPath, index) =>
        currentPath !== consumerPaths[index]
      )
    ) {
      throw new Error(
        "Provider and consumer observations must cover the same source paths",
      );
    }
  }

  #uniquePaths(observations, kind) {
    const paths = observations.map((observation) => observation?.currentPath);
    const unique = [...new Set(paths)].sort((left, right) =>
      this.#compareText(left, right),
    );
    if (
      unique.length !== paths.length ||
      unique.some((currentPath) =>
        typeof currentPath !== "string" || currentPath.length === 0
      )
    ) {
      throw new Error(`Invalid or duplicate ${kind} observation source path`);
    }
    return unique;
  }

  #uniqueIssues(issues) {
    const byKey = new Map();
    for (const issue of issues) {
      byKey.set(`${issue.code}\u0000${issue.message}`, {
        code: issue.code,
        message: issue.message,
      });
    }
    return [...byKey.values()].sort((left, right) =>
      this.#compareText(left.code, right.code) ||
      this.#compareText(left.message, right.message),
    );
  }

  #compareText(left, right) {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }
}

class LegacyDependencyGraphAnalyzerFactory {
  create(resolutionModel) {
    const resolutionContract = new ProviderResolutionContract(resolutionModel);
    return new LegacyDependencyGraphAnalyzer({
      candidateIndexFactory: (observations) =>
        new ProviderCandidateIndex(observations),
      loadOrderIndexFactory: (legacyScripts) =>
        new LegacyLoadOrderIndex(legacyScripts),
      resolutionEngineFactory: ({ candidateIndex, loadOrderIndex }) =>
        new ProviderResolutionEngine({
          candidateIndex,
          loadOrderIndex,
          resolutionContract,
        }),
      graphBuilder: new InMemoryDependencyGraphBuilder(resolutionContract),
      resolutionContract,
    });
  }
}

module.exports = {
  LegacyDependencyGraphAnalyzer,
  LegacyDependencyGraphAnalyzerFactory,
};
