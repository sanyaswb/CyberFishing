const fs = require("node:fs");
const { CanonicalJson } = require("../core/canonical_json");

class GuardArtifactRepository {
  constructor(filePath, validator) { this.filePath = filePath; this.validator = validator; }
  read() {
    const value = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
    this.validator.validate(value);
    return CanonicalJson.clone(value);
  }
  write(value) {
    this.validator.validate(value);
    fs.writeFileSync(this.filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }
}

class KnownDebtRegistryValidator {
  validate(value) {
    this.#root(value, "cyber-fishing-known-debt", "debts");
    const ids = new Set();
    for (const item of value.debts) {
      this.#fields(item, ["id", "rule", "source", "target", "reason", "blockers", "owner", "migrationWave", "removalStage", "evidenceFingerprint", "identity"]);
      if (!/^debt-[a-z0-9-]+-[a-f0-9]{12}$/.test(item.id)) throw new Error(`Invalid debt id: ${item.id}`);
      if (ids.has(item.id)) throw new Error(`Duplicate debt id: ${item.id}`);
      ids.add(item.id);
      if ([item.source, item.target].some((part) => String(part).includes("*"))) throw new Error(`Wildcards are forbidden: ${item.id}`);
      if (!Array.isArray(item.blockers)) throw new Error(`${item.id} blockers must be an array`);
      if (!Number.isInteger(item.migrationWave) || item.migrationWave < 0 || item.migrationWave > 7) throw new Error(`${item.id} migrationWave must be 0..7`);
      if (!/^stage-[2-7]$/.test(item.removalStage)) throw new Error(`${item.id} has invalid removalStage`);
      const expected = CanonicalJson.debtId(item.rule, item.identity);
      const fingerprint = CanonicalJson.fingerprint(item.identity);
      if (item.id !== expected || item.evidenceFingerprint !== fingerprint) throw new Error(`${item.id} has stale identity/fingerprint`);
    }
    const sortedIds = [...ids].sort();
    if (value.debts.some((item, index) => item.id !== sortedIds[index])) throw new Error("Known debt registry must be sorted by id");
  }
  #root(value, kind, collection) {
    if (value?.schemaVersion !== 1 || value?.kind !== kind || !Array.isArray(value?.[collection])) throw new Error(`Invalid ${kind} registry`);
  }
  #fields(item, fields) { for (const field of fields) if (item[field] === undefined || item[field] === null || item[field] === "") throw new Error(`Registry entry requires ${field}`); }
}

class MigrationBridgeRegistryValidator {
  validate(value) {
    if (value?.schemaVersion !== 1 || value?.kind !== "cyber-fishing-migration-bridges" || !Array.isArray(value?.bridges)) throw new Error("Invalid migration bridge registry");
    const ids = new Set();
    for (const item of value.bridges) {
      for (const field of ["id", "bridge", "source", "target", "reason", "owner", "introducedStage", "removalStage", "globalProviders"]) if (item[field] === undefined) throw new Error(`Bridge requires ${field}`);
      if (ids.has(item.id)) throw new Error(`Duplicate bridge id: ${item.id}`);
      ids.add(item.id);
      if ([item.bridge, item.source, item.target].some((part) => String(part).includes("*"))) throw new Error(`Bridge wildcard forbidden: ${item.id}`);
      if (!Array.isArray(item.globalProviders)) throw new Error(`${item.id} globalProviders must be an array`);
      if (!/^stage-[2-7]$/.test(item.introducedStage) || !/^stage-[2-7]$/.test(item.removalStage)) throw new Error(`${item.id} has invalid lifecycle stage`);
      const providerKeys = new Set();
      for (const provider of item.globalProviders) {
        if (!provider?.symbol || !provider?.mechanism) throw new Error(`${item.id} bridge global requires symbol/mechanism`);
        const key = `${provider.symbol}\u0000${provider.mechanism}`;
        if (providerKeys.has(key)) throw new Error(`${item.id} has duplicate bridge global: ${key}`);
        providerKeys.add(key);
      }
    }
  }
}

class GlobalProviderBaselineValidator {
  validate(value) {
    if (value?.schemaVersion !== 1 || value?.kind !== "cyber-fishing-global-provider-baseline" || !Array.isArray(value?.providers)) throw new Error("Invalid global provider baseline");
    const keys = value.providers.map((item) => `${item.currentPath}\u0000${item.symbol}\u0000${item.mechanism}`);
    if (keys.some((key, index) => key !== [...new Set(keys)].sort()[index])) throw new Error("Global provider baseline must be sorted and unique");
    for (const item of value.providers) for (const field of ["currentPath", "symbol", "mechanism", "availability"]) if (!item[field]) throw new Error(`Global provider baseline requires ${field}`);
  }
}

module.exports = { GlobalProviderBaselineValidator, GuardArtifactRepository, KnownDebtRegistryValidator, MigrationBridgeRegistryValidator };
