const assert = require("node:assert/strict");
const architecture = require("../../architecture/module_architecture.json");
const {
  LegacyDependencyGraphAnalyzerFactory,
} = require(
  "./observation/resolution/legacy_dependency_graph_analyzer"
);

class ProviderResolutionEngineFixtureCheck {
  constructor(analyzer) {
    this.analyzer = analyzer;
  }

  run() {
    this.#assertSingleProviderConfirmsEdge();
    this.#assertGuardedMissingProviderRemainsUnresolved();
    this.#assertDistinctSourcesRemainAmbiguous();
    this.#assertSameSourceProviderFactsAreGrouped();
    this.#assertSelfResolutionCreatesNoEdge();
    this.#assertSelfProviderHasNoAutomaticPreference();
    this.#assertMechanismCompatibilityIsRequired();
    this.#assertExecutionPhaseRules();
    this.#assertProviderAvailabilityIsRequired();
    this.#assertMissingLoadOrderProducesPartialResult();
    this.#assertIncompleteProviderCorpusSuppressesConfirmation();
    this.#assertEnvironmentObservationsDoNotCreateResolutions();
    this.#assertGraphEdgesAggregateSortedUniqueSymbols();
    this.#assertInputsRemainImmutableAndResultsDeterministic();
    this.#assertIncompleteInputsAreRejected();
    console.log("Provider resolution fixtures passed (15 cases).");
  }

