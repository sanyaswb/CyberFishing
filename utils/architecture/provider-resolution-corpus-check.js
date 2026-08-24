const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const architecture = require("../../architecture/module_architecture.json");
const {
  SourceFileScanner,
} = require("./migration/source_file_scanner");
const {
  LegacyScriptOrderReader,
} = require("./migration/legacy_script_order_reader");
const {
  LegacySymbolProviderScannerFactory,
} = require("./observation/providers/legacy_symbol_provider_scanner");
const {
  LegacyExternalConsumerScannerFactory,
} = require("./observation/consumers/legacy_external_consumer_scanner");
const {
  LegacyDependencyGraphAnalyzerFactory,
} = require(
  "./observation/resolution/legacy_dependency_graph_analyzer"
);
const {
  StageTwoRuntimeScriptAliasResolver,
} = require("./migration/stage_two_runtime_script_alias_resolver");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const SOURCE_ROOT = path.join(PROJECT_ROOT, "src");
const MANIFEST_PATH = path.join(
  PROJECT_ROOT,
  "architecture",
  "migration",
  "module_migration_manifest.json",
);

class ProviderResolutionCorpusCheck {
  constructor({
    sourceFileScanner,
    providerScanner,
    consumerScanner,
    analyzer,
    legacyScriptOrderReader,
    contract,
    manifestPath,
  }) {
    this.sourceFileScanner = sourceFileScanner;
    this.providerScanner = providerScanner;
    this.consumerScanner = consumerScanner;
    this.analyzer = analyzer;
    this.legacyScriptOrderReader = legacyScriptOrderReader;
    this.contract = contract;
    this.manifestPath = manifestPath;
  }

  run() {
    const manifestBefore = fs.readFileSync(this.manifestPath, "utf8");
    const manifest = JSON.parse(manifestBefore);
    const observations = this.#observeSources();
    const request = {
      providerObservations: observations.map((item) => item.provider),
      consumerObservations: observations.map((item) => item.consumer),
      legacyScripts: this.legacyScriptOrderReader.read(),
    };
    const requestBefore = this.#clone(request);
    const first = this.analyzer.analyze(request);
    const second = this.analyzer.analyze(request);

    assert.deepEqual(second, first, "Resolution result must be deterministic");
    assert.deepEqual(request, requestBefore, "Resolver must not mutate observations");
    assert.equal(
      fs.readFileSync(this.manifestPath, "utf8"),
      manifestBefore,
      "Stage 1.5.4.2 must not persist observations or dependency edges",
    );
    this.#validateResult(first, observations, manifest.modules.length);
    const stats = this.#summarize(first);
    console.log(
      "Provider resolution corpus passed: " +
        `${first.sources.length} files, ${stats.confirmed} confirmed, ` +
        `${stats.unresolved} unresolved, ${stats.ambiguous} ambiguous ` +
        `consumer facts, ${first.graph.edges.length} confirmed inter-file ` +
        `edges; ${stats.verified} verified/${stats.partial} partial/` +
        `${stats.failed} failed; manifest unchanged.`,
    );
  }

