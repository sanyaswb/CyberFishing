"use strict";

const assert = require("node:assert/strict");
const { DomainStateOwnershipObserver } = require("./domain_audit/domain_state_ownership_observer");
const { DomainConfigurationInputObserver } = require("./domain_audit/domain_configuration_input_observer");
const { DomainPerformanceRiskObserver } = require("./domain_audit/domain_performance_risk_observer");

class StageThreeSemanticObservationFixtureCheck {
  run() {
    const stateObserver = new DomainStateOwnershipObserver();
    const state = stateObserver.observe({
      currentPath: "src/domain/stateful.js",
      source: [
        "const registry = new Map();",
        "class Stateful {",
        "  constructor() { this.score = 0; this.service = new Service(); }",
        "  update(frame) { this.score += frame.delta; frame.total = this.score; }",
        "}",
      ].join("\n"),
      environment: { browserApis: ["localStorage"] },
      dependencySymbols: ["Service"],
    });
    assert.equal(state.status, "partial");
    assert.equal(state.facts.classification, "authoritative-owner");
    assert(state.facts.authoritativeOwners.includes("Stateful#score"));
    assert(state.facts.reads.includes("Stateful#score"));
    assert(state.facts.writes.includes("parameter:frame.total"));
    assert(state.facts.persistenceBoundaries.includes("browser:localStorage"));
    assert(state.facts.issues.some((issue) => issue.startsWith(
      "module-global-mutable-state:module:src/domain/stateful.js#registry",
    )));
    assert(state.facts.issues.some((issue) =>
      issue.startsWith("self-composition:Stateful->Service@")
    ));
    assert(state.facts.issues.some((issue) =>
      issue.includes("collection-state-requires-cache-review")
    ));

    const stateless = stateObserver.observe({
      currentPath: "src/domain/stateless.js",
      source: "class Calculator { calculate(value) { return value * 2; } }",
      environment: { browserApis: [] },
    });
    assert.equal(stateless.status, "verified");
    assert.equal(stateless.facts.classification, "stateless");

    const configObserver = new DomainConfigurationInputObserver();
    const configEntry = this.#entry("src/domain/configured.js", "classified");
    configEntry.analysis.dependencies.confirmed = [
      this.#dependency("CONFIG", "src/config/config.js"),
      this.#dependency("Rule", "src/domain/rule.js"),
    ];
    const moduleByPath = new Map([
      ["src/config/config.js", this.#target("src/config/config.js", "game-config")],
      ["src/domain/rule.js", this.#target("src/domain/rule.js", "game-domain")],
    ]);
    const config = configObserver.observe({ entry: configEntry, moduleByPath });
    assert.deepEqual(config.facts.inputs, [{
      source: "src/config/config.js",
      delivery: "global-read",
    }]);
    assert.deepEqual(config.facts.forbiddenDirectReads, [
      "src/config/config.js:CONFIG",
    ]);
    const esmEntry = this.#entry("src/domain/esm.js", "esm");
    esmEntry.analysis.dependencies.confirmed = [
      this.#dependency("CONFIG", "src/config/config.js"),
    ];
    assert.equal(
      configObserver.observe({ entry: esmEntry, moduleByPath }).facts.inputs[0].delivery,
      "direct-import",
    );

    const performanceObserver = new DomainPerformanceRiskObserver();
    const performance = performanceObserver.observe({
      currentPath: "src/domain/loop.js",
      source: [
        "class Loop {",
        "  update(deltaTime) { const frame = {}; return new Frame(frame, deltaTime); }",
        "}",
      ].join("\n"),
      browserIdentifiers: ["console"],
    });
    assert.equal(performance.facts.hotLoopParticipation, "direct");
    assert.equal(performance.facts.perFrameAllocations, "observed");
    assert.equal(performance.facts.deltaTimeSemantics, "preserved");
    assert.equal(performance.facts.updateRenderSeparation, "separated");
    assert.deepEqual(performance.facts.browserAccess, ["console"]);

    const mixed = performanceObserver.observe({
      currentPath: "src/domain/mixed.js",
      source: "class Mixed { update() {} render() {} }",
      browserIdentifiers: [],
    });
    assert.equal(mixed.facts.updateRenderSeparation, "mixed");
    assert.equal(mixed.facts.deltaTimeSemantics, "requires-review");
    const nonLoop = performanceObserver.observe({
      currentPath: "src/domain/value.js",
      source: "class Value { calculate() { return 1; } }",
      browserIdentifiers: [],
    });
    assert.equal(nonLoop.facts.hotLoopParticipation, "none");
    assert.equal(nonLoop.facts.perFrameAllocations, "unknown");

    const failed = stateObserver.observe({
      currentPath: "src/domain/broken.js",
      source: "class {",
      environment: { browserApis: [] },
    });
    assert.equal(failed.status, "failed");
    assert(failed.facts.issues.length > 0);
    assert(Object.isFrozen(state));

    console.log(
      "Stage 3 semantic observation fixtures passed: authoritative/participant/stateless state, " +
        "hidden mutable state, self-composition, cache review, persistence boundary, config delivery, " +
        "hot-loop allocations, deltaTime and update/render separation (18 cases).",
    );
  }

  #entry(currentPath, migrationStatus) {
    return {
      currentPath,
      architecture: { migrationStatus },
      analysis: { dependencies: { confirmed: [] } },
    };
  }

  #dependency(symbol, target) {
    return { symbol, target, resolution: "confirmed" };
  }

  #target(currentPath, targetBoundary) {
    return { currentPath, architecture: { targetBoundary } };
  }
}

new StageThreeSemanticObservationFixtureCheck().run();
