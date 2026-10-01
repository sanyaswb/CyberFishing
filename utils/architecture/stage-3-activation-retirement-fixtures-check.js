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
    // A classic source holds one placeholder line per retired activation it served; a shared-source
    // retirement (batch 045) leaves the source as the shim of its still-active activations instead.
    const inert = this.retired.filter(record => record.placeholder === "inert-classic-position");
    for (const { sourceProvider, activations } of RetiredActivationPlaceholder.byProvider(inert.map(item => item.activation))) {
      placeholder.validateProvider({ code: fs.readFileSync(path.join(this.root, sourceProvider), "utf8"), activations });
    }
    for (const record of this.retired.filter(item => item.placeholder === "shared-source-line-removed")) {
      const code = fs.readFileSync(path.join(this.root, record.activation.sourceProvider), "utf8");
      assert(!code.includes(`globalThis.${record.activation.legacySymbol} =`), `shared source still publishes ${record.activation.id}`);
      assert(this.runtime.activationPositions.some(item => item.sourceProvider === record.activation.sourceProvider));
    }
    for (const record of this.retired) {
      const activation = record.activation;
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
    const splitTag = `<script src="${this.runtime.output.directory}${active.shimFile}" data-legacy-slot="390"></script>`;
    assert.equal(projection.index(`<head>\n  ${splitTag}\n</head>\n`, this.runtime.output.directory, [active]),
      `<head>\n  <script src="${active.sourceProvider}" data-legacy-slot="390"></script>\n</head>\n`);
    assert.throws(() => projection.index("<head></head>", this.runtime.output.directory, [active]), /not unique/u);
    assert.throws(() => projection.index(html + tag, this.runtime.output.directory, [active]), /not unique/u);
    return 4 + this.sharedSource();
  }

  // A classic source that served several activations retires as a whole: one placeholder line per
  // activation and one restored classic tag; a partial retirement removes only the retired shim (batch 045).
  sharedSource() {
    const byProvider = new Map();
    for (const activation of this.runtime.activationPositions) {
      byProvider.set(activation.sourceProvider, [...(byProvider.get(activation.sourceProvider) || []), activation]);
    }
    const shared = [...byProvider.values()].find(group => group.length > 1);
    assert(shared, "fixtures need an active source with several activations");
    const projection = new ActivationRetirementProjection();
    const placeholder = new RetiredActivationPlaceholder();
    const directory = this.runtime.output.directory;
    const code = placeholder.renderProvider(shared);
    assert.equal(code.split("\n").length - 1, shared.length);
    placeholder.validateProvider({ code, activations: [...shared].reverse() });
    assert.throws(() => placeholder.validateProvider({ code: placeholder.render(shared[0]), activations: shared }),
      /differs from contract/u);
    assert.throws(() => placeholder.renderProvider([shared[0], this.runtime.activationPositions
      .find(item => item.sourceProvider !== shared[0].sourceProvider)]), /mixes sources/u);
    const tags = shared.map(activation => `<script src="${directory}${activation.shimFile}"></script>`);
    const html = `<head>\n  <script src="a.js"></script>\n  ${tags.join("\n")}\n  <script src="b.js"></script>\n</head>\n`;
    assert.equal(projection.index(html, directory, [...shared].reverse()),
      `<head>\n  <script src="a.js"></script>\n  <script src="${shared[0].sourceProvider}"></script>\n` +
      "  <script src=\"b.js\"></script>\n</head>\n");
    const retired = projection.contract(this.runtime, shared, "fixture");
    assert(shared.every(activation => !retired.activationPositions.some(item => item.id === activation.id)));
    assert(retired.retiredActivations.filter(record => record.retiredBy === "fixture")
      .every(record => record.placeholder === "inert-classic-position"));
    // Since batch 045 a source may lose one activation while the others stay active: that record is a
    // shared-source line removal, and only the retired shim tag leaves the index.
    const partial = projection.contract(this.runtime, shared.slice(1), "fixture");
    assert(partial.activationPositions.some(item => item.id === shared[0].id));
    assert(partial.retiredActivations.filter(record => record.retiredBy === "fixture")
      .every(record => record.placeholder === "shared-source-line-removed"));
    const sharedSources = ActivationRetirementProjection.sharedSources(this.runtime, shared.slice(1));
    assert.deepEqual([...sharedSources], [shared[0].sourceProvider]);
    assert.equal(projection.index(html, directory, shared.slice(1), sharedSources),
      `<head>\n  <script src="a.js"></script>\n  ${tags[0]}\n  <script src="b.js"></script>\n</head>\n`);
    assert.equal(ActivationRetirementProjection.sharedSources(this.runtime, shared).size, 0);
    return 9;
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
