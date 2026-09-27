"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ControlledMetadataTransaction } = require("../../domain_batches/controlled_metadata_transaction");
const { KnownDebtRegistryValidator } = require("../../guards/contracts/guard_artifact_repository");
const { sha, serialize } = require("./planning");

const DEBT = "architecture/guards/known_debt_registry.json";

// Removes browser-capability debt records of the batch's classic sources once neither the classic
// provider nor the ESM target reads window (Stage 3.N.7). The removed ids must equal the profile's
// reviewed expectation; no other debt is touched.
class StageThreeKnownDebtResolution {
  constructor(root, definition) {
    this.root = path.resolve(root);
    this.definition = definition;
    this.output = definition.context.paths.knownDebt;
  }

  expected() { return [...this.definition.resolvedDebtIds]; }

  project() {
    const target = path.join(this.root, DEBT);
    const before = fs.readFileSync(target);
    const registry = JSON.parse(before);
    const targets = this.definition.execution.expectedTargets;
    const sources = targets.map(item => item.currentPath);
    const removed = registry.debts.filter(item => sources.includes(item.source) &&
      item.rule === "browser-capability" && item.target === "environment:browser-runtime");
    assert.deepEqual(removed.map(item => item.id).sort(), this.expected(), "Resolved debt differs from the profile");
    for (const item of removed) {
      const esm = targets.find(entry => entry.currentPath === item.source).targetPath;
      assert(!fs.readFileSync(path.join(this.root, item.source), "utf8").includes("window"),
        `Classic provider still reads window: ${item.source}`);
      assert(!fs.readFileSync(path.join(this.root, esm), "utf8").includes("window"), `ESM target reads window: ${esm}`);
    }
    const after = serialize({ ...registry, debts: registry.debts.filter(item => !removed.includes(item)) });
    new KnownDebtRegistryValidator().validate(JSON.parse(after));
    return { before, after, removed };
  }

  run() {
    if (this.expected().length === 0) return null;
    assert(!fs.existsSync(path.join(this.root, this.output)), "Debt resolution already exists");
    const { before, after, removed } = this.project();
    const artifact = { schemaVersion: 1, kind: this.definition.context.kind("known-debt-resolution"),
      batchId: this.definition.id, status: "verified",
      registry: { path: DEBT, beforeSha256: sha(before), afterSha256: sha(after),
        beforeBase64: before.toString("base64"), afterBase64: after.toString("base64") },
      removed, added: [], reason: "Reviewed browser-capability reads were removed from the classic providers and ESM targets." };
    const artifactBytes = serialize(artifact);
    new ControlledMetadataTransaction({ projectRoot: this.root }).commit([
      { relativePath: DEBT, bytes: after }, { relativePath: this.output, bytes: artifactBytes },
    ], () => {
      assert.deepEqual(fs.readFileSync(path.join(this.root, DEBT)), after);
      assert.deepEqual(fs.readFileSync(path.join(this.root, this.output)), artifactBytes);
    });
    return artifact;
  }
}

module.exports = { StageThreeKnownDebtResolution };
