const assert = require("node:assert/strict");
const architecture = require("../../architecture/module_architecture.json");
const {
  PersistedDependencyGraph,
} = require("./observation/integrity/persisted_dependency_graph");
const {
  DerivedReverseConsumerIndex,
} = require("./observation/integrity/derived_reverse_consumer_index");
const {
  ObservationGraphIntegrityValidator,
} = require(
  "./observation/integrity/observation_graph_integrity_validator"
);

class ObservationGraphIntegrityFixtureCheck {
  constructor(validator) {
    this.validator = validator;
  }

  run() {
    this.#assertValidGraphAndReverseIndex();
    this.#assertUnknownTargetIsRejected();
    this.#assertSelfEdgeIsRejected();
    this.#assertDuplicateEdgeIsRejected();
    this.#assertUnsortedSymbolsAreRejected();
    this.#assertPersistedReverseConsumersAreRejected();
    this.#assertMissingResolutionIsRejected();
    this.#assertDuplicateResolutionIsRejected();
    this.#assertMissingConfirmedEdgeIsRejected();
    this.#assertSpeculativeEdgeIsRejected();
    this.#assertPendingObservationIsRejected();
    console.log("Observation graph integrity fixtures passed (11 cases).");
  }

  #assertValidGraphAndReverseIndex() {
    const manifest = this.#manifest();
    const before = this.#clone(manifest);
    const graph = new PersistedDependencyGraph(manifest);
    const reverse = new DerivedReverseConsumerIndex(graph);
    const summary = this.validator.validate({
      manifest,
      graph,
      reverseConsumerIndex: reverse,
    });
    assert.deepEqual(manifest, before);
    assert.deepEqual(graph.nodes(), ["src/a.js", "src/b.js", "src/c.js"]);
    assert.deepEqual(reverse.consumersOf("src/b.js"), [
      { source: "src/a.js", symbols: ["Fish"] },
      { source: "src/c.js", symbols: ["Fish"] },
    ]);
    assert.deepEqual(reverse.consumersOf("src/a.js"), []);
    assert.deepEqual(summary, {
      modules: 3,
      consumers: 4,
      confirmed: 3,
      selfConfirmed: 1,
      unresolved: 1,
      ambiguous: 0,
      edges: 2,
      reverseLinks: 2,
      targetsWithConsumers: 1,
    });
  }

  #assertUnknownTargetIsRejected() {
    const manifest = this.#manifest();
    manifest.modules[0].analysis.dependencies.items[0].target =
      "src/missing.js";
    assert.throws(
      () => new PersistedDependencyGraph(manifest),
      /targets unknown source/,
    );
  }

  #assertSelfEdgeIsRejected() {
    const manifest = this.#manifest();
    manifest.modules[0].analysis.dependencies.items.unshift({
      target: "src/a.js",
      symbols: ["SelfSymbol"],
      resolution: "confirmed",
    });
    assert.throws(
      () => new PersistedDependencyGraph(manifest),
      /self-resolution must not create a graph edge/,
    );
  }

  #assertDuplicateEdgeIsRejected() {
    const manifest = this.#manifest();
    const edge = manifest.modules[0].analysis.dependencies.items[0];
    manifest.modules[0].analysis.dependencies.items.push(this.#clone(edge));
    assert.throws(
      () => new PersistedDependencyGraph(manifest),
      /dependency targets must be sorted and unique/,
    );
  }

  #assertUnsortedSymbolsAreRejected() {
    const manifest = this.#manifest();
    manifest.modules[0].analysis.dependencies.items[0].symbols = [
      "Zed",
      "Fish",
    ];
    assert.throws(
      () => new PersistedDependencyGraph(manifest),
      /edge symbols must be sorted and unique/,
    );
  }

  #assertPersistedReverseConsumersAreRejected() {
    const manifest = this.#manifest();
    manifest.modules[1].analysis.reverseConsumers = [];
    assert.throws(
      () => new PersistedDependencyGraph(manifest),
      /reverse consumers must remain derived-only/,
    );
  }

  #assertMissingResolutionIsRejected() {
    const manifest = this.#manifest();
    manifest.modules[0].observed.consumers.items.push(
      this.#consumer("UnresolvedWithoutOutcome", "deferred"),
    );
    manifest.modules[0].observed.consumers.items.sort((left, right) =>
      this.#consumerKey(left) < this.#consumerKey(right) ? -1 : 1,
    );
    assert.throws(
      () => this.#validate(manifest),
      /exactly one resolution outcome/,
    );
  }

  #assertDuplicateResolutionIsRejected() {
    const manifest = this.#manifest();
    const confirmed = manifest.modules[0].analysis.dependencies.confirmed[0];
    manifest.modules[0].analysis.dependencies.unresolved.unshift({
      symbol: confirmed.symbol,
      mechanism: confirmed.mechanism,
      accessRequirement: confirmed.accessRequirement,
      executionPhase: confirmed.executionPhase,
      resolution: "unresolved",
    });
    assert.throws(
      () => this.#validate(manifest),
      /resolution outcomes must not contain duplicates/,
    );
  }

  #assertMissingConfirmedEdgeIsRejected() {
    const manifest = this.#manifest();
    manifest.modules[0].analysis.dependencies.items = [];
    assert.throws(
      () => this.#validate(manifest),
      /do not match fact-level confirmed provenance/,
    );
  }

  #assertSpeculativeEdgeIsRejected() {
    const manifest = this.#manifest();
    manifest.modules[1].analysis.dependencies.items = [
      {
        target: "src/c.js",
        symbols: ["Speculative"],
        resolution: "confirmed",
      },
    ];
    assert.throws(
      () => this.#validate(manifest),
      /do not match fact-level confirmed provenance/,
    );
  }

  #assertPendingObservationIsRejected() {
    const manifest = this.#manifest();
    manifest.modules[0].observed.environment.status = "pending";
    assert.throws(
      () => this.#validate(manifest),
      /environment observation is not persisted/,
    );
  }

  #validate(manifest) {
    const graph = new PersistedDependencyGraph(manifest);
    return this.validator.validate({
      manifest,
      graph,
      reverseConsumerIndex: new DerivedReverseConsumerIndex(graph),
    });
  }

  #manifest() {
    const fishEager = this.#consumer("Fish", "eager");
    const optional = {
      ...this.#consumer("Optional", "conditional"),
      accessRequirement: "guarded",
    };
    const self = this.#consumer("SelfSymbol", "deferred");
    const fishDeferred = this.#consumer("Fish", "deferred");
    return {
      schemaVersion: 5,
      modules: [
        this.#entry({
          currentPath: "src/a.js",
          consumers: [fishEager, optional, self],
          confirmed: [
            { ...fishEager, target: "src/b.js", resolution: "confirmed" },
            { ...self, target: "src/a.js", resolution: "confirmed" },
          ],
          unresolved: [{ ...optional, resolution: "unresolved" }],
          items: [
            {
              target: "src/b.js",
              symbols: ["Fish"],
              resolution: "confirmed",
            },
          ],
        }),
        this.#entry({ currentPath: "src/b.js" }),
        this.#entry({
          currentPath: "src/c.js",
          consumers: [fishDeferred],
          confirmed: [
            {
              ...fishDeferred,
              target: "src/b.js",
              resolution: "confirmed",
            },
          ],
          items: [
            {
              target: "src/b.js",
              symbols: ["Fish"],
              resolution: "confirmed",
            },
          ],
        }),
      ],
    };
  }

  #entry({
    currentPath,
    consumers = [],
    confirmed = [],
    unresolved = [],
    ambiguous = [],
    items = [],
  }) {
    return {
      currentPath,
      currentArea: "root",
      observed: {
        legacyLoadOrder: null,
        providers: { status: "verified", items: [], issues: [] },
        consumers: { status: "verified", items: consumers, issues: [] },
        environment: {
          status: "verified",
          builtins: [],
          browserApis: [],
          dynamicConstructs: [],
          issues: [],
        },
      },
      architecture: {
        migrationStatus: "legacy",
        roles: [],
        targetBoundary: null,
        targetPath: null,
        migrationWave: null,
      },
      analysis: {
        dependencies: {
          status: "verified",
          confirmed,
          items,
          unresolved,
          ambiguous,
          issues: [],
        },
        blockers: { status: "pending", items: [] },
      },
    };
  }

  #consumer(symbol, executionPhase) {
    return {
      symbol,
      mechanism: "identifier",
      accessRequirement: "required",
      executionPhase,
    };
  }

  #consumerKey(record) {
    return `${record.symbol}\u0000${record.mechanism}\u0000` +
      `${record.accessRequirement}\u0000${record.executionPhase}`;
  }

  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
}

const resolutionModel =
  architecture.migrationManifest.observationContract.resolutionModel;
new ObservationGraphIntegrityFixtureCheck(
  new ObservationGraphIntegrityValidator(resolutionModel),
).run();
