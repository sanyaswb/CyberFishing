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
    await this.#checkNativeServer();
    this.#checkNativePages();
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

  async #checkNativeServer() {
    const { NativeRuntimeReadiness } = require("./esm_infrastructure/native_runtime_readiness");
    const { DevServerApplication, DevServerConfig, MimeTypeRegistry, StaticFileResolver } = require("../dev-server");
    assert.deepEqual(NativeRuntimeReadiness.verify(PROJECT_ROOT), { status: "native-esm", outputs: [] });
    assert.throws(() => NativeRuntimeReadiness.assertNoGeneratedOutput(file => file === "dist"), /generated dist output/);
    const config = new DevServerConfig({ HOST: "127.0.0.1", PORT: "4190" }, ["node", "dev-server", "--port=4191"]);
    assert.equal(config.port, 4191); assert.equal(config.host, "127.0.0.1");
    assert.equal(new DevServerConfig({ PORT: "invalid" }, []).port, 4173);
    const mime = new MimeTypeRegistry();
    assert.equal(mime.getForFile("entry.JS"), "text/javascript; charset=utf-8");
    assert.equal(mime.getForFile("config.json"), "application/json; charset=utf-8");
    assert.equal(mime.getForFile("style.css"), "text/css; charset=utf-8");
    assert.equal(mime.getForFile("asset.unknown"), "application/octet-stream");
    const resolver = new StaticFileResolver(PROJECT_ROOT);
    assert.equal(resolver.resolve("/"), path.join(PROJECT_ROOT, "index.html"));
    assert.equal(resolver.resolve("/dev.html?v=0.27.2"), path.join(PROJECT_ROOT, "dev.html"));
    assert.equal(resolver.resolve("/..%5Coutside.js"), process.platform === "win32" ? null : path.join(PROJECT_ROOT, "..\\outside.js"));
    const calls = [], logs = [], events = new Map(); let fatal;
    const server = { on(name, callback) { events.set(name, callback); calls.push("on:" + name); },
      listen(port, host, callback) { calls.push(["listen", port, host]); callback(); } };
    const report = { status: "native-esm", outputs: [] };
    const app = new DevServerApplication(config, { server, runtimeValidator: async () => { calls.push("validate"); return report; },
      fatalErrorHandler: error => { fatal = error; }, logger: { log(message) { logs.push(message); } } });
    assert.equal(await app.start(), report);
    assert.deepEqual(calls, ["validate", "on:error", ["listen", 4191, "127.0.0.1"]]);
    assert(logs.includes("Runtime: native ESM; no generated outputs."));
    const bindError = Object.assign(new Error("occupied"), { code: "EADDRINUSE" }); events.get("error")(bindError); assert.equal(fatal, bindError);
    const failedCalls = [];
    const failed = new DevServerApplication(config, { server: { on() { failedCalls.push("on"); }, listen() { failedCalls.push("listen"); } },
      runtimeValidator: () => { throw new Error("unaccepted native retirement"); }, logger: { log() {} } });
    await assert.rejects(failed.start(), /unaccepted native retirement/);
    assert.deepEqual(failedCalls, [], "failed native validation never opens the listener");
  }

  #checkNativePages() {
    const verify = (html, entry) => {
      const tags = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/giu)];
      assert.equal(tags.length, 1, "native page requires exactly one script");
      assert(/\btype\s*=\s*["']module["']/u.test(tags[0][1]), "native script must be a module");
      const source = /\bsrc\s*=\s*["']([^"']+)["']/u.exec(tags[0][1]);
      assert(source && source[1].split("?")[0] === entry, "native page requires its exact entrypoint");
      assert.equal(tags[0][2].trim(), "", "native entry has no executable inline startup");
    };
    for (const [page, entry] of [["index.html", "src/entrypoints/game.entry.js"], ["dev.html", "src/entrypoints/dev.entry.js"]]) {
      verify(fs.readFileSync(path.join(PROJECT_ROOT, page), "utf8"), entry);
      const tag = `<script type="module" src="${entry}?v=0.27.2"></script>`;
      for (const html of ["", tag + tag, tag.replace('type="module"', ""), tag.replace(entry, "dist/compat/runtime.js"),
        tag.replace("</script>", "startGame();</script>"), tag.replace(`src="${entry}?v=0.27.2"`, "")]) assert.throws(() => verify(html, entry));
    }
  }

  #globalIdentitySet() {
    return Reflect.ownKeys(globalThis).map((key) => typeof key === "symbol" ? `symbol:${String(key.description)}` : `string:${key}`).sort();
  }
}

new NativeEsmFixtureRunner().run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
