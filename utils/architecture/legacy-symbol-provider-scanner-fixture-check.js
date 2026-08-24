const assert = require("node:assert/strict");
const architecture = require("../../architecture/module_architecture.json");
const {
  LegacySymbolProviderScannerFactory,
} = require("./observation/providers/legacy_symbol_provider_scanner");

const contract = architecture.migrationManifest.observationContract;
const scanner = new LegacySymbolProviderScannerFactory().create(contract);

function provider(symbol, mechanism, availability = "program-init") {
  return { symbol, mechanism, availability };
}

function issue(code, message) {
  return { code, message };
}

const fixtures = [
  {
    name: "global declaration mechanisms and destructuring",
    source: `
      class Fish {}
      const CONFIG = {};
      let state;
      var Game = {};
      var { one: LegacyOne, nested: { two: LegacyTwo } } = input;
      function startGame() {}
    `,
    expected: {
      status: "verified",
      items: [
        provider("CONFIG", "global-lexical"),
        provider("Fish", "global-lexical"),
        provider("Game", "global-var"),
        provider("LegacyOne", "global-var"),
        provider("LegacyTwo", "global-var"),
        provider("startGame", "global-function"),
        provider("state", "global-lexical"),
      ],
      issues: [],
    },
  },
  {
    name: "global properties preserve runtime availability",
    source: `
      window.Direct = 1;
      globalThis["Static"] = 2;
      window[\`Template\`] = 3;
      if (enabled) window.Conditional = 4;
      function init() { globalThis.Deferred = 5; }
      class Registry {
        field = (window.FieldDeferred = 1);
        static staticField = (window.StaticField = 1);
        static { globalThis.StaticBlock = 1; }
        run() { window.MethodDeferred = 1; }
      }
    `,
    expected: {
      status: "verified",
      items: [
        provider("Conditional", "window-property", "conditional"),
        provider("Deferred", "global-this-property", "deferred"),
        provider("Direct", "window-property"),
        provider("FieldDeferred", "window-property", "deferred"),
        provider("MethodDeferred", "window-property", "deferred"),
        provider("Registry", "global-lexical"),
        provider("Static", "global-this-property"),
        provider("StaticBlock", "global-this-property"),
        provider("StaticField", "window-property"),
        provider("Template", "window-property"),
        provider("init", "global-function"),
      ],
      issues: [],
    },
  },
  {
    name: "shadowing and strict class contexts suppress false globals",
    source: `
      Loose = 1;
      function local(window, globalThis) {
        window.NotGlobal = 1;
        globalThis.NotGlobalEither = 1;
      }
      function strictFunction() {
        "use strict";
        StrictFunctionLeak = 1;
      }
      class StrictClass {
        field = (FieldLeak = 1);
        static staticField = (StaticFieldLeak = 1);
        static { StaticBlockLeak = 1; }
        method() { MethodLeak = 1; }
      }
    `,
    expected: {
      status: "verified",
      items: [
        provider("Loose", "implicit-global"),
        provider("StrictClass", "global-lexical"),
        provider("local", "global-function"),
        provider("strictFunction", "global-function"),
      ],
      issues: [],
    },
  },
  {
    name: "implicit globals support patterns and availability",
    source: `
      ({ first: PatternOne, nested: { second: PatternTwo } } = source);
      if (enabled) ConditionalLoose = 1;
      function initLoose() { DeferredLoose = 1; }
      for (LoopLoose of values) consume(LoopLoose);
    `,
    expected: {
      status: "verified",
      items: [
        provider("ConditionalLoose", "implicit-global", "conditional"),
        provider("DeferredLoose", "implicit-global", "deferred"),
        provider("LoopLoose", "implicit-global", "conditional"),
        provider("PatternOne", "implicit-global"),
        provider("PatternTwo", "implicit-global"),
        provider("initLoose", "global-function"),
      ],
      issues: [],
    },
  },
  {
    name: "static member targets inside assignment patterns",
    source: `
      ({ first: window.FromObjectPattern } = source);
      [globalThis.FromArrayPattern] = source;
    `,
    expected: {
      status: "verified",
      items: [
        provider("FromArrayPattern", "global-this-property"),
        provider("FromObjectPattern", "window-property"),
      ],
      issues: [],
    },
  },
  {
    name: "unsupported and dynamic constructs produce partial evidence",
    source: `
      window.Safe = 1;
      window[propertyName] = 2;
      globalThis[prefix + "Name"] = 3;
      window.Count++;
      Object.assign(window, { Assigned: 1 });
      Object.defineProperty(globalThis, "Defined", { value: 1 });
      eval("runtime source");
      new Function("runtime source");
      with (context) { window.Hidden = 1; HiddenLoose = 1; }
      if (flag) { function annexFunction() {} }
    `,
    expected: {
      status: "partial",
      items: [provider("Safe", "window-property")],
      issues: [
        issue(
          "annex-b-block-function",
          "A sloppy top-level block function has implementation-sensitive global semantics.",
        ),
        issue(
          "computed-global-this-property",
          "A dynamic global-object property name cannot be observed safely.",
        ),
        issue(
          "computed-window-property",
          "A dynamic global-object property name cannot be observed safely.",
        ),
        issue(
          "eval-call",
          "Direct eval may create providers that static observation cannot prove.",
        ),
        issue(
          "function-constructor",
          "The Function constructor may create unobservable runtime behavior.",
        ),
        issue(
          "global-object-mutation-api",
          "A global-object mutation API is outside the Stage 1.5.2 provider contract.",
        ),
        issue(
          "non-definitive-global-write",
          "A compound, logical, or update write does not prove provider creation.",
        ),
        issue(
          "with-statement",
          "A with statement prevents complete static provider observation.",
        ),
      ],
    },
  },
  {
    name: "strict program excludes Annex B and accidental globals",
    source: `
      "use strict";
      StrictLeak = 1;
      if (flag) { function lexicalBlockFunction() {} }
    `,
    expected: { status: "verified", items: [], issues: [] },
  },
  {
    name: "exact duplicate provider observations collapse deterministically",
    source: `window.Once = 1; window.Once = 2;`,
    expected: {
      status: "verified",
      items: [provider("Once", "window-property")],
      issues: [],
    },
  },
  {
    name: "provider sites preserve distinct availability and valid static keys",
    source: `
      window[7] = 1;
      window[""] = 2;
      window.Multi = 3;
      function reset() { window.Multi = null; }
    `,
    expected: {
      status: "partial",
      items: [
        provider("7", "window-property"),
        provider("Multi", "window-property", "deferred"),
        provider("Multi", "window-property"),
        provider("reset", "global-function"),
      ],
      issues: [
        issue(
          "empty-global-property",
          "An empty global-object property cannot be represented as a provider symbol.",
        ),
      ],
    },
  },
  {
    name: "confirmed empty observations remain verified",
    source: `(() => { const localOnly = 1; return localOnly; })();`,
    expected: { status: "verified", items: [], issues: [] },
  },
  {
    name: "ESM named exports are not legacy globals but bridge assignments are",
    source: `
      import { ExactSymbol } from "./exact_symbol.js";
      export class NamedContract {}
      globalThis.ExactSymbol = ExactSymbol;
    `,
    expected: {
      status: "verified",
      items: [provider("ExactSymbol", "global-this-property")],
      issues: [],
    },
  },
  {
    name: "parse failures cannot expose provider results",
    source: `class Broken {`,
    expected: {
      status: "failed",
      items: [],
      issues: [
        issue(
          "parse-failure",
          "Source cannot be parsed as JavaScript script or module.",
        ),
      ],
    },
  },
];

