const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const MANIFEST_PATH = path.join(
  PROJECT_ROOT,
  "architecture",
  "migration",
  "module_migration_manifest.json",
);

class ClassificationEvidenceCorpusCheck {
  constructor({ manifestPath, classificationContract }) {
    this.manifestPath = manifestPath;
    this.contract = classificationContract;
  }

  run() {
    const bytesBefore = fs.readFileSync(this.manifestPath, "utf8");
    const manifest = JSON.parse(bytesBefore);
    const first = this.#analyze(manifest);
    const second = this.#analyze(manifest);

    assert.deepEqual(second, first, "Corpus evidence must be deterministic");
    assert.equal(
      fs.readFileSync(this.manifestPath, "utf8"),
      bytesBefore,
      "Corpus evidence must not mutate the migration manifest",
    );
    assert.equal(first.evidence.length, manifest.modules.length);
    this.#assertEvidenceShape(first.evidence);
    this.#assertCandidates(first.candidates);

    const browserCoupled = first.evidence.filter((entry) =>
      entry.metrics.browserApiCount > 0
    ).length;
    const reviewed = first.evidence.filter((entry) =>
      entry.decision.migrationStatus !== "legacy"
    );
    const reviewedWithBlockers = reviewed.filter((entry) =>
      entry.decision.blockers.items.length > 0
    ).length;
    const topCandidates = first.candidates.slice(0, 8)
      .map((candidate) => candidate.currentPath)
      .join(", ");
    console.log(
      "Classification evidence corpus passed: " +
        `${first.evidence.length} modules, ${first.candidates.length} ` +
        `conservative leaf review candidates, ${browserCoupled} ` +
        `browser-coupled modules; ${reviewed.length} reviewed decisions ` +
        `(${reviewedWithBlockers} with blockers).` +
        (topCandidates ? `\nTop review candidates: ${topCandidates}` : ""),
    );
  }

  #analyze(manifest) {
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
    for (const entry of evidence) {
      assert.deepEqual(Object.keys(entry), this.contract.evidenceEntryFields);
      assert.deepEqual(
        Object.keys(entry.decision),
        this.contract.decisionEntryFields,
      );
      assert.deepEqual(Object.keys(entry.metrics), this.contract.metricFields);
    }
  }

  #assertCandidates(candidates) {
    for (const candidate of candidates) {
      assert.deepEqual(
        Object.keys(candidate),
        this.contract.candidateSelection.resultFields,
      );
      assert.equal(candidate.reviewRequired, true);
      for (const decisionField of this.contract.decisionFields) {
        assert.equal(Object.hasOwn(candidate, decisionField), false);
      }
    }
  }
}

new ClassificationEvidenceCorpusCheck({
  manifestPath: MANIFEST_PATH,
  classificationContract:
    architecture.migrationManifest.classificationContract,
}).run();
