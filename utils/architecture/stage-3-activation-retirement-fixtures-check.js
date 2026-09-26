"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { CanonicalActivationIdentity, CumulativeRuntimeContractValidator } =
  require("../build/compat_runtime/cumulative_runtime_contract");
const { ActivationRetirementProjection, RetiredActivationPlaceholder } =
  require("../build/compat_runtime/activation_retirement");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { StageThreeLivePreflight } = require("./domain_batches/stage_three_live_preflight");

const ROOT = path.resolve(__dirname, "../..");
const CONTRACT = "architecture/migration/stage_3_compatibility_runtime.json";

// Negative fixtures of the atomic activation-retirement contract: premature or partial retirement,
// wrong identities, overlooked classic readers, non-inert placeholders and failed publication.
class ActivationRetirementFixtures {
  constructor(root = ROOT) {
    this.root = root;
    this.runtime = JSON.parse(fs.readFileSync(path.join(root, CONTRACT)));
    this.retired = this.runtime.retiredActivations || [];
  }

  run() {
    const results = [
      this.ledgerContract(),
      this.projection(),
      this.placeholder(),
      this.index(),
      this.retiringSet(),
      this.transaction(),
    ];
    return results.reduce((count, value) => count + value, 0);
  }

  ledgerContract() {
    const validator = new CumulativeRuntimeContractValidator();
    validator.validate(this.runtime);
    assert(this.retired.length > 0, "fixtures need at least one recorded retirement");
    const entry = this.retired[0];
    const reject = (mutate, message) => {
      const contract = structuredClone(this.runtime);
      mutate(contract);
      assert.throws(() => validator.validate(contract), message);
    };
    reject(contract => contract.activationPositions.push(structuredClone(entry.activation)), /still active/u);
    reject(contract => { contract.retiredActivations[0].placeholder = "deleted"; }, /placeholder is invalid/u);
    reject(contract => { contract.retiredActivations[0].reason = "unused"; }, /reason is invalid/u);
    reject(contract => { contract.retiredActivations[0].activation.legacySymbol = "Other"; }, /not canonical/u);
    reject(contract => { contract.retiredActivations[0].extra = true; }, /non-contract fields/u);
    reject(contract => { delete contract.retiredActivations[0].retiredBy; }, /non-contract fields|retiredBy/u);
    reject(contract => contract.retiredActivations.push(structuredClone(contract.retiredActivations[0])),
      /sorted and unique/u);
    return 7;
  }

  projection() {
    const projection = new ActivationRetirementProjection();
    const active = this.runtime.activationPositions[0];
    const retiredOnce = projection.contract(this.runtime, [active], "fixture-batch");
    assert(!retiredOnce.activationPositions.some(item => item.id === active.id));
    new CumulativeRuntimeContractValidator().validate(retiredOnce);
    // A record that is not the exact active contract (already retired, wrong provider or id) is rejected.
    assert.throws(() => projection.contract(this.runtime, [this.retired[0].activation], "fixture"), /not the active contract/u);
    assert.throws(() => projection.contract(this.runtime, [{ ...active, sourceProvider: "src/other.js" }], "fixture"),
      /not the active contract/u);
    assert.throws(() => projection.contract(this.runtime, [{ ...active, id: "activation-000000000000" }], "fixture"),
      /not the active contract/u);
    assert.throws(() => projection.contract(this.runtime, [undefined], "fixture"));
    return 4;
  }

  placeholder() {
    const placeholder = new RetiredActivationPlaceholder();
    for (const record of this.retired) {
      const activation = record.activation;
      placeholder.validate({ code: fs.readFileSync(path.join(this.root, activation.sourceProvider), "utf8"), activation });
      const shim = `globalThis.${activation.legacySymbol} = undefined;\n`;
      assert.throws(() => placeholder.validate({ code: shim, activation }), /differs from contract/u);
      assert.throws(() => placeholder.validate({ code: placeholder.render(activation) + shim, activation }),
        /differs from contract/u);
    }
    assert.throws(() => placeholder.render({ ...this.retired[0].activation, id: "activation-000000000000" }));
    return 1 + 2 * this.retired.length;
  }

