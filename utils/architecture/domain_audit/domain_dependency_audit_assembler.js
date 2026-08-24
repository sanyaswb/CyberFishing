"use strict";

const { CanonicalJson } = require("../guards/core/canonical_json");

class DomainDependencyAuditAssembler {
  constructor(policy) {
    this.boundaryById = new Map(
      policy.targetBoundaries.map((boundary) => [boundary.id, boundary]),
    );
  }

  assemble({
    entry,
    graph,
    topology,
    sourceObservation,
    capabilityObservation,
    availabilityConstraints,
  }) {
    const dependencies = graph.dependenciesOf(entry.currentPath);
    const issues = [
      ...sourceObservation.issues,
      ...capabilityObservation.issues,
    ].map((issue) => `${issue.code}: ${issue.message}`);
    this.#observeIncompleteEdges(dependencies, issues);
    const internalDependencies = dependencies.internal.map((edge) => ({
      target: edge.target,
      symbols: [...edge.symbols],
      executionPhases: [...edge.executionPhases],
    }));
    const externalDependencies = dependencies.external.map((edge) => ({
      target: edge.target,
      targetBoundary: edge.targetBoundary || "unknown",
      symbols: [...edge.symbols],
      executionPhases: [...edge.executionPhases],
      policy: this.#dependencyPolicy(entry, edge),
    }));
    const reverseConsumers = graph.consumersOf(entry.currentPath);
    const scc = topology.componentOf(entry.currentPath);
    const graphFingerprint = CanonicalJson.fingerprint({
      sourceGraphFingerprint: graph.fingerprint,
      currentPath: entry.currentPath,
      internalDependencies,
      externalDependencies,
      reverseConsumers,
      scc,
      dependencyDepth: topology.depthOf(entry.currentPath),
    });
    const facts = {
      graphFingerprint,
      internalDependencies,
      externalDependencies,
      reverseConsumers,
      scc: {
        id: scc.id,
        members: [...scc.members],
        internalEdges: scc.internalEdges.map((edge) => ({ ...edge })),
        cyclic: scc.cyclic,
      },
      dependencyDepth: topology.depthOf(entry.currentPath),
      capabilities: capabilityObservation.capabilities,
      availabilityConstraints,
      topLevelEffects: sourceObservation.topLevelEffects,
      evidence: [
        {
          sourcePath: entry.currentPath,
          observation: "Browser capabilities and top-level effects were observed from scope-aware AST and policy facts.",
        },
        {
          sourcePath: entry.currentPath,
          observation: "Confirmed dependencies, availability, SCC and depth were derived from the unified graph and Manifest provenance.",
        },
      ],
      issues: [...new Set(issues)].sort(this.#compareText),
    };
    return {
      status: facts.issues.length > 0 ? "partial" : "verified",
      facts,
    };
  }

  #dependencyPolicy(entry, edge) {
    const boundary = this.boundaryById.get(entry.architecture.targetBoundary);
    if (!edge.targetBoundary || !this.boundaryById.has(edge.targetBoundary)) {
      return "unknown";
    }
    return boundary?.allowedDependencies.includes(edge.targetBoundary)
      ? "allowed"
      : "forbidden";
  }

  #observeIncompleteEdges(dependencies, issues) {
    for (const edge of [...dependencies.internal, ...dependencies.external]) {
      if (edge.symbols.length === 0) {
        issues.push(
          `missing-edge-symbols: ${edge.source} → ${edge.target} has no symbol provenance.`,
        );
      }
      if (edge.executionPhases.length === 0) {
        issues.push(
          `missing-edge-phase: ${edge.source} → ${edge.target} has no execution phase provenance.`,
        );
      }
    }
  }

  #compareText(left, right) {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }
}

module.exports = { DomainDependencyAuditAssembler };
