"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const espree = require("espree");
const eslintScope = require("eslint-scope");

const PROJECT_ROOT = path.resolve(__dirname, "..");

// First matching prefix wins.
const LAYERS = Object.freeze([
  ["src/entrypoints/game", "entrypoint/game"],
  ["src/entrypoints/dev", "entrypoint/dev"],
  ["src/bootstrap/production/", "bootstrap/production"],
  ["src/bootstrap/development/", "bootstrap/development"],
  ["src/engine/", "engine"],
  ["src/game/domain/", "game/domain"],
  ["src/game/application/", "game/application"],
  ["src/game/config/raw/", "game/config/raw"],
  ["src/game/config/", "game/config"],
  ["src/game/presentation/", "game/presentation"],
  ["src/platform/", "platform"],
  ["src/dev/", "dev"],
]);

const PRODUCTION_LAYERS = ["engine", "game/config/raw", "game/config", "game/domain", "game/application", "game/presentation",
  "platform"];

// Layers each layer may import (its own layer included).
const ALLOWED_IMPORTS = Object.freeze({
  "engine": ["engine"],
  "game/config/raw": [],
  "game/config": ["game/config", "game/config/raw", "game/domain", "engine"],
  "game/domain": ["game/domain", "engine"],
  "game/application": ["game/application", "game/domain", "game/config", "engine"],
  "game/presentation": ["game/presentation", "game/application", "game/domain", "engine"],
  "platform": ["platform", "engine"],
  "dev": ["dev", ...PRODUCTION_LAYERS],
  "bootstrap/production": ["bootstrap/production", ...PRODUCTION_LAYERS],
  "bootstrap/development": ["bootstrap/development", "bootstrap/production", "dev", ...PRODUCTION_LAYERS],
  "entrypoint/game": ["bootstrap/production"],
  "entrypoint/dev": ["bootstrap/development"],
});

// Only these layers may touch browser/host globals (DOM, Canvas, storage, audio, timers, console).
const HOST_LAYERS = new Set(["platform", "dev"]);

const ECMASCRIPT_GLOBALS = new Set([
  "AggregateError", "Array", "ArrayBuffer", "BigInt", "BigInt64Array", "BigUint64Array", "Boolean", "DataView",
  "Date", "Error", "EvalError", "Float32Array", "Float64Array", "Infinity", "Int8Array", "Int16Array",
  "Int32Array", "JSON", "Map", "Math", "NaN", "Number", "Object", "Promise", "Proxy", "RangeError",
  "ReferenceError", "Reflect", "RegExp", "Set", "String", "Symbol", "SyntaxError", "TypeError", "URIError",
  "Uint8Array", "Uint8ClampedArray", "Uint16Array", "Uint32Array", "WeakMap", "WeakRef", "WeakSet",
  "decodeURIComponent", "encodeURIComponent", "isFinite", "isNaN", "parseFloat", "parseInt", "undefined",
]);

const ENTRIES = Object.freeze({
  production: { page: "index.html", entry: "src/entrypoints/game.entry.js" },
  development: { page: "dev.html", entry: "src/entrypoints/dev.entry.js" },
});

// Analyses an authored source set ({ "src/...js": text, "index.html": text }) and lists rule violations.
class ArchitectureRules {
  constructor(files) {
    this.files = files;
    this.violations = [];
    this.graph = new Map();
  }

  analyse() {
    for (const [file, source] of Object.entries(this.files)) {
      if (file.startsWith("src/") && file.endsWith(".js")) this.#analyseModule(file, source);
    }
    this.#checkCycles();
    for (const [kind, { page, entry }] of Object.entries(ENTRIES)) this.#checkPage(kind, page, entry);
    const production = this.reachable(ENTRIES.production.entry);
    for (const file of production) {
      const layer = ArchitectureRules.layerOf(file);
      if (layer === "dev" || layer === "bootstrap/development") this.#fail(`production reaches DEV module ${file}`);
    }
    return this.violations;
  }

  static layerOf(file) {
    return LAYERS.find(([prefix]) => file.startsWith(prefix))?.[1] ?? null;
  }

  reachable(entry) {
    const seen = new Set();
    const queue = this.graph.has(entry) ? [entry] : [];
    while (queue.length > 0) {
      const file = queue.pop();
      if (seen.has(file)) continue;
      seen.add(file);
      queue.push(...(this.graph.get(file) ?? []));
    }
    return seen;
  }