  index() {
    const projection = new ActivationRetirementProjection();
    const active = this.runtime.activationPositions[0];
    const tag = `<script src="${this.runtime.output.directory}${active.shimFile}"></script>`;
    const html = `<head>\n${tag}\n</head>\n`;
    assert.equal(projection.index(html, this.runtime.output.directory, [active]),
      `<head>\n<script src="${active.sourceProvider}"></script>\n</head>\n`);
    assert.throws(() => projection.index("<head></head>", this.runtime.output.directory, [active]), /not unique/u);
    assert.throws(() => projection.index(html + tag, this.runtime.output.directory, [active]), /not unique/u);
    return 3;
  }

  // Only activations whose every holding bridge is migrated by the batch may retire.
  retiringSet() {
    const preflight = Object.create(StageThreeLivePreflight.prototype);
    const activation = this.runtime.activationPositions.find(item => item.owner.startsWith("stage-3."));
    const bridge = source => ({ source, target: activation.targetModule,
      globalProviders: [{ symbol: activation.legacySymbol, mechanism: "global-this-property" }] });
    const runtimeContract = { activationPositions: [activation] };
    const retiring = (bridges, migrated) => preflight.retiringActivations({ runtimeContract,
      bridgeRegistry: { bridges }, currentPaths: new Set(migrated) }).map(item => item.id);
    assert.deepEqual(retiring([bridge("src/a.js")], ["src/a.js"]), [activation.id]);
    assert.deepEqual(retiring([bridge("src/a.js"), bridge("src/b.js")], ["src/a.js"]), [],
      "premature retirement: another classic reader remains");
    assert.deepEqual(retiring([], ["src/a.js"]), [], "an activation without listed readers is never retired implicitly");
    assert.deepEqual(retiring([{ ...bridge("src/a.js"), target: "src/other.js" }], ["src/a.js"]), [],
      "a bridge to another provider does not hold this activation");
    const stageTwo = { ...activation, owner: "stage-2.fixture" };
    assert.deepEqual(preflight.retiringActivations({ runtimeContract: { activationPositions: [stageTwo] },
      bridgeRegistry: { bridges: [bridge("src/a.js")] }, currentPaths: new Set(["src/a.js"]) }), []);
    return 5;
  }

  // Partial publication never survives: a failed transaction restores written and removed files.
  transaction() {
    const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "cyber-retirement-fixture-"));
    try {
      fs.mkdirSync(path.join(root, "dist"));
      fs.writeFileSync(path.join(root, "placeholder.js"), "globalThis.X = 1;\n");
      fs.writeFileSync(path.join(root, "dist/shim.js"), "globalThis.X = 1;\n");
      const writes = [
        { relativePath: "placeholder.js", bytes: "// retired\n" },
        { relativePath: "dist/shim.js", bytes: null },
      ];
      for (const phase of ["after-staging", "after-replacement", "after-final-validation"]) {
        assert.throws(() => new ControlledMetadataTransaction({ projectRoot: root, failureInjector: event => {
          if (event.phase === phase) throw new Error(`injected ${phase}`);
        } }).commit(writes, () => {}), new RegExp(`injected ${phase}`, "u"));
        assert.equal(fs.readFileSync(path.join(root, "placeholder.js"), "utf8"), "globalThis.X = 1;\n");
        assert.equal(fs.readFileSync(path.join(root, "dist/shim.js"), "utf8"), "globalThis.X = 1;\n");
        assert.deepEqual(fs.readdirSync(path.join(root, "dist")), ["shim.js"]);
      }
      assert.throws(() => new ControlledMetadataTransaction({ projectRoot: root })
        .commit([{ relativePath: "dist/absent.js", bytes: null }], () => {}), /removal target is missing/u);
      new ControlledMetadataTransaction({ projectRoot: root }).commit(writes, () => {
        assert(!fs.existsSync(path.join(root, "dist/shim.js")));
      });
      assert.deepEqual(fs.readdirSync(path.join(root, "dist")), []);
      assert.equal(CanonicalActivationIdentity.id(this.retired[0].activation), this.retired[0].activation.id);
      return 5;
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
}

if (require.main === module) {
  try {
    const count = new ActivationRetirementFixtures().run();
    console.log(`Activation retirement fixtures PASS: ${count} negative and rollback cases.`);
  } catch (error) { console.error(error.stack); process.exitCode = 1; }
}

module.exports = { ActivationRetirementFixtures };