  #observeSources() {
    return this.sourceFileScanner.scan().map((sourceFile) => {
      const request = {
        currentPath: sourceFile.currentPath,
        source: fs.readFileSync(sourceFile.absolutePath, "utf8"),
      };
      return {
        provider: this.providerScanner.scan(request),
        consumer: this.consumerScanner.scan(request),
      };
    });
  }

  #validateResult(result, observations, expectedSourceCount) {
    const model = this.contract.resolutionModel;
    const transient = model.transientResultModel;
    assert.deepEqual(Object.keys(result), transient.rootFields);
    assert.equal(result.sources.length, expectedSourceCount);
    assert.equal(result.graph.nodes.length, expectedSourceCount);
    assert.deepEqual(Object.keys(result.graph), transient.graphFields);
    const actualPaths = new Set(result.graph.nodes);
    let resolutionCount = 0;
    let observedConsumerCount = 0;

    for (const observation of observations) {
      observedConsumerCount += observation.consumer.consumers.items.length;
    }
    for (const source of result.sources) {
      assert.deepEqual(Object.keys(source), transient.sourceFields);
      assert(transient.sourceStatuses.includes(source.status));
      assert.notEqual(source.status, "partial", `${source.currentPath}: partial`);
      assert.notEqual(source.status, "failed", `${source.currentPath}: failed`);
      this.#validateRecords(
        source.confirmed,
        model.confirmedResolutionFields,
        source.currentPath,
        actualPaths,
      );
      this.#validateRecords(
        source.unresolved,
        model.unresolvedSymbolFields,
        source.currentPath,
        actualPaths,
      );
      this.#validateRecords(
        source.ambiguous,
        model.ambiguousSymbolFields,
        source.currentPath,
        actualPaths,
      );
      for (const record of source.ambiguous) {
        assert(record.candidates.length >= model.ambiguousProviderMinimum);
        assert.deepEqual(
          record.candidates,
          [...new Set(record.candidates)].sort(),
        );
        for (const candidate of record.candidates) assert(actualPaths.has(candidate));
      }
      for (const issue of source.issues) {
        assert.deepEqual(Object.keys(issue), transient.issueFields);
      }
      resolutionCount +=
        source.confirmed.length +
        source.unresolved.length +
        source.ambiguous.length;
    }
    assert.equal(resolutionCount, observedConsumerCount);
    this.#validateGraph(result, actualPaths, transient.graphEdgeFields);
  }

  #validateRecords(records, expectedFields, currentPath, actualPaths) {
    const keys = [];
    for (const record of records) {
      assert.deepEqual(Object.keys(record), expectedFields, currentPath);
      keys.push(this.#consumerKey(record));
      if (record.resolution === "confirmed") assert(actualPaths.has(record.target));
    }
    assert.deepEqual(keys, [...new Set(keys)].sort(), currentPath);
  }

  #validateGraph(result, actualPaths, edgeFields) {
    const edgeKeys = [];
    for (const edge of result.graph.edges) {
      assert.deepEqual(Object.keys(edge), edgeFields);
      assert(actualPaths.has(edge.source));
      assert(actualPaths.has(edge.target));
      assert.notEqual(edge.source, edge.target);
      assert.deepEqual(edge.symbols, [...new Set(edge.symbols)].sort());
      const source = result.sources.find((item) => item.currentPath === edge.source);
      for (const symbol of edge.symbols) {
        assert(source.confirmed.some((resolution) =>
          resolution.target === edge.target && resolution.symbol === symbol
        ));
      }
      edgeKeys.push(`${edge.source}\u0000${edge.target}`);
    }
    assert.deepEqual(edgeKeys, [...new Set(edgeKeys)].sort());
  }

  #consumerKey(record) {
    return this.contract.resolutionModel.resolutionUnit.keyFields
      .map((field) => record[field])
      .join("\u0000");
  }

  #summarize(result) {
    const stats = {
      verified: 0,
      partial: 0,
      failed: 0,
      confirmed: 0,
      unresolved: 0,
      ambiguous: 0,
    };
    for (const source of result.sources) {
      stats[source.status] += 1;
      stats.confirmed += source.confirmed.length;
      stats.unresolved += source.unresolved.length;
      stats.ambiguous += source.ambiguous.length;
    }
    return stats;
  }

  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
}

const observationContract = architecture.migrationManifest.observationContract;
const resolutionModel = observationContract.resolutionModel;
const scriptAliases = new StageTwoRuntimeScriptAliasResolver().loadProject(
  PROJECT_ROOT,
);
new ProviderResolutionCorpusCheck({
  sourceFileScanner: new SourceFileScanner({
    projectRoot: PROJECT_ROOT,
    sourceRoot: SOURCE_ROOT,
  }),
  providerScanner: new LegacySymbolProviderScannerFactory().create(
    observationContract,
  ),
  consumerScanner: new LegacyExternalConsumerScannerFactory().create(
    observationContract,
  ),
  analyzer: new LegacyDependencyGraphAnalyzerFactory().create(resolutionModel),
  legacyScriptOrderReader: new LegacyScriptOrderReader(
    path.join(PROJECT_ROOT, "index.html"),
    { scriptAliases },
  ),
  contract: observationContract,
  manifestPath: MANIFEST_PATH,
}).run();
