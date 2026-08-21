const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const architecture = require("../../architecture/module_architecture.json");
const {
  SourceFileScanner,
} = require("./migration/source_file_scanner");
const {
  LegacyExternalConsumerScannerFactory,
} = require("./observation/consumers/legacy_external_consumer_scanner");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const SOURCE_ROOT = path.join(PROJECT_ROOT, "src");
const MANIFEST_PATH = path.join(
  PROJECT_ROOT,
  "architecture",
  "migration",
  "module_migration_manifest.json",
);

class LegacyExternalConsumerCorpusCheck {
  constructor({ sourceFileScanner, consumerScanner, contract, manifestPath }) {
    this.sourceFileScanner = sourceFileScanner;
    this.consumerScanner = consumerScanner;
    this.contract = contract;
    this.manifestPath = manifestPath;
  }

  run() {
    const manifestBefore = fs.readFileSync(this.manifestPath, "utf8");
    const manifest = JSON.parse(manifestBefore);

    const observations = this.sourceFileScanner.scan().map((sourceFile) => {
      const request = {
        currentPath: sourceFile.currentPath,
        source: fs.readFileSync(sourceFile.absolutePath, "utf8"),
      };
      const first = this.consumerScanner.scan(request);
      const second = this.consumerScanner.scan(request);
      assert.deepEqual(
        second,
        first,
        `${sourceFile.currentPath}: consumer scan is not deterministic`,
      );
      this.#validateObservation(first);
      return first;
    });

    assert.equal(
      fs.readFileSync(this.manifestPath, "utf8"),
      manifestBefore,
      "Stage 1.5.3 scanner must not persist observations or dependencies",
    );
    assert.equal(observations.length, manifest.modules.length);

    const stats = this.#summarize(observations);
    assert.equal(stats.pending, 0, "Processed sources cannot remain pending");
    assert.equal(stats.failed, 0, "Every current source must be analyzable");
    console.log(
      "Legacy external consumer corpus scan passed: " +
        `${observations.length} files, ${stats.consumers} consumers, ` +
        `${stats.required} required/${stats.guarded} guarded, ` +
        `${stats.eager} eager/${stats.conditional} conditional/` +
        `${stats.deferred} deferred, ${stats.verified} verified/` +
        `${stats.partial} partial/${stats.failed} failed; manifest unchanged.`,
    );
  }

  #validateObservation(observation) {
    assert.deepEqual(
      Object.keys(observation),
      ["currentPath", "consumers", "environment"],
      `${observation.currentPath}: scanner returned data outside its scope`,
    );
    const model = this.contract.consumerModel;
    const mechanisms = new Set(model.mechanisms);
    const requirements = new Set(model.accessRequirements);
    const phases = new Set(model.executionPhases);
    const keys = [];
    assert.notEqual(observation.consumers.status, "pending");
    assert.notEqual(observation.environment.status, "pending");
    for (const item of observation.consumers.items) {
      assert.deepEqual(
        Object.keys(item),
        model.requiredFields,
        `${observation.currentPath}: invalid consumer shape`,
      );
      assert(mechanisms.has(item.mechanism), observation.currentPath);
      assert(requirements.has(item.accessRequirement), observation.currentPath);
      assert(phases.has(item.executionPhase), observation.currentPath);
      this.#assertNoLocationFields(item, observation.currentPath);
      keys.push(
        `${item.symbol}\u0000${item.mechanism}\u0000` +
          `${item.accessRequirement}\u0000${item.executionPhase}`,
      );
    }
    assert.deepEqual(
      keys,
      [...new Set(keys)].sort(),
      `${observation.currentPath}: consumers must be sorted and unique`,
    );
    this.#validateEnvironment(observation.environment, observation.currentPath);
    for (const issue of observation.consumers.issues) {
      assert.deepEqual(Object.keys(issue), this.contract.issueFields);
      this.#assertNoLocationFields(issue, observation.currentPath);
    }
  }

  #validateEnvironment(environment, currentPath) {
    const model = this.contract.environmentModel;
    this.#assertCatalogValues(environment.builtins, model.builtins, currentPath);
    this.#assertCatalogValues(
      environment.browserApis,
      model.browserApis,
      currentPath,
    );
    this.#assertCatalogValues(
      environment.dynamicConstructs,
      model.dynamicConstructKinds,
      currentPath,
    );
    assert.deepEqual(
      environment.dynamicConstructs,
      [...new Set(environment.dynamicConstructs)].sort(),
      `${currentPath}: dynamic constructs must be sorted and unique`,
    );
  }

  #assertCatalogValues(values, catalog, currentPath) {
    assert.deepEqual(
      values,
      [...new Set(values)].sort(),
      `${currentPath}: environment values must be sorted and unique`,
    );
    for (const value of values) assert(catalog.includes(value), currentPath);
  }

  #assertNoLocationFields(record, currentPath) {
    for (const field of this.contract.forbiddenAuthoritativeLocationFields) {
      assert.equal(
        Object.hasOwn(record, field),
        false,
        `${currentPath}: ${field} cannot be authoritative observation data`,
      );
    }
  }

  #summarize(observations) {
    const stats = {
      pending: 0,
      verified: 0,
      partial: 0,
      failed: 0,
      consumers: 0,
      required: 0,
      guarded: 0,
      eager: 0,
      conditional: 0,
      deferred: 0,
    };
    for (const observation of observations) {
      stats[observation.consumers.status] += 1;
      for (const consumer of observation.consumers.items) {
        stats.consumers += 1;
        stats[consumer.accessRequirement] += 1;
        stats[consumer.executionPhase] += 1;
      }
    }
    return stats;
  }
}

const contract = architecture.migrationManifest.observationContract;
new LegacyExternalConsumerCorpusCheck({
  sourceFileScanner: new SourceFileScanner({
    projectRoot: PROJECT_ROOT,
    sourceRoot: SOURCE_ROOT,
  }),
  consumerScanner: new LegacyExternalConsumerScannerFactory().create(contract),
  contract,
  manifestPath: MANIFEST_PATH,
}).run();
