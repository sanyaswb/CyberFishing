const assert = require("node:assert/strict");
const {
  MigrationObservationReconciler,
} = require("./migration/migration_observation_reconciler");
const {
  ManifestDependencyProjector,
} = require("./observation/persistence/manifest_dependency_projector");
const {
  ObservationManifestProjector,
} = require("./observation/persistence/observation_manifest_projector");

class MigrationObservationPersistenceFixtureCheck {
  constructor({ projector, reconciler }) {
    this.projector = projector;
    this.reconciler = reconciler;
  }

  run() {
    const request = this.#request();
    const before = this.#clone(request);
    const patches = this.projector.project(request.observations);
    const first = this.reconciler.reconcile({
      existingManifest: request.manifest,
      observationPatches: patches,
    });
    const second = this.reconciler.reconcile({
      existingManifest: first,
      observationPatches: patches,
    });

    assert.deepEqual(request, before, "Persistence must not mutate inputs");
    assert.deepEqual(second, first, "Persistence must be deterministic");
    assert.equal(JSON.stringify(second), JSON.stringify(first));
    this.#assertReviewedMetadataIsPreserved(first, request.manifest);
    this.#assertFactLevelProvenanceIsLossless(first);
    this.#assertScopeMismatchIsRejected(request, patches);
    console.log(
      "Migration observation persistence fixtures passed: metadata preservation, " +
        "self-resolution, mixed outcomes, deterministic reconcile, and scope guards verified.",
    );
  }

  #assertReviewedMetadataIsPreserved(result, original) {
    const actual = result.modules[0];
    const expected = original.modules[0];
    assert.equal(actual.currentPath, expected.currentPath);
    assert.equal(actual.currentArea, expected.currentArea);
    assert.equal(
      actual.observed.legacyLoadOrder,
      expected.observed.legacyLoadOrder,
    );
    assert.deepEqual(actual.architecture, expected.architecture);
    assert.deepEqual(actual.analysis.blockers, expected.analysis.blockers);
    assert.equal(actual.observed.providers.status, "verified");
    assert.equal(actual.observed.consumers.status, "verified");
  }

  #assertFactLevelProvenanceIsLossless(result) {
    const dependencies = result.modules[0].analysis.dependencies;
    assert.equal(dependencies.confirmed.length, 2);
    assert(dependencies.confirmed.some((record) =>
      record.symbol === "SelfSymbol" && record.target === "src/a.js"
    ));
    assert(dependencies.confirmed.some((record) =>
      record.symbol === "Shared" && record.target === "src/b.js"
    ));
    assert(dependencies.unresolved.some((record) =>
      record.symbol === "Shared" &&
      record.mechanism === "window-property"
    ));
    assert.deepEqual(dependencies.items, [
      {
        target: "src/b.js",
        symbols: ["Shared"],
        resolution: "confirmed",
      },
    ]);
  }

  #assertScopeMismatchIsRejected(request, patches) {
    assert.throws(
      () => this.reconciler.reconcile({
        existingManifest: request.manifest,
        observationPatches: patches.slice(1),
      }),
      /run architecture:manifest/,
    );
    assert.throws(
      () => this.projector.project({
        ...request.observations,
        consumerObservations:
          request.observations.consumerObservations.slice(1),
      }),
      /same source paths/,
    );
  }

  #request() {
    const architecture = {
      migrationStatus: "classified",
      roles: ["domain-contract"],
      targetBoundary: "engine",
      targetPath: null,
      migrationWave: null,
    };
    const blockers = {
      status: "verified",
      items: ["reviewed blocker"],
    };
    const pendingObserved = {
      legacyLoadOrder: null,
      providers: { status: "pending", items: [], issues: [] },
      consumers: { status: "pending", items: [], issues: [] },
      environment: {
        status: "pending",
        builtins: [],
        browserApis: [],
        dynamicConstructs: [],
        issues: [],
      },
    };
    const pendingDependencies = {
      status: "pending",
      confirmed: [],
      items: [],
      unresolved: [],
      ambiguous: [],
      issues: [],
    };
    const selfConsumer = this.#consumer("SelfSymbol", "identifier", "eager");
    const confirmedShared = this.#consumer("Shared", "identifier", "deferred");
    const unresolvedShared = this.#consumer(
      "Shared",
      "window-property",
      "eager",
    );
    const sourceAConsumers = [
      confirmedShared,
      unresolvedShared,
      selfConsumer,
    ].sort((left, right) =>
      this.#consumerKey(left) < this.#consumerKey(right) ? -1 : 1,
    );
    return {
      manifest: {
        schemaVersion: 5,
        modules: [
          {
            currentPath: "src/a.js",
            currentArea: "root",
            observed: { ...this.#clone(pendingObserved), legacyLoadOrder: 2 },
            architecture,
            analysis: { dependencies: pendingDependencies, blockers },
          },
          {
            currentPath: "src/b.js",
            currentArea: "root",
            observed: { ...this.#clone(pendingObserved), legacyLoadOrder: 1 },
            architecture: this.#clone(architecture),
            analysis: {
              dependencies: this.#clone(pendingDependencies),
              blockers: { status: "pending", items: [] },
            },
          },
        ],
      },
      observations: {
        providerObservations: [
          this.#providerObservation("src/a.js", [this.#provider("SelfSymbol")]),
          this.#providerObservation("src/b.js", [this.#provider("Shared")]),
        ],
        consumerObservations: [
          this.#consumerObservation("src/a.js", sourceAConsumers),
          this.#consumerObservation("src/b.js", []),
        ],
        resolutionResult: {
          sources: [
            {
              currentPath: "src/a.js",
              status: "verified",
              confirmed: [
                { ...selfConsumer, target: "src/a.js", resolution: "confirmed" },
                {
                  ...confirmedShared,
                  target: "src/b.js",
                  resolution: "confirmed",
                },
              ].sort((left, right) =>
                this.#consumerKey(left) < this.#consumerKey(right) ? -1 : 1,
              ),
              unresolved: [
                { ...unresolvedShared, resolution: "unresolved" },
              ],
              ambiguous: [],
              issues: [],
            },
            {
              currentPath: "src/b.js",
              status: "verified",
              confirmed: [],
              unresolved: [],
              ambiguous: [],
              issues: [],
            },
          ],
          graph: {
            nodes: ["src/a.js", "src/b.js"],
            edges: [
              {
                source: "src/a.js",
                target: "src/b.js",
                symbols: ["Shared"],
              },
            ],
          },
        },
      },
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

  #provider(symbol) {
    return {
      symbol,
      mechanism: "global-lexical",
      availability: "program-init",
    };
  }

  #consumer(symbol, mechanism, executionPhase) {
    return {
      symbol,
      mechanism,
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

new MigrationObservationPersistenceFixtureCheck({
  projector: new ObservationManifestProjector(
    new ManifestDependencyProjector(),
  ),
  reconciler: new MigrationObservationReconciler(5),
}).run();