for (const fixture of fixtures) {
  const currentPath = `fixture/${fixture.name}.js`;
  const first = scanner.scan({ currentPath, source: fixture.source });
  const second = scanner.scan({ currentPath, source: fixture.source });
  assert.deepEqual(first.providers, fixture.expected, fixture.name);
  assert.deepEqual(second, first, `${fixture.name}: scanner is not deterministic`);
  validateExecutableContract(first.providers, fixture.name);
}

console.log(
  `Legacy provider scanner fixtures passed (${fixtures.length} cases).`,
);

function validateExecutableContract(observation, fixtureName) {
  assert.notEqual(observation.status, "pending", fixtureName);
  const mechanisms = new Set(contract.providerModel.mechanisms);
  const availabilities = new Set(contract.providerModel.availabilities);
  for (const item of observation.items) {
    assert.deepEqual(
      Object.keys(item),
      contract.providerModel.requiredFields,
      `${fixtureName}: provider record shape`,
    );
    assert(mechanisms.has(item.mechanism), fixtureName);
    assert(availabilities.has(item.availability), fixtureName);
  }
  for (const observedIssue of observation.issues) {
    assert.deepEqual(
      Object.keys(observedIssue),
      contract.issueFields,
      `${fixtureName}: issue record shape`,
    );
  }
}
