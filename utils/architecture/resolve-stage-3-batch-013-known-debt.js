"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { KnownDebtRegistryValidator } = require("./guards/contracts/guard_artifact_repository");

const DEBT = "architecture/guards/known_debt_registry.json";
const OUTPUT = "architecture/migration/stage_3_batch_013_known_debt_resolution.json";
const sources = Object.freeze([
  "src/core/fishing/player_force_budget_allocator.js",
  "src/core/fishing/player_pressure/player_pressure_fatigue_calculator.js",
  "src/core/fishing/rod_control_angle_resolver.js",
  "src/core/fishing/stamina/stamina_regen_calculator.js",
]);
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const serialize = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");

class Batch013KnownDebtResolution {
  run(root = path.resolve(__dirname, "../..")) {
    const target = path.join(root, DEBT);
    const before = fs.readFileSync(target);
    const registry = JSON.parse(before);
    const removed = registry.debts.filter(item => sources.includes(item.source) &&
      item.rule === "browser-capability" && item.target === "environment:browser-runtime");
    assert.equal(removed.length, 4, "Exact four reviewed browser capability debts required");
    assert.deepEqual(removed.map(item => item.source).sort(), [...sources].sort());
    for (const source of sources) {
      assert(!fs.readFileSync(path.join(root, source), "utf8").includes("window"),
        `Classic provider still reads window: ${source}`);
      const esm = source.replace("src/core/", "src/game/domain/");
      assert(fs.existsSync(path.join(root, esm)));
      assert(!fs.readFileSync(path.join(root, esm), "utf8").includes("window"));
    }
    const after = serialize({ ...registry, debts: registry.debts.filter(item => !removed.includes(item)) });
    new KnownDebtRegistryValidator().validate(JSON.parse(after));
    const artifact = { schemaVersion: 1, kind: "cyber-fishing-stage-3-batch-013-known-debt-resolution",
      batchId: "stage-3.candidate-013-fishing-0267b3ea", status: "verified",
      registry: { path: DEBT, beforeSha256: sha(before), afterSha256: sha(after),
        beforeBase64: before.toString("base64"), afterBase64: after.toString("base64") },
      removed, added: [], reason: "Four guarded window exposures were removed from classic providers and ESM targets." };
    const artifactBytes = serialize(artifact);
    assert(!fs.existsSync(path.join(root, OUTPUT)), "Debt resolution already exists");
    new ControlledMetadataTransaction({ projectRoot: root }).commit([
      { relativePath: DEBT, bytes: after }, { relativePath: OUTPUT, bytes: artifactBytes },
    ], () => {
      assert.deepEqual(fs.readFileSync(target), after);
      assert.deepEqual(fs.readFileSync(path.join(root, OUTPUT)), artifactBytes);
    });
    console.log("Stage 3.13.7 debt resolution: four exact obsolete browser-capability records removed.");
    return artifact;
  }
}

if (require.main === module) {
  try { new Batch013KnownDebtResolution().run(); }
  catch (error) { console.error(error.stack); process.exitCode = 1; }
}

module.exports = { Batch013KnownDebtResolution };
