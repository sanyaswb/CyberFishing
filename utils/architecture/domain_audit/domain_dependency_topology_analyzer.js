"use strict";

const { CanonicalJson } = require("../guards/core/canonical_json");
const {
  TarjanStronglyConnectedComponents,
} = require("../guards/graph/tarjan_scc");
const { DomainDependencyTopology } = require("./domain_dependency_topology");

class DomainDependencyTopologyAnalyzer {
  constructor({ sccFinder = new TarjanStronglyConnectedComponents() } = {}) {
    this.sccFinder = sccFinder;
  }

  analyze(graph) {
    this.#requireGraph(graph);
    const nodes = graph.nodes();
    const nodeSet = new Set(nodes);
    const edges = graph.internalDependencies()
      .filter((edge) => edge.source !== edge.target)
      .map((edge) => ({ source: edge.source, target: edge.target }))
      .sort(this.#compareEdge);
    this.#requireInternalEdges(edges, nodeSet);
    const tarjanGraph = { nodes: [...nodes], edges };
    const rawComponents = this.sccFinder.find(tarjanGraph);
    const components = rawComponents.map((members) =>
      this.#component(members, edges)
    ).sort((left, right) => this.#compareText(left.id, right.id));
    const componentIndex = new Map();
    components.forEach((component, index) => {
      for (const member of component.members) componentIndex.set(member, index);
    });
    const adjacency = this.#condensationAdjacency(
      components,
      componentIndex,
      edges,
    );
    const depthByComponent = this.#componentDepths(adjacency);
    const moduleDepths = nodes.map((currentPath) => {
      const componentPosition = componentIndex.get(currentPath);
      return {
        currentPath,
        sccId: components[componentPosition].id,
        depth: depthByComponent.get(componentPosition),
      };
    }).sort((left, right) => this.#compareText(left.currentPath, right.currentPath));
    const cycleDiagnostics = components
      .filter((component) => component.cyclic)
      .map((component) => ({
        sccId: component.id,
        classification: "structural-cycle",
        members: [...component.members],
        internalEdges: this.#clone(component.internalEdges),
        path: this.sccFinder.canonicalCycle(component.members, tarjanGraph),
      }));
    const depths = moduleDepths.map((item) => item.depth);
    const value = {
      sourceGraphFingerprint: graph.fingerprint,
      components,
      cycleDiagnostics,
      moduleDepths,
      minimumDepth: depths.length > 0 ? Math.min(...depths) : 0,
      maximumDepth: depths.length > 0 ? Math.max(...depths) : 0,
    };
    value.fingerprint = CanonicalJson.fingerprint(value);
    return new DomainDependencyTopology(value);
  }

  #component(members, edges) {
    const memberSet = new Set(members);
    const internalEdges = edges
      .filter((edge) => memberSet.has(edge.source) && memberSet.has(edge.target))
      .map((edge) => ({ source: edge.source, target: edge.target }))
      .sort(this.#compareEdge);
    const identity = { members: [...members].sort(), internalEdges };
    return {
      id: `scc-${CanonicalJson.fingerprint(identity).slice(0, 12)}`,
      members: identity.members,
      internalEdges,
      cyclic: members.length > 1,
    };
  }

  #condensationAdjacency(components, componentIndex, edges) {
    const adjacency = new Map(components.map((_, index) => [index, new Set()]));
    for (const edge of edges) {
      const source = componentIndex.get(edge.source);
      const target = componentIndex.get(edge.target);
      if (source !== target) adjacency.get(source).add(target);
    }
    return adjacency;
  }

  #componentDepths(adjacency) {
    const depths = new Map();
    const visiting = new Set();
    const visit = (component) => {
      if (depths.has(component)) return depths.get(component);
      if (visiting.has(component)) {
        throw new Error("Condensation graph must be acyclic");
      }
      visiting.add(component);
      const dependencies = [...adjacency.get(component)].sort((a, b) => a - b);
      const depth = dependencies.length === 0
        ? 0
        : 1 + Math.max(...dependencies.map(visit));
      visiting.delete(component);
      depths.set(component, depth);
      return depth;
    };
    for (const component of adjacency.keys()) visit(component);
    return depths;
  }

  #requireGraph(graph) {
    if (
      typeof graph?.nodes !== "function" ||
      typeof graph?.internalDependencies !== "function" ||
      typeof graph?.fingerprint !== "string"
    ) {
      throw new Error("Domain topology requires an induced domain graph");
    }
    const nodes = graph.nodes();
    if (!Array.isArray(nodes) || nodes.some((node) =>
      typeof node !== "string" || node.length === 0
    )) {
      throw new Error("Induced domain graph contains invalid nodes");
    }
    const sorted = [...new Set(nodes)].sort(this.#compareText);
    if (
      sorted.length !== nodes.length ||
      nodes.some((node, index) => node !== sorted[index])
    ) {
      throw new Error("Induced domain graph nodes must be sorted and unique");
    }
  }

  #requireInternalEdges(edges, nodeSet) {
    for (const edge of edges) {
      if (!nodeSet.has(edge.source) || !nodeSet.has(edge.target)) {
        throw new Error(
          `Domain internal edge must remain inside exact scope: ${edge.source} → ${edge.target}`,
        );
      }
    }
    const keys = edges.map((edge) => `${edge.source}\u0000${edge.target}`);
    if (new Set(keys).size !== keys.length) {
      throw new Error("Domain internal dependency edges must be unique");
    }
  }

  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  #compareEdge(left, right) {
    const leftKey = `${left.source}\u0000${left.target}`;
    const rightKey = `${right.source}\u0000${right.target}`;
    if (leftKey < rightKey) return -1;
    if (leftKey > rightKey) return 1;
    return 0;
  }

  #compareText(left, right) {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }
}

module.exports = { DomainDependencyTopologyAnalyzer };
