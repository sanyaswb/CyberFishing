"use strict";

const assert = require("node:assert/strict");
const { InducedDomainGraph } = require("./domain_audit/induced_domain_graph");
const {
  DomainDependencyTopologyAnalyzer,
} = require("./domain_audit/domain_dependency_topology_analyzer");

class StageThreeDomainTopologyFixtureCheck {
  run() {
    const analyzer = new DomainDependencyTopologyAnalyzer();
    const graph = this.#graph(
      ["a", "b", "c", "d", "e"],
      [
        ["a", "b"],
        ["b", "a"],
        ["b", "c"],
        ["c", "d"],
        ["e", "e"],
      ],
    );
    const topology = analyzer.analyze(graph);

    assert.equal(topology.components().length, 4);
    assert.equal(topology.cycles().length, 1);
    assert.equal(topology.minimumDepth, 0);
    assert.equal(topology.maximumDepth, 2);
    assert.equal(topology.depthOf("a"), 2);
    assert.equal(topology.depthOf("b"), 2);
    assert.equal(topology.depthOf("c"), 1);
    assert.equal(topology.depthOf("d"), 0);
    assert.equal(topology.depthOf("e"), 0);

    const cyclic = topology.componentOf("a");
    assert.deepEqual(cyclic.members, ["a", "b"]);
    assert.deepEqual(cyclic.internalEdges, [
      { source: "a", target: "b" },
      { source: "b", target: "a" },
    ]);
    assert.equal(cyclic.cyclic, true);
    assert.match(cyclic.id, /^scc-[a-f0-9]{12}$/u);
    assert.equal(topology.componentOf("b").id, cyclic.id);
    assert.deepEqual(topology.cycles()[0], {
      sccId: cyclic.id,
      classification: "structural-cycle",
      members: ["a", "b"],
      internalEdges: [
        { source: "a", target: "b" },
        { source: "b", target: "a" },
      ],
      path: ["a", "b", "a"],
    });
    assert.equal(topology.componentOf("e").cyclic, false);
    assert.equal(
      topology.componentOf("e").internalEdges.length,
      0,
      "Self-resolution must not become a module cycle",
    );

    const shuffled = this.#graph(
      ["a", "b", "c", "d", "e"],
      [
        ["c", "d"],
        ["b", "c"],
        ["b", "a"],
        ["a", "b"],
      ],
    );
    const shuffledTopology = analyzer.analyze(shuffled);
    assert.deepEqual(shuffledTopology.components(), topology.components());
    assert.deepEqual(shuffledTopology.cycles(), topology.cycles());
    assert.deepEqual(shuffledTopology.depths(), topology.depths());
    assert.deepEqual(analyzer.analyze(graph).snapshot(), topology.snapshot());

    const threeNodeCycle = analyzer.analyze(this.#graph(
      ["a", "b", "c"],
      [["a", "b"], ["b", "c"], ["c", "a"]],
    ));
    const expandedInternalEdges = analyzer.analyze(this.#graph(
      ["a", "b", "c"],
      [["a", "b"], ["a", "c"], ["b", "c"], ["c", "a"]],
    ));
    assert.notEqual(
      threeNodeCycle.components()[0].id,
      expandedInternalEdges.components()[0].id,
      "Canonical SCC identity must change with its internal edge set",
    );

    const snapshot = topology.snapshot();
    snapshot.components.pop();
    assert.equal(topology.components().length, 4);
    assert(Object.isFrozen(topology));
    assert.match(topology.fingerprint, /^[a-f0-9]{64}$/u);
    assert.equal(topology.depthOf("missing"), null);
    assert.equal(topology.componentOf("missing"), null);

    assert.throws(
      () => analyzer.analyze({}),
      /requires an induced domain graph/u,
    );
    assert.throws(
      () => analyzer.analyze(this.#invalidExternalEdgeGraph()),
      /must remain inside exact scope/u,
    );

    console.log(
      "Stage 3 domain topology fixtures passed: Tarjan SCC, canonical identity, " +
        "canonical cycle diagnostics, condensation depth, self-edge exclusion, " +
        "determinism, validation and immutability (15 cases).",
    );
  }

  #graph(nodes, edgePairs) {
    const internalDependencies = edgePairs.map(([source, target]) => ({
      source,
      target,
      sourceBoundary: "game-domain",
      targetBoundary: "game-domain",
      symbols: [],
      executionPhases: [],
      mechanisms: ["fixture"],
      provenance: [],
    }));
    const value = {
      nodes,
      internalDependencies,
      externalDependencies: [],
      incomingDependencies: [],
    };
    value.fingerprint = InducedDomainGraph.fingerprint(value);
    return new InducedDomainGraph(value);
  }

  #invalidExternalEdgeGraph() {
    return {
      fingerprint: "fixture",
      nodes: () => ["a"],
      internalDependencies: () => [{ source: "a", target: "outside" }],
    };
  }
}

new StageThreeDomainTopologyFixtureCheck().run();
