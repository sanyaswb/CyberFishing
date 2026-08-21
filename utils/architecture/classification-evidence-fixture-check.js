const assert = require("node:assert/strict");
const architecture = require("../../architecture/module_architecture.json");
const {
  ClassificationEvidenceBuilder,
} = require("./classification/classification_evidence_builder");
const {
  ConservativeLeafCandidateRanker,
} = require("./classification/conservative_leaf_candidate_ranker");
const {
  PersistedDependencyGraph,
} = require("./observation/integrity/persisted_dependency_graph");
const {
  DerivedReverseConsumerIndex,
} = require("./observation/integrity/derived_reverse_consumer_index");

class ClassificationEvidenceFixtureCheck {
  constructor(classificationContract) {
    this.contract = classificationContract;
  }

  run() {
    const manifest = this.#manifest();
    const before = this.#clone(manifest);
    const first = this.#build(manifest);
    const second = this.#build(manifest);

    assert.deepEqual(second, first, "Classification evidence must be deterministic");
    assert.deepEqual(manifest, before, "Classification evidence must be read-only");
    this.#assertEvidenceShape(first.evidence);
    this.#assertMetrics(first.evidence);
    this.#assertCandidates(first.candidates);
    this.#assertUncertaintyIsExcluded(first.candidates);

    console.log("Classification evidence fixtures passed (5 cases).");
  }

  #build(manifest) {
    const graph = new PersistedDependencyGraph(manifest);
    const reverseConsumerIndex = new DerivedReverseConsumerIndex(graph);
    const evidence = new ClassificationEvidenceBuilder({
      manifest,
      graph,
      reverseConsumerIndex,
    }).build();
    const candidates = new ConservativeLeafCandidateRanker(
      this.contract.candidateSelection,
    ).rank(evidence);
    return { evidence, candidates };
  }

  #assertEvidenceShape(evidence) {
    assert.equal(evidence.length, 4);
    for (const entry of evidence) {
      assert.deepEqual(Object.keys(entry), this.contract.evidenceEntryFields);
      assert.deepEqual(
        Object.keys(entry.decision),
        this.contract.decisionEntryFields,
      );
      assert.deepEqual(Object.keys(entry.metrics), this.contract.metricFields);
      assert.equal(entry.decision.targetBoundary, null);
      assert.equal(entry.decision.targetPath, null);
      assert.deepEqual(entry.decision.roles, []);
      assert.equal(entry.decision.migrationWave, null);
    }
  }

  #assertMetrics(evidence) {
    const byPath = new Map(evidence.map((entry) => [entry.currentPath, entry]));
    assert.equal(byPath.get("src/a.js").metrics.incomingEdgeCount, 1);
    assert.equal(byPath.get("src/a.js").metrics.outgoingEdgeCount, 0);
    assert.equal(byPath.get("src/b.js").metrics.outgoingEdgeCount, 1);
    assert.equal(byPath.get("src/c.js").metrics.browserApiCount, 1);
    assert.equal(byPath.get("src/d.js").metrics.unresolvedCount, 1);
    assert.deepEqual(byPath.get("src/a.js").dependencies.incoming, [
      { source: "src/b.js", symbols: ["A"] },
    ]);
  }

  #assertCandidates(candidates) {
    assert.deepEqual(candidates, [
      {
        currentPath: "src/a.js",
        incomingEdgeCount: 1,
        providerCount: 1,
        browserApiCount: 0,
        legacyLoadOrder: 1,
        reviewRequired: true,
      },
      {
        currentPath: "src/c.js",
        incomingEdgeCount: 0,
        providerCount: 1,
        browserApiCount: 1,
        legacyLoadOrder: 3,
        reviewRequired: true,
      },
    ]);
    for (const candidate of candidates) {
      assert.deepEqual(
        Object.keys(candidate),
        this.contract.candidateSelection.resultFields,
      );
      for (const decisionField of this.contract.decisionFields) {
        assert.equal(
          Object.hasOwn(candidate, decisionField),
          false,
          `Candidate must not assign ${decisionField}`,
        );
      }
    }
  }

  #assertUncertaintyIsExcluded(candidates) {
    assert.equal(candidates.some((candidate) =>
      candidate.currentPath === "src/b.js"
    ), false, "Non-leaf sources must be excluded");
    assert.equal(candidates.some((candidate) =>
      candidate.currentPath === "src/d.js"
    ), false, "Unresolved sources must be excluded");
  }

  #manifest() {
    return {
      schemaVersion: 5,
      modules: [
        this.#entry({ currentPath: "src/a.js", order: 1, symbol: "A" }),
        this.#entry({
          currentPath: "src/b.js",
          order: 2,
          symbol: "B",
          consumer: "A",
          target: "src/a.js",
        }),
        this.#entry({
          currentPath: "src/c.js",
          order: 3,
          symbol: "C",
          browserApis: ["document"],
        }),
        this.#entry({
          currentPath: "src/d.js",
          order: 4,
          symbol: "D",
          consumer: "Missing",
        }),
      ],
    };
  }

  #entry({ currentPath, order, symbol, consumer, target, browserApis = [] }) {
    const consumerRecord = consumer ? {
      symbol: consumer,
      mechanism: "identifier",
      accessRequirement: "required",
      executionPhase: "deferred",
    } : null;
    const confirmed = consumerRecord && target ? [{
      ...consumerRecord,
      target,
      resolution: "confirmed",
    }] : [];
    const unresolved = consumerRecord && !target ? [{
      ...consumerRecord,
      resolution: "unresolved",
    }] : [];
    return {
      currentPath,
      currentArea: "root",
      observed: {
        legacyLoadOrder: order,
        providers: {
          status: "verified",
          items: [{
            symbol,
            mechanism: "global-lexical",
            availability: "program-init",
          }],
          issues: [],
        },
        consumers: {
          status: "verified",
          items: consumerRecord ? [consumerRecord] : [],
          issues: [],
        },
        environment: {
          status: "verified",
          builtins: [],
          browserApis,
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
          items: target ? [{
            target,
            symbols: [consumer],
            resolution: "confirmed",
          }] : [],
          unresolved,
          ambiguous: [],
          issues: [],
        },
        blockers: { status: "pending", items: [] },
      },
    };
  }

  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
}

new ClassificationEvidenceFixtureCheck(
  architecture.migrationManifest.classificationContract,
).run();
