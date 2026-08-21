const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const MANIFEST_PATH = path.join(
  PROJECT_ROOT,
  "architecture",
  "migration",
  "module_migration_manifest.json",
);

class ObservationGraphIntegrityCorpusCheck {
  constructor({ manifestPath, validator, integrityModel }) {
    this.manifestPath = manifestPath;
    this.validator = validator;
    this.integrityModel = integrityModel;
  }

  run() {
    const manifestBefore = fs.readFileSync(this.manifestPath, "utf8");
    const manifest = JSON.parse(manifestBefore);
    const first = this.#analyze(manifest);
    const second = this.#analyze(manifest);
    assert.deepEqual(second, first, "Integrity analysis must be deterministic");
    assert.equal(
      fs.readFileSync(this.manifestPath, "utf8"),
      manifestBefore,
      "Observation graph integrity check must remain read-only",
    );
    this.#assertShapes(first.graph, first.reverseEntries);
    assert.equal(
      first.summary.confirmed +
        first.summary.unresolved +
        first.summary.ambiguous,
      first.summary.consumers,
    );
    assert.equal(first.summary.edges, first.summary.reverseLinks);
    console.log(
      "Observation graph integrity corpus passed: " +
        `${first.summary.modules} nodes, ${first.summary.consumers} consumers, ` +
        `${first.summary.confirmed} confirmed ` +
        `(${first.summary.selfConfirmed} self), ` +
        `${first.summary.unresolved} unresolved, ` +
        `${first.summary.ambiguous} ambiguous, ${first.summary.edges} edges, ` +
        `${first.summary.targetsWithConsumers} targets with derived consumers.`,
    );
  }

  #analyze(manifest) {
    const graph = new PersistedDependencyGraph(manifest);
    const reverseIndex = new DerivedReverseConsumerIndex(graph);
    return {
      graph: { nodes: graph.nodes(), edges: graph.edges() },
      reverseEntries: reverseIndex.entries(),
      summary: this.validator.validate({
        manifest,
        graph,
        reverseConsumerIndex: reverseIndex,
      }),
    };
  }

  #assertShapes(graph, reverseEntries) {
    for (const edge of graph.edges) {
      assert.deepEqual(Object.keys(edge), this.integrityModel.persistedEdgeFields);
    }
    for (const entry of reverseEntries) {
      assert.deepEqual(Object.keys(entry), this.integrityModel.reverseEntryFields);
      for (const consumer of entry.consumers) {
        assert.deepEqual(
          Object.keys(consumer),
          this.integrityModel.reverseConsumerFields,
        );
      }
    }
  }
}

const observationContract = architecture.migrationManifest.observationContract;
new ObservationGraphIntegrityCorpusCheck({
  manifestPath: MANIFEST_PATH,
  validator: new ObservationGraphIntegrityValidator(
    observationContract.resolutionModel,
  ),
  integrityModel: observationContract.integrityModel,
}).run();
