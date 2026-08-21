const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { EsmFixtureGraphInspector } = require("./esm_infrastructure/esm_fixture_graph_inspector");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const FIXTURE_ROOT = path.join(__dirname, "esm-fixtures");
const ENTRY_PATH = path.join(FIXTURE_ROOT, "fixture-entry.js");

class NativeEsmFixtureRunner {
  async run() {
    assert.equal(typeof require, "function", "Native ESM fixture runner must remain CommonJS");
    assert.equal(typeof module.exports, "object", "CommonJS module contract is unavailable");
    const localPackage = JSON.parse(fs.readFileSync(path.join(FIXTURE_ROOT, "package.json"), "utf8"));
    assert.equal(localPackage.type, "module", "Fixture boundary requires local type=module");
    assert.equal(require(path.join(PROJECT_ROOT, "package.json")).type, undefined, "Root package must not switch utils to ESM");
    const graph = new EsmFixtureGraphInspector({ fixtureRoot: FIXTURE_ROOT }).inspect(ENTRY_PATH);
    const globalsBefore = this.#globalIdentitySet();
    const fixtureModule = await import(`${pathToFileURL(ENTRY_PATH).href}?native-esm-check=1`);
    assert.equal(typeof fixtureModule.runEsmFixture, "function", "Named ESM runner export is missing");
    assert.equal(fixtureModule.default, undefined, "Fixture must not expose a default export");
    const result = await fixtureModule.runEsmFixture();
    assert.deepEqual(result, {
      kind: "cyber-fishing-isolated-esm-fixture",
      staticValue: 10,
      dynamicValue: { value: 11, source: "dynamic-import-ok" },
    });
    assert.deepEqual(this.#globalIdentitySet(), globalsBefore, "Native ESM fixture leaked a global binding/property");
    assert(graph.mechanisms.includes("static-import") && graph.mechanisms.includes("dynamic-import"), "Fixture graph lacks required import mechanisms");
    console.log(`Native ESM fixture passed: ${graph.files.length} .js modules, static + dynamic imports, named exports, explicit extensions, 0 globals; CommonJS tooling preserved.`);
  }

  #globalIdentitySet() {
    return Reflect.ownKeys(globalThis).map((key) => typeof key === "symbol" ? `symbol:${String(key.description)}` : `string:${key}`).sort();
  }
}

new NativeEsmFixtureRunner().run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
