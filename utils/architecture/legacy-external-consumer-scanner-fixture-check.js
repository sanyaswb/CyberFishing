const assert = require("node:assert/strict");
const architecture = require("../../architecture/module_architecture.json");
const {
  LegacyExternalConsumerScannerFactory,
} = require("./observation/consumers/legacy_external_consumer_scanner");

const contract = architecture.migrationManifest.observationContract;
const scanner = new LegacyExternalConsumerScannerFactory().create(contract);

function consumer(
  symbol,
  mechanism = "identifier",
  accessRequirement = "required",
  executionPhase = "eager",
) {
  return { symbol, mechanism, accessRequirement, executionPhase };
}

function issue(code, message) {
  return { code, message };
}

function environment(
  status = "verified",
  builtins = [],
  browserApis = [],
  dynamicConstructs = [],
  issues = [],
) {
  return { status, builtins, browserApis, dynamicConstructs, issues };
}

const fixtures = [
  {
    name: "scope resolution excludes every local binding form",
    source: `
      function localScope(parameter, { destructured }) {
        const localConst = 1;
        let localLet = 2;
        var localVar = 3;
        try { throw 1; } catch (caught) { localLet += caught; }
        class LocalClass { method(methodParameter) { return methodParameter; } }
        return parameter + destructured + localConst + localLet + localVar + LocalClass;
      }
      const { force } = fish;
      Fish.create(force);
    `,
    consumers: {
      status: "verified",
      items: [consumer("Fish"), consumer("fish")],
      issues: [],
    },
    environment: environment(),
  },
  {
    name: "identifier and static global property mechanisms",
    source: `
      Fish.create();
      window.GameClock.now();
      globalThis["CONFIG"].physics;
      window[\`StaticTool\`].run();
      window[7].run();
    `,
    consumers: {
      status: "verified",
      items: [
        consumer("7", "window-property"),
        consumer("CONFIG", "global-this-property"),
        consumer("Fish"),
        consumer("GameClock", "window-property"),
        consumer("StaticTool", "window-property"),
      ],
      issues: [],
    },
    environment: environment(
      "verified",
      ["globalThis"],
      ["window"],
    ),
  },
  {
    name: "execution phase is independent from access requirement",
    source: `
      const flag = true;
      const button = {};
      Eager.use();
      if (flag) Conditional.use();
      button.onclick = () => Deferred.use();
      function later() { if (flag) NestedDeferred.use(); }
      class PhaseFixture {
        field = InstanceField.use();
        static staticField = StaticField.use();
        static { StaticBlock.use(); }
        method() { Method.use(); }
      }
    `,
    consumers: {
      status: "verified",
      items: [
        consumer("Conditional", "identifier", "required", "conditional"),
        consumer("Deferred", "identifier", "required", "deferred"),
        consumer("Eager"),
        consumer("InstanceField", "identifier", "required", "deferred"),
        consumer("Method", "identifier", "required", "deferred"),
        consumer("NestedDeferred", "identifier", "required", "deferred"),
        consumer("StaticBlock"),
        consumer("StaticField"),
      ],
      issues: [],
    },
    environment: environment(),
  },
  {
    name: "typeof and dominating guards preserve guarded consumers",
    source: `
      if (typeof GodMode !== "undefined") GodMode.enable();
      typeof OptionalTool;
      if (typeof Missing === "undefined") fallback(); else Missing.run();
      typeof window.DebugRuntime !== "undefined" && window.DebugRuntime.run();
      window.OptionalRuntime?.();
      if (window.GuardedRuntime) window.GuardedRuntime.run();
    `,
    consumers: {
      status: "verified",
      items: [
        consumer(
          "DebugRuntime",
          "window-property",
          "guarded",
          "conditional",
        ),
        consumer("DebugRuntime", "window-property", "guarded"),
        consumer(
          "GodMode",
          "identifier",
          "guarded",
          "conditional",
        ),
        consumer("GodMode", "identifier", "guarded"),
        consumer(
          "GuardedRuntime",
          "window-property",
          "guarded",
          "conditional",
        ),
        consumer("GuardedRuntime", "window-property", "guarded"),
        consumer(
          "Missing",
          "identifier",
          "guarded",
          "conditional",
        ),
        consumer("Missing", "identifier", "guarded"),
        consumer("OptionalRuntime", "window-property", "guarded"),
        consumer("OptionalTool", "identifier", "guarded"),
        consumer("fallback", "identifier", "required", "conditional"),
      ],
      issues: [],
    },
    environment: environment("verified", [], ["window"]),
  },
  {
    name: "property names and binding keys are not false consumers",
    source: `
      fish.force;
      const { force } = fish;
      const object = { force: fish, method() { return fish; } };
      const { [dynamicKey]: localValue } = fish;
      object.method(force, localValue);
    `,
    consumers: {
      status: "verified",
      items: [
        consumer("dynamicKey"),
        consumer("fish", "identifier", "required", "deferred"),
        consumer("fish"),
      ],
      issues: [],
    },
    environment: environment(),
  },
  {
    name: "write-only global targets do not become consumers",
    source: `
      window.ProviderOnly = 1;
      globalThis.TargetOnly = 2;
      window.ReadWrite += 1;
      window.Updated++;
      ({ value: window.PatternTarget } = source);
      window.Container.value = 1;
      delete window.Deleted;
      for (window.LoopTarget of values) consume(values);
    `,
    consumers: {
      status: "verified",
      items: [
        consumer("Container", "window-property"),
        consumer("ReadWrite", "window-property"),
        consumer("Updated", "window-property"),
        consumer("consume", "identifier", "required", "conditional"),
        consumer("source"),
        consumer("values", "identifier", "required", "conditional"),
        consumer("values"),
      ],
      issues: [],
    },
    environment: environment(
      "verified",
      ["globalThis"],
      ["window"],
    ),
  },
  {
    name: "language runtime and browser APIs are separate observations",
    source: `
      const callback = () => {};
      const data = {};
      Math.max(1, 2);
      Array.from([]);
      Promise.resolve();
      document.body;
      localStorage.getItem("key");
      requestAnimationFrame(callback);
      console.log(structuredClone(data));
    `,
    consumers: { status: "verified", items: [], issues: [] },
    environment: environment(
      "verified",
      ["Array", "Math", "Promise"],
      [
        "console",
        "document",
        "localStorage",
        "requestAnimationFrame",
        "structuredClone",
      ],
    ),
  },
  {
    name: "dynamic and unsupported constructs remain partial without guesses",
    source: `
      window[propertyName].run();
      globalThis[keyName];
      eval(sourceText);
      new Function(sourceText);
      setTimeout("DynamicTool.run()", 0);
      with (context) { Hidden.run(); window.HiddenGlobal; }
      Safe.use();
    `,
    consumers: {
      status: "partial",
      items: [
        consumer("Safe"),
        consumer("context"),
        consumer("keyName"),
        consumer("propertyName"),
        consumer("sourceText"),
      ],
      issues: [
        issue(
          "computed-global-this-property",
          "A dynamic global-object property name cannot identify a consumer symbol safely.",
        ),
        issue(
          "computed-window-property",
          "A dynamic global-object property name cannot identify a consumer symbol safely.",
        ),
        issue(
          "eval-call",
          "Eval may create or consume symbols that static observation cannot prove.",
        ),
        issue(
          "function-constructor",
          "The Function constructor may consume symbols through dynamic code.",
        ),
        issue(
          "string-code-execution",
          "A timer with string code prevents complete static consumer observation.",
        ),
        issue(
          "with-statement",
          "A with statement prevents complete static consumer observation.",
        ),
      ],
    },
    environment: environment(
      "partial",
      ["Function", "eval", "globalThis"],
      ["setTimeout", "window"],
      [
        "computed-global-this-property",
        "computed-window-property",
        "eval-call",
        "function-constructor",
        "string-code-execution",
        "with-statement",
      ],
      [
        issue(
          "computed-global-this-property",
          "A dynamic global-object property name cannot identify a consumer symbol safely.",
        ),
        issue(
          "computed-window-property",
          "A dynamic global-object property name cannot identify a consumer symbol safely.",
        ),
        issue(
          "eval-call",
          "Eval may create or consume symbols that static observation cannot prove.",
        ),
        issue(
          "function-constructor",
          "The Function constructor may consume symbols through dynamic code.",
        ),
        issue(
          "string-code-execution",
          "A timer with string code prevents complete static consumer observation.",
        ),
        issue(
          "with-statement",
          "A with statement prevents complete static consumer observation.",
        ),
      ],
    ),
  },
  {
    name: "shadowed environment globals stay local",
    source: `
      function local(window, globalThis, Math, document) {
        window.NotGlobal;
        globalThis.NotGlobalEither;
        Math.max(1, 2);
        document.body;
      }
    `,
    consumers: { status: "verified", items: [], issues: [] },
    environment: environment(),
  },
  {
    name: "confirmed empty is distinct from pending",
    source: `(() => { const localOnly = 1; return localOnly; })();`,
    consumers: { status: "verified", items: [], issues: [] },
    environment: environment(),
  },
  {
    name: "parse failure cannot expose consumer or environment results",
    source: `class Broken {`,
    consumers: {
      status: "failed",
      items: [],
      issues: [
        issue(
          "parse-failure",
          "Source cannot be parsed as a browser classic script.",
        ),
      ],
    },
    environment: environment(
      "failed",
      [],
      [],
      [],
      [
        issue(
          "parse-failure",
          "Source cannot be parsed as a browser classic script.",
        ),
      ],
    ),
  },
];

