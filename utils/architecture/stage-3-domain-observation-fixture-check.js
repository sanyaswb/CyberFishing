"use strict";

const assert = require("node:assert/strict");
const policy = require("../../architecture/module_architecture.json");
const {
  DomainSourceEffectObserver,
} = require("./domain_audit/domain_source_effect_observer");
const {
  DomainCapabilityClassifier,
} = require("./domain_audit/domain_capability_classifier");
const {
  DomainAvailabilityAnalyzer,
} = require("./domain_audit/domain_availability_analyzer");

class StageThreeDomainObservationFixtureCheck {
  run() {
    const sourceObserver = new DomainSourceEffectObserver();
    const observation = sourceObserver.observe({
      currentPath: "src/domain/a.js",
      source: [
        "const cache = {};",
        "let items = [];",
        "Registry.register('x');",
        "const service = new Service();",
        "if (enabled) ping();",
        "if (typeof window !== 'undefined') window.Legacy = service;",
        "function later() { hidden(); window.Deferred = service; }",
      ].join("\n"),
      environment: { browserApis: ["window"], dynamicConstructs: [], issues: [] },
    });
    assert.equal(observation.status, "verified");
    assert.deepEqual(
      observation.topLevelEffects.map((effect) => effect.kind),
      [
        "mutable-initialization",
        "mutable-initialization",
        "registration",
        "instantiation",
        "call",
        "assignment",
      ],
    );
    assert.deepEqual(observation.directGlobalObjects, []);
    assert(!observation.topLevelEffects.some((effect) => effect.location === "7:20"));

    const dynamic = sourceObserver.observe({
      currentPath: "src/domain/dynamic.js",
      source: "eval('runtimeName');",
      environment: { browserApis: [], dynamicConstructs: ["eval-call"], issues: [] },
    });
    assert.equal(dynamic.status, "partial");
    assert.deepEqual(dynamic.topLevelEffects, [{
      kind: "dynamic-code",
      location: "1:1",
      classification: "unknown",
    }]);
    assert(dynamic.issues.some((issue) => issue.code === "dynamic-code-call"));

    const classifier = new DomainCapabilityClassifier(
      policy.architectureGuards.browserCapabilities,
    );
    const entry = this.#entry("src/domain/a.js", ["window", "console"]);
    const capabilities = classifier.classify({ entry, sourceObservation: observation });
    assert.deepEqual(capabilities.capabilities, [{
      capability: "diagnostics",
      identifiers: ["console"],
      policy: "forbidden",
    }]);
    const directWindow = sourceObserver.observe({
      currentPath: "src/domain/window.js",
      source: "consume(window);",
      environment: { browserApis: ["window"], dynamicConstructs: [], issues: [] },
    });
    assert.deepEqual(
      classifier.classify({ entry, sourceObservation: directWindow }).capabilities,
      [
        {
          capability: "browser-runtime",
          identifiers: ["window"],
          policy: "forbidden",
        },
        {
          capability: "diagnostics",
          identifiers: ["console"],
          policy: "forbidden",
        },
      ],
    );

    const unknownEntry = this.#entry("src/domain/unknown.js", ["MysteryApi"]);
    const unknown = classifier.classify({
      entry: unknownEntry,
      sourceObservation: { directGlobalObjects: [] },
    });
    assert.equal(unknown.capabilities[0].policy, "unknown");
    assert.equal(unknown.issues[0].code, "unknown-browser-capability");

    const availability = new DomainAvailabilityAnalyzer(
      policy.migrationManifest.observationContract.resolutionModel,
    );
    const consumer = this.#entry("src/domain/consumer.js", []);
    consumer.analysis.dependencies.confirmed = [{
      symbol: "Service",
      mechanism: "identifier",
      accessRequirement: "required",
      executionPhase: "eager",
      target: "src/domain/provider.js",
      resolution: "confirmed",
    }];
    consumer.analysis.dependencies.unresolved = [{
      symbol: "Optional",
      mechanism: "identifier",
      accessRequirement: "guarded",
      executionPhase: "conditional",
      resolution: "unresolved",
    }];
    consumer.analysis.dependencies.ambiguous = [{
      symbol: "Duplicate",
      mechanism: "identifier",
      accessRequirement: "required",
      executionPhase: "deferred",
      resolution: "ambiguous",
      candidates: ["src/a.js", "src/b.js"],
    }];
    const provider = this.#entry("src/domain/provider.js", []);
    provider.observed.providers.items = [
      { symbol: "Service", mechanism: "global-lexical", availability: "program-init" },
      { symbol: "Service", mechanism: "window-property", availability: "conditional" },
    ];
    assert.deepEqual(
      availability.analyze({
        entry: consumer,
        moduleByPath: new Map([[provider.currentPath, provider]]),
      }),
      [
        {
          symbol: "Duplicate",
          target: null,
          consumerPhase: "deferred",
          providerAvailability: "ambiguous",
          resolution: "ambiguous",
        },
        {
          symbol: "Optional",
          target: null,
          consumerPhase: "conditional",
          providerAvailability: "missing",
          resolution: "unresolved",
        },
        {
          symbol: "Service",
          target: "src/domain/provider.js",
          consumerPhase: "eager",
          providerAvailability: "program-init",
          resolution: "confirmed",
        },
      ],
    );

    assert.throws(
      () => new DomainCapabilityClassifier({}),
      /requires browser policy/u,
    );
    assert(Object.isFrozen(observation));
    console.log(
      "Stage 3 domain observation fixtures passed: boundary capabilities, " +
        "global-container exclusion, availability compatibility, eager/conditional/deferred " +
        "semantics, top-level effects, deferred exclusion and dynamic partial status (14 cases).",
    );
  }

  #entry(currentPath, browserApis) {
    return {
      currentPath,
      architecture: { targetBoundary: "game-domain" },
      observed: {
        providers: { items: [] },
        environment: { browserApis },
      },
      analysis: {
        dependencies: { confirmed: [], unresolved: [], ambiguous: [] },
      },
    };
  }
}

new StageThreeDomainObservationFixtureCheck().run();
