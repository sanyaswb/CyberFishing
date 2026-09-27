"use strict";

const { InducedDomainGraph } = require("./induced_domain_graph");
const { DomainScopeSelector } = require("./domain_scope_selector");

class InducedDomainGraphBuilder {
  // `esmImportNames(provenance)` (optional) names the bindings of one static-import provenance item;
  // with it, ESM-to-ESM import edges carry their imported symbols and the eager (link-time) phase.
  constructor({ targetBoundary = "game-domain", esmImportNames = null } = {}) {
    this.targetBoundary = targetBoundary;
    this.esmImportNames = esmImportNames;
    this.scopeSelector = new DomainScopeSelector({ targetBoundary });
  }

  build({ manifest, unifiedGraph }) {
    const moduleByPath = this.#moduleIndex(manifest);
    this.#requireUnifiedGraph(unifiedGraph);
    const nodes = [...moduleByPath.values()]
      .filter((entry) => this.scopeSelector.includes(entry))
      .map((entry) => entry.currentPath)
      .sort(this.#compareText);
    const scope = new Set(nodes);
    const projectedEdges = unifiedGraph.edges
      .filter((edge) => edge.source !== edge.target)
      .map((edge) => this.#projectEdge(edge, moduleByPath))
      .sort(this.#compareEdge);
    const internalDependencies = projectedEdges.filter((edge) =>
      scope.has(edge.source) && scope.has(edge.target)
    );
    const externalDependencies = projectedEdges.filter((edge) =>
      scope.has(edge.source) && !scope.has(edge.target)
    );
    const incomingDependencies = projectedEdges.filter((edge) =>
      scope.has(edge.target)
    );
    const value = {
      nodes,
      internalDependencies,
      externalDependencies,
      incomingDependencies,
    };
    value.fingerprint = InducedDomainGraph.fingerprint(value);
    return new InducedDomainGraph(value);
  }

  #moduleIndex(manifest) {
    if (!Array.isArray(manifest?.modules)) {
      throw new Error("Induced domain graph requires Migration Manifest modules");
    }
    const result = new Map();
    for (const entry of manifest.modules) {
      if (typeof entry?.currentPath !== "string" || !entry.currentPath) {
        throw new Error("Induced domain graph requires valid currentPath values");
      }
      if (result.has(entry.currentPath)) {
        throw new Error(`Duplicate Manifest module: ${entry.currentPath}`);
      }
      if (typeof entry.architecture?.targetBoundary !== "string") {
        throw new Error(`${entry.currentPath}: targetBoundary is required`);
      }
      result.set(entry.currentPath, entry);
    }
    return result;
  }

  #requireUnifiedGraph(unifiedGraph) {
    if (!Array.isArray(unifiedGraph?.nodes) || !Array.isArray(unifiedGraph?.edges)) {
      throw new Error("Induced domain graph requires an in-memory unified graph");
    }
    for (const edge of unifiedGraph.edges) {
      if (
        typeof edge?.source !== "string" ||
        typeof edge?.target !== "string" ||
        !Array.isArray(edge?.mechanisms) ||
        !Array.isArray(edge?.provenance)
      ) {
        throw new Error("Unified graph contains an invalid dependency edge");
      }
    }
  }

  #projectEdge(edge, moduleByPath) {
    const sourceEntry = moduleByPath.get(edge.source);
    const targetEntry = moduleByPath.get(edge.target);
    const confirmed = sourceEntry?.analysis?.dependencies?.confirmed || [];
    const matchingConfirmed = confirmed.filter((item) =>
      item.resolution === "confirmed" && item.target === edge.target
    );
    const esmImports = this.esmImportNames
      ? edge.provenance.filter((item) => item.mechanism === "static-import") : [];
    const symbols = this.#sortedUnique([
      ...matchingConfirmed.map((item) => item.symbol),
      ...edge.provenance.flatMap((item) => item.symbols || []),
      ...esmImports.flatMap((item) => this.esmImportNames(item)),
    ].filter((item) => typeof item === "string" && item.length > 0));
    const executionPhases = this.#sortedUnique([
      ...matchingConfirmed.map((item) => item.executionPhase),
      ...edge.provenance.map((item) => item.executionPhase),
      ...(esmImports.length > 0 ? ["eager"] : []),
    ].filter((item) => typeof item === "string" && item.length > 0));
    return {
      source: edge.source,
      target: edge.target,
      sourceBoundary: sourceEntry?.architecture?.targetBoundary || null,
      targetBoundary: targetEntry?.architecture?.targetBoundary || null,
      symbols,
      executionPhases,
      mechanisms: this.#sortedUnique(edge.mechanisms),
      provenance: [...edge.provenance]
        .map((item) => this.#clone(item))
        .sort((left, right) =>
          this.#compareText(JSON.stringify(left), JSON.stringify(right))
        ),
    };
  }

  #sortedUnique(values) {
    return [...new Set(values)].sort(this.#compareText);
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

module.exports = { InducedDomainGraphBuilder };