  edgeCount(files) {
    let count = 0;
    for (const file of files) count += this.graph.get(file)?.length ?? 0;
    return count;
  }

  #fail(message) {
    this.violations.push(message);
  }

  #analyseModule(file, source) {
    const layer = ArchitectureRules.layerOf(file);
    if (!layer) this.#fail(`${file} is outside every layer`);
    let ast;
    try {
      ast = espree.parse(source, { ecmaVersion: "latest", sourceType: "module", range: true });
    } catch (error) {
      this.#fail(`${file} does not parse as a module: ${error.message}`);
      this.graph.set(file, []);
      return;
    }
    const targets = [];
    for (const specifier of ArchitectureRules.#specifiers(ast)) {
      const target = this.#resolve(file, specifier);
      if (!target) continue;
      targets.push(target);
      const targetLayer = ArchitectureRules.layerOf(target);
      if (layer && targetLayer && !ALLOWED_IMPORTS[layer].includes(targetLayer)) {
        this.#fail(`${file} (${layer}) imports ${target} (${targetLayer})`);
      }
    }
    this.graph.set(file, targets);
    if (layer && !HOST_LAYERS.has(layer)) {
      const scope = eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType: "module" });
      const names = new Set(scope.globalScope.through.map((reference) => reference.identifier.name));
      for (const name of names) {
        if (!ECMASCRIPT_GLOBALS.has(name)) this.#fail(`${file} (${layer}) uses host global ${name}`);
      }
    }
  }

  static #specifiers(ast) {
    const specifiers = [];
    const visit = (node) => {
      if (!node || typeof node.type !== "string") return;
      if (["ImportDeclaration", "ExportNamedDeclaration", "ExportAllDeclaration"].includes(node.type) && node.source) {
        specifiers.push(node.source.value);
      }
      if (node.type === "ImportExpression") {
        specifiers.push(node.source.type === "Literal" ? node.source.value : null);
      }
      for (const key of Object.keys(node)) {
        const value = node[key];
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value.type === "string") visit(value);
      }
    };
    visit(ast);
    return specifiers;
  }

  #resolve(file, specifier) {
    if (typeof specifier !== "string") {
      this.#fail(`${file} has a non-literal dynamic import`);
      return null;
    }
    if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
      this.#fail(`${file} imports a non-relative specifier ${specifier}`);
      return null;
    }
    if (!specifier.endsWith(".js")) this.#fail(`${file} imports ${specifier} without an explicit .js extension`);
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
    if (!Object.hasOwn(this.files, target)) {
      this.#fail(`${file} imports unresolved ${specifier}`);
      return null;
    }
    return target;
  }

  #checkCycles() {
    const state = new Map();
    const stack = [];
    const visit = (file) => {
      state.set(file, "open");
      stack.push(file);
      for (const target of this.graph.get(file) ?? []) {
        if (state.get(target) === "open") {
          this.#fail(`import cycle: ${[...stack.slice(stack.indexOf(target)), target].join(" -> ")}`);
        } else if (!state.has(target)) {
          visit(target);
        }
      }
      stack.pop();
      state.set(file, "done");
    };
    for (const file of [...this.graph.keys()].sort()) if (!state.has(file)) visit(file);
  }

  #checkPage(kind, page, entry) {
    const html = this.files[page];
    if (typeof html !== "string") {
      this.#fail(`${page} is missing`);
      return;
    }
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/giu)];
    const entryScript = new RegExp(`^\\s+type="module"\\s+src="${entry.replaceAll(".", "\\.")}(\\?v=[0-9.]+)?"\\s*$`, "u");
    if (scripts.length !== 1 || !entryScript.test(scripts[0][1]) || scripts[0][2].trim() !== "") {
      this.#fail(`${page} must load exactly one module script: ${entry}`);
    }
    if (!this.graph.has(entry)) this.#fail(`${kind} entry ${entry} is missing`);
  }
}

class ProjectSources {
  static read(projectRoot) {
    const files = {};
    const walk = (directory) => {
      for (const entry of fs.readdirSync(path.join(projectRoot, directory), { withFileTypes: true })) {
        const relative = `${directory}/${entry.name}`;
        if (entry.isDirectory()) walk(relative);
        else if (relative.endsWith(".js")) files[relative] = fs.readFileSync(path.join(projectRoot, relative), "utf8");
      }
    };
    walk("src");
    for (const { page } of Object.values(ENTRIES)) files[page] = fs.readFileSync(path.join(projectRoot, page), "utf8");
    return files;
  }
}

