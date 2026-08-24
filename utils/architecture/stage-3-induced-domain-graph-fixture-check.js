"use strict";

const assert = require("node:assert/strict");
const {
  UnifiedDependencyGraphBuilder,
} = require("./guards/graph/unified_dependency_graph");
const {
  InducedDomainGraphBuilder,
} = require("./domain_audit/induced_domain_graph_builder");

class StageThreeInducedDomainGraphFixtureCheck {
  run() {
    const manifest = { modules: this.#modules() };
    const unifiedGraph = new UnifiedDependencyGraphBuilder().build({
      manifest,
      esmResults: this.#esmResults(),
      bridgeRegistry: { bridges: [] },
    });
    const graphBuilder = new InducedDomainGraphBuilder();
    const graph = graphBuilder.build({
      manifest,
      unifiedGraph: {
        nodes: unifiedGraph.nodes,
        edges: [
          ...unifiedGraph.edges,
          {
            source: "src/domain/a.js",
            target: "src/domain/a.js",
            mechanisms: ["legacy-confirmed"],
            provenance: [{ symbols: ["Self"] }],
          },
        ],
      },
    });

    assert.deepEqual(graph.nodes(), ["src/domain/a.js", "src/domain/b.js"]);
    assert.equal(graph.internalDependencies().length, 1);
    assert.equal(graph.externalDependencies().length, 2);
    assert.equal(graph.incomingDependencies().length, 2);

    const internal = graph.internalDependencies()[0];
    assert.equal(internal.source, "src/domain/a.js");
    assert.equal(internal.target, "src/domain/b.js");
    assert.deepEqual(internal.mechanisms, ["legacy-confirmed", "static-import"]);
    assert.deepEqual(internal.symbols, ["B", "ImportedB"]);
    assert.deepEqual(internal.executionPhases, ["deferred", "eager"]);

    assert.deepEqual(
      graph.externalDependencies().map((edge) => [
        edge.source,
        edge.target,
        edge.targetBoundary,
      ]),
      [
        ["src/domain/a.js", "src/platform/c.js", "platform"],
        ["src/domain/b.js", "src/platform/c.js", "platform"],
      ],
    );
    assert.deepEqual(graph.consumersOf("src/domain/a.js"), [{
      source: "src/presentation/x.js",
      sourceBoundary: "game-presentation",
      symbols: ["A"],
    }]);
    assert.deepEqual(graph.consumersOf("src/domain/b.js"), [{
      source: "src/domain/a.js",
      sourceBoundary: "game-domain",
      symbols: ["B", "ImportedB"],
    }]);

    const allEdges = [
      ...graph.internalDependencies(),
      ...graph.externalDependencies(),
      ...graph.incomingDependencies(),
    ];
    assert(!allEdges.some((edge) => edge.source === edge.target));
    assert(!allEdges.some((edge) => edge.target === "src/missing.js"));
    assert.match(graph.fingerprint, /^[a-f0-9]{64}$/u);

    const repeated = graphBuilder.build({ manifest, unifiedGraph });
    const repeatedAgain = graphBuilder.build({ manifest, unifiedGraph });
    assert.deepEqual(repeated.snapshot(), repeatedAgain.snapshot());
    assert(Object.isFrozen(graph));
    const mutableSnapshot = graph.snapshot();
    mutableSnapshot.nodes.pop();
    assert.equal(graph.nodes().length, 2);

    assert.throws(
      () => graphBuilder.build({ manifest: {}, unifiedGraph }),
      /requires Migration Manifest modules/u,
    );
    assert.throws(
      () => graphBuilder.build({ manifest, unifiedGraph: {} }),
      /requires an in-memory unified graph/u,
    );

    console.log(
      "Stage 3 induced domain graph fixtures passed: exact scope, " +
        "internal/external/incoming projections, legacy + ESM provenance, " +
        "derived reverse consumers, no self/speculative edges and immutable output (12 cases).",
    );
  }

  #modules() {
    const domainA = this.#module("src/domain/a.js", "game-domain", "migrating");
    domainA.analysis.dependencies.confirmed = [
      this.#confirmed("B", "src/domain/b.js", "deferred"),
      this.#confirmed("C", "src/platform/c.js", "conditional"),
    ];
    domainA.analysis.dependencies.items = [
      this.#item("src/domain/b.js", ["B"]),
      this.#item("src/platform/c.js", ["C"]),
    ];
    domainA.analysis.dependencies.unresolved = [{
      symbol: "Missing",
      target: "src/missing.js",
      resolution: "unresolved",
    }];

    const presentation = this.#module(
      "src/presentation/x.js",
      "game-presentation",
    );
    presentation.analysis.dependencies.confirmed = [
      this.#confirmed("A", "src/domain/a.js", "eager"),
    ];
    presentation.analysis.dependencies.items = [
      this.#item("src/domain/a.js", ["A"]),
    ];
    return [
      presentation,
      this.#module("src/platform/c.js", "platform"),
      this.#module("src/domain/b.js", "game-domain", "migrating"),
      domainA,
    ];
  }

  #esmResults() {
    return [
      {
        source: "src/domain/a.js",
        hasEsmSyntax: true,
        observations: [{
          resolutionStatus: "confirmed-project",
          resolvedTarget: "src/domain/b.js",
          mechanism: "static-import",
          symbols: ["ImportedB"],
          executionPhase: "eager",
        }],
      },
      {
        source: "src/domain/b.js",
        hasEsmSyntax: true,
        observations: [
          {
            resolutionStatus: "confirmed-project",
            resolvedTarget: "src/platform/c.js",
            mechanism: "static-import",
            symbols: ["C"],
            executionPhase: "eager",
          },
          {
            resolutionStatus: "dynamic-unresolved",
            resolvedTarget: "src/missing.js",
            mechanism: "dynamic-import",
          },
        ],
      },
      {
        source: "src/platform/c.js",
        hasEsmSyntax: false,
        observations: [],
      },
      {
        source: "src/presentation/x.js",
        hasEsmSyntax: false,
        observations: [],
      },
    ];
  }

  #module(currentPath, targetBoundary, migrationStatus = "classified") {
    return {
      currentPath,
      architecture: { targetBoundary, migrationStatus },
      analysis: {
        dependencies: {
          confirmed: [],
          items: [],
          unresolved: [],
          ambiguous: [],
        },
      },
    };
  }

  #confirmed(symbol, target, executionPhase) {
    return {
      symbol,
      target,
      mechanism: "identifier",
      accessRequirement: "required",
      executionPhase,
      resolution: "confirmed",
    };
  }

  #item(target, symbols) {
    return { target, symbols, resolution: "confirmed" };
  }
}

new StageThreeInducedDomainGraphFixtureCheck().run();
