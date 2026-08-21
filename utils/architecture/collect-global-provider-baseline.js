const path = require("node:path");
const { GuardArtifactRepository, GlobalProviderBaselineValidator } = require("./guards/contracts/guard_artifact_repository");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const manifest = require(path.join(PROJECT_ROOT, "architecture/migration/module_migration_manifest.json"));
const output = path.join(PROJECT_ROOT, "architecture/guards/global_provider_baseline.json");
const providersByIdentity = new Map();
for (const module of manifest.modules) for (const provider of module.observed.providers.items) {
  const record = { currentPath: module.currentPath, symbol: provider.symbol, mechanism: provider.mechanism, availability: provider.availability };
  const key = `${record.currentPath}\u0000${record.symbol}\u0000${record.mechanism}`;
  if (!providersByIdentity.has(key)) providersByIdentity.set(key, record);
}
const providers = [...providersByIdentity.values()].sort((a, b) => {
  const left = `${a.currentPath}\u0000${a.symbol}\u0000${a.mechanism}`;
  const right = `${b.currentPath}\u0000${b.symbol}\u0000${b.mechanism}`;
  return left < right ? -1 : left > right ? 1 : 0;
});
new GuardArtifactRepository(output, new GlobalProviderBaselineValidator()).write({
  schemaVersion: 1,
  kind: "cyber-fishing-global-provider-baseline",
  generatedFrom: "architecture/migration/module_migration_manifest.json",
  identity: ["currentPath", "symbol", "mechanism"],
  providers,
});
console.log(`Global provider baseline written: ${providers.length} exact identities.`);