  #assertSingleProviderConfirmsEdge() {
    const result = this.#analyze({
      providers: {
        "src/provider.js": [this.#provider("Fish")],
        "src/consumer.js": [],
      },
      consumers: {
        "src/provider.js": [],
        "src/consumer.js": [this.#consumer("Fish")],
      },
      orders: { "src/provider.js": 1, "src/consumer.js": 2 },
    });
    const source = this.#source(result, "src/consumer.js");
    assert.equal(source.confirmed.length, 1);
    assert.deepEqual(source.confirmed[0], {
      ...this.#consumer("Fish"),
      target: "src/provider.js",
      resolution: "confirmed",
    });
    assert.deepEqual(result.graph.edges, [
      {
        source: "src/consumer.js",
        target: "src/provider.js",
        symbols: ["Fish"],
      },
    ]);
  }

  #assertGuardedMissingProviderRemainsUnresolved() {
    const guarded = this.#consumer("GodMode", {
      accessRequirement: "guarded",
      executionPhase: "conditional",
    });
    const result = this.#analyze({
      providers: { "src/consumer.js": [] },
      consumers: { "src/consumer.js": [guarded] },
      orders: { "src/consumer.js": 1 },
    });
    assert.deepEqual(this.#source(result, "src/consumer.js").unresolved, [
      { ...guarded, resolution: "unresolved" },
    ]);
    assert.deepEqual(result.graph.edges, []);
  }

  #assertDistinctSourcesRemainAmbiguous() {
    const result = this.#analyze({
      providers: {
        "src/a.js": [this.#provider("Fish")],
        "src/b.js": [this.#provider("Fish")],
        "src/consumer.js": [],
      },
      consumers: {
        "src/a.js": [],
        "src/b.js": [],
        "src/consumer.js": [this.#consumer("Fish")],
      },
      orders: { "src/a.js": 1, "src/b.js": 2, "src/consumer.js": 3 },
    });
    assert.deepEqual(this.#source(result, "src/consumer.js").ambiguous, [
      {
        ...this.#consumer("Fish"),
        resolution: "ambiguous",
        candidates: ["src/a.js", "src/b.js"],
      },
    ]);
    assert.deepEqual(result.graph.edges, []);
  }

  #assertSameSourceProviderFactsAreGrouped() {
    const result = this.#analyze({
      providers: {
        "src/provider.js": [
          this.#provider("Fish", { mechanism: "global-lexical" }),
          this.#provider("Fish", { mechanism: "window-property" }),
        ],
        "src/consumer.js": [],
      },
      consumers: {
        "src/provider.js": [],
        "src/consumer.js": [this.#consumer("Fish")],
      },
      orders: { "src/provider.js": 1, "src/consumer.js": 2 },
    });
    assert.equal(this.#source(result, "src/consumer.js").confirmed.length, 1);
  }

  #assertSelfResolutionCreatesNoEdge() {
    const result = this.#analyze({
      providers: { "src/self.js": [this.#provider("Fish")] },
      consumers: { "src/self.js": [this.#consumer("Fish")] },
      orders: { "src/self.js": 1 },
    });
    assert.equal(
      this.#source(result, "src/self.js").confirmed[0].target,
      "src/self.js",
    );
    assert.deepEqual(result.graph.edges, []);
  }

  #assertSelfProviderHasNoAutomaticPreference() {
    const result = this.#analyze({
      providers: {
        "src/external.js": [this.#provider("Fish")],
        "src/self.js": [this.#provider("Fish")],
      },
      consumers: {
        "src/external.js": [],
        "src/self.js": [this.#consumer("Fish")],
      },
      orders: { "src/external.js": 1, "src/self.js": 2 },
    });
    assert.deepEqual(this.#source(result, "src/self.js").ambiguous[0].candidates, [
      "src/external.js",
      "src/self.js",
    ]);
  }

  #assertMechanismCompatibilityIsRequired() {
    const result = this.#analyze({
      providers: {
        "src/provider.js": [this.#provider("Fish")],
        "src/consumer.js": [],
      },
      consumers: {
        "src/provider.js": [],
        "src/consumer.js": [this.#consumer("Fish", {
          mechanism: "window-property",
        })],
      },
      orders: { "src/provider.js": 1, "src/consumer.js": 2 },
    });
    assert.equal(this.#source(result, "src/consumer.js").unresolved.length, 1);
  }

  #assertExecutionPhaseRules() {
    const laterProvider = {
      providers: {
        "src/consumer.js": [],
        "src/provider.js": [this.#provider("Fish")],
      },
      orders: { "src/consumer.js": 1, "src/provider.js": 2 },
    };
    for (const executionPhase of ["eager", "conditional"]) {
      const result = this.#analyze({
        ...laterProvider,
        consumers: {
          "src/consumer.js": [this.#consumer("Fish", { executionPhase })],
          "src/provider.js": [],
        },
      });
      assert.equal(
        this.#source(result, "src/consumer.js").unresolved.length,
        1,
        executionPhase,
      );
    }
    const deferred = this.#analyze({
      ...laterProvider,
      consumers: {
        "src/consumer.js": [this.#consumer("Fish", {
          executionPhase: "deferred",
        })],
        "src/provider.js": [],
      },
    });
    assert.equal(this.#source(deferred, "src/consumer.js").confirmed.length, 1);
  }

  #assertProviderAvailabilityIsRequired() {
    for (const availability of ["conditional", "deferred"]) {
      const result = this.#analyze({
        providers: {
          "src/provider.js": [this.#provider("Fish", { availability })],
          "src/consumer.js": [],
        },
        consumers: {
          "src/provider.js": [],
          "src/consumer.js": [this.#consumer("Fish")],
        },
        orders: { "src/provider.js": 1, "src/consumer.js": 2 },
      });
      assert.equal(
        this.#source(result, "src/consumer.js").unresolved.length,
        1,
        availability,
      );
    }
  }

  #assertMissingLoadOrderProducesPartialResult() {
    const result = this.#analyze({
      providers: {
        "src/provider.js": [this.#provider("Fish")],
        "src/consumer.js": [],
      },
      consumers: {
        "src/provider.js": [],
        "src/consumer.js": [this.#consumer("Fish")],
      },
      orders: { "src/provider.js": null, "src/consumer.js": 2 },
    });
    const source = this.#source(result, "src/consumer.js");
    assert.equal(source.status, "partial");
    assert.equal(source.unresolved.length, 1);
    assert(source.issues.some((issue) =>
      issue.code === "missing-legacy-load-order"
    ));
  }

  #assertIncompleteProviderCorpusSuppressesConfirmation() {
    const result = this.#analyze({
      providers: {
        "src/provider.js": {
          status: "partial",
          items: [this.#provider("Fish")],
          issues: [{ code: "dynamic", message: "Dynamic provider evidence." }],
        },
        "src/consumer.js": [],
      },
      consumers: {
        "src/provider.js": [],
        "src/consumer.js": [this.#consumer("Fish")],
      },
      orders: { "src/provider.js": 1, "src/consumer.js": 2 },
    });
    const source = this.#source(result, "src/consumer.js");
    assert.equal(source.status, "partial");
    assert.equal(source.confirmed.length, 0);
    assert.equal(source.unresolved.length, 1);
    assert(source.issues.some((issue) =>
      issue.code === "provider-corpus-incomplete"
    ));
  }

  #assertEnvironmentObservationsDoNotCreateResolutions() {
    const providers = [this.#providerObservation("src/file.js", [])];
    const consumers = [this.#consumerObservation("src/file.js", [])];
    consumers[0].environment.browserApis = ["document"];
    const result = this.analyzer.analyze({
      providerObservations: providers,
      consumerObservations: consumers,
      legacyScripts: [this.#script("src/file.js", 1)],
    });
    const source = result.sources[0];
    assert.equal(
      source.confirmed.length + source.unresolved.length + source.ambiguous.length,
      0,
    );
    assert.deepEqual(result.graph.edges, []);
  }

  #assertGraphEdgesAggregateSortedUniqueSymbols() {
    const consumers = [
      this.#consumer("GameClock", { executionPhase: "eager" }),
      this.#consumer("Fish", { executionPhase: "eager" }),
      this.#consumer("Fish", { executionPhase: "deferred" }),
    ];
    const result = this.#analyze({
      providers: {
        "src/provider.js": [
          this.#provider("Fish"),
          this.#provider("GameClock"),
        ],
        "src/consumer.js": [],
      },
      consumers: {
        "src/provider.js": [],
        "src/consumer.js": consumers,
      },
      orders: { "src/provider.js": 1, "src/consumer.js": 2 },
    });
    assert.equal(this.#source(result, "src/consumer.js").confirmed.length, 3);
    assert.deepEqual(result.graph.edges[0].symbols, ["Fish", "GameClock"]);
  }

  #assertInputsRemainImmutableAndResultsDeterministic() {
    const request = this.#request({
      providers: {
        "src/provider.js": [this.#provider("Fish")],
        "src/consumer.js": [],
      },
      consumers: {
        "src/provider.js": [],
        "src/consumer.js": [this.#consumer("Fish")],
      },
      orders: { "src/provider.js": 1, "src/consumer.js": 2 },
    });
    const before = this.#clone(request);
    const first = this.analyzer.analyze(request);
    const second = this.analyzer.analyze(request);
    assert.deepEqual(request, before);
    assert.deepEqual(second, first);
  }

  #assertIncompleteInputsAreRejected() {
    assert.throws(
      () => this.analyzer.analyze({
        providerObservations: [this.#providerObservation("src/a.js", [])],
        consumerObservations: [this.#consumerObservation("src/b.js", [])],
        legacyScripts: [],
      }),
      /same source paths/,
    );
    const pending = this.#consumerObservation("src/a.js", []);
    pending.consumers.status = "pending";
    assert.throws(
      () => this.analyzer.analyze({
        providerObservations: [this.#providerObservation("src/a.js", [])],
        consumerObservations: [pending],
        legacyScripts: [],
      }),
      /not analyzed/,
    );
    const duplicateConsumer = this.#consumer("Fish");
    assert.throws(
      () => this.#analyze({
        providers: { "src/a.js": [] },
        consumers: { "src/a.js": [duplicateConsumer, duplicateConsumer] },
        orders: { "src/a.js": 1 },
      }),
      /Duplicate consumer observation/,
    );
    const duplicateProvider = this.#provider("Fish");
    assert.throws(
      () => this.#analyze({
        providers: { "src/a.js": [duplicateProvider, duplicateProvider] },
        consumers: { "src/a.js": [] },
        orders: { "src/a.js": 1 },
      }),
      /Duplicate provider fact/,
    );
  }

  #analyze(input) {
    return this.analyzer.analyze(this.#request(input));
  }

  #request({ providers, consumers, orders }) {
    const paths = [...new Set([
      ...Object.keys(providers),
      ...Object.keys(consumers),
    ])].sort();
    return {
      providerObservations: paths.map((currentPath) => {
        const value = providers[currentPath] || [];
        return Array.isArray(value)
          ? this.#providerObservation(currentPath, value)
          : { currentPath, providers: value };
      }),
      consumerObservations: paths.map((currentPath) =>
        this.#consumerObservation(currentPath, consumers[currentPath] || []),
      ),
      legacyScripts: paths.map((currentPath) =>
        this.#script(currentPath, orders[currentPath] ?? null),
      ),
    };
  }

  #providerObservation(currentPath, items) {
    return {
      currentPath,
      providers: { status: "verified", items, issues: [] },
    };
  }

  #consumerObservation(currentPath, items) {
    return {
      currentPath,
      consumers: { status: "verified", items, issues: [] },
      environment: {
        status: "verified",
        builtins: [],
        browserApis: [],
        dynamicConstructs: [],
        issues: [],
      },
    };
  }

  #provider(symbol, overrides = {}) {
    return {
      symbol,
      mechanism: "global-lexical",
      availability: "program-init",
      ...overrides,
    };
  }

  #consumer(symbol, overrides = {}) {
    return {
      symbol,
      mechanism: "identifier",
      accessRequirement: "required",
      executionPhase: "eager",
      ...overrides,
    };
  }

  #script(currentPath, legacyLoadOrder) {
    return { currentPath, legacyLoadOrder };
  }

  #source(result, currentPath) {
    return result.sources.find((source) => source.currentPath === currentPath);
  }

  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
}

const model = architecture.migrationManifest.observationContract.resolutionModel;
new ProviderResolutionEngineFixtureCheck(
  new LegacyDependencyGraphAnalyzerFactory().create(model),
).run();