for (const fixture of fixtures) {
  const request = {
    currentPath: `fixture/${fixture.name}.js`,
    source: fixture.source,
  };
  const first = scanner.scan(request);
  const second = scanner.scan(request);
  assert.deepEqual(first.consumers, fixture.consumers, fixture.name);
  assert.deepEqual(first.environment, fixture.environment, fixture.name);
  assert.deepEqual(second, first, `${fixture.name}: scanner is not deterministic`);
  validateExecutableContract(first, fixture.name);
}

console.log(
  `Legacy external consumer scanner fixtures passed (${fixtures.length} cases).`,
);

function validateExecutableContract(observation, fixtureName) {
  const model = contract.consumerModel;
  const mechanisms = new Set(model.mechanisms);
  const requirements = new Set(model.accessRequirements);
  const phases = new Set(model.executionPhases);
  assert.notEqual(observation.consumers.status, "pending", fixtureName);
  assert.notEqual(observation.environment.status, "pending", fixtureName);
  for (const item of observation.consumers.items) {
    assert.deepEqual(Object.keys(item), model.requiredFields, fixtureName);
    assert(mechanisms.has(item.mechanism), fixtureName);
    assert(requirements.has(item.accessRequirement), fixtureName);
    assert(phases.has(item.executionPhase), fixtureName);
  }
  for (const observedIssue of observation.consumers.issues) {
    assert.deepEqual(Object.keys(observedIssue), contract.issueFields, fixtureName);
  }
  for (const symbol of observation.environment.builtins) {
    assert(contract.environmentModel.builtins.includes(symbol), fixtureName);
  }
  for (const symbol of observation.environment.browserApis) {
    assert(contract.environmentModel.browserApis.includes(symbol), fixtureName);
  }
  for (const kind of observation.environment.dynamicConstructs) {
    assert(
      contract.environmentModel.dynamicConstructKinds.includes(kind),
      fixtureName,
    );
  }
}
