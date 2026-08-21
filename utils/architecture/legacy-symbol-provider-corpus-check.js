const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const architecture = require("../../architecture/module_architecture.json");
const {
  SourceFileScanner,
} = require("./migration/source_file_scanner");
const {
  LegacySymbolProviderScannerFactory,
} = require("./observation/providers/legacy_symbol_provider_scanner");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const SOURCE_ROOT = path.join(PROJECT_ROOT, "src");
const MANIFEST_PATH = path.join(
  PROJECT_ROOT,
  "architecture",
  "migration",
  "module_migration_manifest.json",
);

class LegacySymbolProviderCorpusCheck {
  constructor({ sourceFileScanner, providerScanner, contract, manifestPath }) {
    this.sourceFileScanner = sourceFileScanner;
    this.providerScanner = providerScanner;
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
      const first = this.providerScanner.scan(request);
      const second = this.providerScanner.scan(request);
      assert.deepEqual(
        second,
        first,
        `${sourceFile.currentPath}: provider scan is not deterministic`,
      );
      this.#validateObservation(first);
      return first;
    });

    const manifestAfter = fs.readFileSync(this.manifestPath, "utf8");
    assert.equal(
      manifestAfter,
      manifestBefore,
      "Stage 1.5.2 scanner must not persist provider observations",
    );
    assert.equal(observations.length, manifest.modules.length);

    const stats = this.#summarize(observations);
    assert.equal(stats.pending, 0, "Processed sources cannot remain pending");
    assert.equal(stats.failed, 0, "Every current source must be analyzable");
    console.log(
      "Legacy provider corpus scan passed: " +
        `${observations.length} files, ${stats.providers} providers, ` +
        `${stats.verified} verified, ${stats.partial} partial, ` +
        `${stats.failed} failed; manifest unchanged.`,
    );
  }

  #validateObservation(observation) {
    const providerModel = this.contract.providerModel;
    const mechanisms = new Set(providerModel.mechanisms);
    const availabilities = new Set(providerModel.availabilities);
    const keys = [];
    assert.notEqual(observation.providers.status, "pending");
    for (const item of observation.providers.items) {
      assert.deepEqual(
        Object.keys(item),
        providerModel.requiredFields,
        `${observation.currentPath}: invalid provider shape`,
      );
      assert(mechanisms.has(item.mechanism), observation.currentPath);
      assert(availabilities.has(item.availability), observation.currentPath);
      this.#assertNoLocationFields(item, observation.currentPath);
      keys.push(
        `${item.symbol}\u0000${item.mechanism}\u0000${item.availability}`,
      );
    }
    assert.deepEqual(
      keys,
      [...new Set(keys)].sort(),
      `${observation.currentPath}: providers must be sorted and unique`,
    );
    for (const issue of observation.providers.issues) {
      assert.deepEqual(
        Object.keys(issue),
        this.contract.issueFields,
        `${observation.currentPath}: invalid issue shape`,
      );
      this.#assertNoLocationFields(issue, observation.currentPath);
    }
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
      providers: 0,
    };
    for (const observation of observations) {
      stats[observation.providers.status] += 1;
      stats.providers += observation.providers.items.length;
    }
    return stats;
  }
}

const contract = architecture.migrationManifest.observationContract;
new LegacySymbolProviderCorpusCheck({
  sourceFileScanner: new SourceFileScanner({
    projectRoot: PROJECT_ROOT,
    sourceRoot: SOURCE_ROOT,
  }),
  providerScanner: new LegacySymbolProviderScannerFactory().create(contract),
  contract,
  manifestPath: MANIFEST_PATH,
}).run();