// Negative fixtures: each one must produce exactly the expected kind of violation.
function checkFixtures() {
  const pages = {
    "index.html": '<body><script type="module" src="src/entrypoints/game.entry.js?v=1.0.0"></script></body>',
    "dev.html": '<body><script type="module" src="src/entrypoints/dev.entry.js"></script></body>',
  };
  const base = {
    ...pages,
    "src/entrypoints/game.entry.js": 'import "../bootstrap/production/start.js";',
    "src/entrypoints/dev.entry.js": 'import "../bootstrap/development/start.js";',
    "src/bootstrap/production/start.js": 'import { Rule } from "../../game/domain/rule.js"; new Rule();',
    "src/bootstrap/development/start.js": 'import "../production/start.js"; import "../../dev/panel.js";',
    "src/game/domain/rule.js": 'import { clamp } from "../../engine/math.js"; export class Rule { value() { return clamp(Math.PI); } }',
    "src/engine/math.js": "export const clamp = (value) => Math.min(1, value);",
    "src/dev/panel.js": "export const panel = () => document.body;",
  };
  assert.deepEqual(new ArchitectureRules(base).analyse(), [], "valid fixture passes");
  const cases = [
    ["layer direction", { "src/game/domain/rule.js": 'import "../../platform/dom.js"; export class Rule {}', "src/platform/dom.js": "" }, /imports src\/platform\/dom\.js \(platform\)/u],
    ["raw config imports", { "src/game/config/raw/fish.js": 'import "../../../engine/math.js";' }, /game\/config\/raw\) imports src\/engine\/math\.js/u],
    ["game entry imports DEV bootstrap", { "src/entrypoints/game.entry.js": 'import "../bootstrap/development/start.js";' }, /entrypoint\/game\) imports/u],
    ["production reaches DEV", { "src/bootstrap/production/start.js": 'import "../../dev/panel.js";' }, /bootstrap\/production\) imports src\/dev\/panel\.js/u],
    ["host global", { "src/game/domain/rule.js": "export class Rule { save() { localStorage.clear(); } }" }, /uses host global localStorage/u],
    ["import cycle", { "src/engine/math.js": 'import "./other.js"; export const clamp = (v) => v;', "src/engine/other.js": 'import "./math.js";' }, /import cycle/u],
    ["extension", { "src/engine/math.js": 'import "./other"; export const clamp = (v) => v;', "src/engine/other.js": "" }, /without an explicit \.js extension/u],
    ["unresolved", { "src/engine/math.js": 'import "./missing.js"; export const clamp = (v) => v;' }, /imports unresolved/u],
    ["bare specifier", { "src/engine/math.js": 'import "lodash"; export const clamp = (v) => v;' }, /non-relative specifier lodash/u],
    ["dynamic import", { "src/engine/math.js": "export const clamp = (v) => import(v);" }, /non-literal dynamic import/u],
    ["outside layers", { "src/misc.js": "" }, /outside every layer/u],
    ["second page script", { "index.html": pages["index.html"] + "<script>start()</script>" }, /index\.html must load exactly one module script/u],
    ["inline module", { "dev.html": '<script type="module">import "./src/entrypoints/dev.entry.js";</script>' }, /dev\.html must load exactly one module script/u],
  ];
  for (const [name, overrides, expected] of cases) {
    const violations = new ArchitectureRules({ ...base, ...overrides }).analyse();
    assert(violations.some((violation) => expected.test(violation)), `${name} fixture is rejected: ${violations.join("; ")}`);
  }
  return cases.length;
}

const fixtures = checkFixtures();
const rules = new ArchitectureRules(ProjectSources.read(PROJECT_ROOT));
const violations = rules.analyse();
if (violations.length > 0) {
  for (const violation of violations) console.error(`- ${violation}`);
  throw new Error(`${violations.length} architecture violation(s)`);
}
const production = rules.reachable(ENTRIES.production.entry);
const development = rules.reachable(ENTRIES.development.entry);
console.log(`Architecture passed: ${rules.graph.size} modules; production ${production.size} modules / ` +
  `${rules.edgeCount(production)} imports, DEV ${development.size} / ${rules.edgeCount(development)}; ` +
  `no forbidden layer edge, cycle, host global outside platform/dev or production DEV import; ${fixtures} negative fixtures.`);
