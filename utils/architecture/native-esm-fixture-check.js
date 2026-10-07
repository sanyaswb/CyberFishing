const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { NativeEsmTestLoader } = require("../testing/runtime/native_esm_test_loader");
const { SourceRuntime } = require("../testing/core/source_runtime");
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
    await this.#checkTestAdapter();
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

  async #checkTestAdapter() {
    assert(!fs.existsSync(path.join(FIXTURE_ROOT, "architecture")), "Fixture root has no migration aliases or metadata");
    const context = vm.createContext({ console });
    const loader = new NativeEsmTestLoader({ projectRoot: FIXTURE_ROOT, context });
    const entry = loader.getExports("fixture-entry.js");
    assert.equal(loader.getExports("fixture-entry.js"), entry, "one cached module namespace per VM");
    const result = await entry.runEsmFixture();
    assert.deepEqual(JSON.parse(JSON.stringify(result)), {
      kind: "cyber-fishing-isolated-esm-fixture", staticValue: 10,
      dynamicValue: { value: 11, source: "dynamic-import-ok" },
    });
    const nativeClass = loader.getExports("modules/static-math.js").FixtureAccumulator;
    loader.load("modules/static-math.js", ["INTENTIONALLY_ABSENT_EXPORT"]);
    assert.equal(context.FixtureAccumulator, nativeClass, "explicit publication keeps the cached class identity");
    assert.equal(context.INTENTIONALLY_ABSENT_EXPORT, undefined, "negative fixture publication stays undefined");
    assert(Object.isFrozen(entry));
    const other = new SourceRuntime({ rootDir: FIXTURE_ROOT });
    assert.notEqual(other.importModule("modules/static-math.js").FixtureAccumulator, nativeClass, "VM realms are isolated without migration metadata");
    assert.deepEqual(JSON.parse(JSON.stringify(await other.importModule("fixture-entry.js").runEsmFixture())), JSON.parse(JSON.stringify(result)));
    const stub = { FixtureAccumulator: class { constructor() { this.value = 20; } add(value) { return this.value + value; } }, doubleFixtureValue: value => value * 3 };
    const stubbed = new NativeEsmTestLoader({ projectRoot: FIXTURE_ROOT, context: vm.createContext({}), moduleStubs: { "modules/static-math.js": stub } });
    assert.equal(stubbed.getExports("modules/static-math.js"), stub);
    assert.equal((await stubbed.getExports("fixture-entry.js").runEsmFixture()).staticValue, 69);

    // The actual loader over in-memory authored inputs exercises rejection paths without writing sources.
    const inputs = new Map([
      ["cycle-a.js", "import { B } from './cycle-b.js'; export const A = B;"],
      ["cycle-b.js", "import { A } from './cycle-a.js'; export const B = A;"],
      ["value.js", "export const X = 1;"],
      ["extension.js", "import { X } from './value'; export const Y = X;"],
      ["namespace.js", "import * as X from './value.js'; export const Y = X;"],
      ["default.js", "export default 1;"],
      ["reexport.js", "export { X } from './value.js';"],
      ["dynamic.js", "export async function read(name) { return import(name); }"],
    ]);
    const syntheticRoot = path.join(FIXTURE_ROOT, "in-memory-inputs");
    const syntheticFs = { readFileSync(file) { const key = path.relative(syntheticRoot, file).replaceAll("\\", "/"); assert(inputs.has(key), "unexpected loader read: " + key); return inputs.get(key); } };
    const scope = { module: { exports: {} }, process: { env: {} }, require: name => name === "node:fs" ? syntheticFs : require(name) };
    const loaderSource = fs.readFileSync(path.join(PROJECT_ROOT, "utils/testing/runtime/native_esm_test_loader.js"), "utf8");
    vm.runInNewContext(loaderSource, scope, { filename: "native-loader-negative-fixtures.js" });
    const negative = new scope.module.exports.NativeEsmTestLoader({ projectRoot: syntheticRoot, context: vm.createContext({}) });
    for (const [file, pattern] of [["cycle-a.js", /Native test import cycle/], ["extension.js", /Explicit native test import/],
      ["namespace.js", /Named native test import/], ["default.js", /Named native test exports/], ["reexport.js", /Test re-export is unsupported/],
      ["dynamic.js", /Literal dynamic test import/]]) assert.throws(() => negative.getExports(file), pattern);
    inputs.set("cycle-a.js", "export const A = 7;");
    assert.equal(negative.getExports("cycle-a.js").A, 7, "a failed import leaves no stale loading marker/cache entry");
    assert.throws(() => new SourceRuntime().importModule("src/core/math/vector2.js"), /ENOENT/, "deleted classic aliases are not restored");
  }

  #globalIdentitySet() {
    return Reflect.ownKeys(globalThis).map((key) => typeof key === "symbol" ? `symbol:${String(key.description)}` : `string:${key}`).sort();
  }
}

new NativeEsmFixtureRunner().run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
