"use strict";

const espree = require("espree");
const { CanonicalJson } = require("../guards/core/canonical_json");
const { DomainDependencyTopologyAnalyzer } = require("../domain_audit/domain_dependency_topology_analyzer");

const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const edgeKey = edge => `${edge.source}\u0000${edge.target}`;

// Keeps the physical dependency graph untouched and derives a separate logical Domain graph in
// which every activation shim a remaining classic module consumes is resolved to the ESM owner of
// the completed prefix. Every resolved edge keeps its consumer, symbol, export, execution phases
// and activation position, so the SCC, order and closure results remain traceable to evidence.
class PostFreezeLogicalGraphBuilder {
  constructor({ topologyAnalyzer = new DomainDependencyTopologyAnalyzer() } = {}) {
    this.topologyAnalyzer = topologyAnalyzer;
  }

  build({ document, completedTargets, runtimeContract, bridgeRegistry, unifiedGraph, readSource }) {
    const entries = new Map(document.entries.map(entry => [entry.currentPath, entry]));
    const completed = [...completedTargets].sort(compare);
    const remaining = [...entries.keys()].filter(item => !completedTargets.has(item)).sort(compare);
    for (const target of completed) {
      if (!entries.has(target)) throw new Error(`Completed target is outside the Domain audit: ${target}`);
    }
    const activations = this.#activationIndex(runtimeContract, readSource);
    const resolutions = [];
    const edges = [];
    for (const currentPath of remaining) {
      const entry = entries.get(currentPath);
      for (const dependency of entry.dependencyAudit.facts.internalDependencies) {
        if (completedTargets.has(dependency.target)) {
          throw new Error(`Classic module depends on an ESM target directly: ${currentPath} → ${dependency.target}`);
        }
        edges.push({ source: currentPath, target: dependency.target, kind: "classic-global",
          symbols: [...dependency.symbols].sort(compare),
          executionPhases: [...dependency.executionPhases].sort(compare) });
      }
      for (const dependency of entry.dependencyAudit.facts.externalDependencies) {
        const shim = activations.byShim.get(dependency.target);
        if (!shim) continue;
        const targets = new Set();
        for (const symbol of [...dependency.symbols].sort(compare)) {
          const activation = shim.get(symbol);
          if (!activation) {
            throw new Error(`Incorrect activation alias: ${currentPath} reads ${symbol} from ${dependency.target}`);
          }
          this.#requireEagerOrder(entry, activation, dependency);
          if (completedTargets.has(activation.targetModule)) targets.add(activation.targetModule);
          resolutions.push({
            scope: completedTargets.has(activation.targetModule) ? "completed-domain" : "foundation",
            consumer: currentPath,
            consumerLegacyLoadOrder: entry.manifestEvidence.legacyLoadOrder,
            shim: dependency.target,
            symbol,
            exportName: activation.exportName,
            targetModule: activation.targetModule,
            executionPhases: [...dependency.executionPhases].sort(compare),
            activationId: activation.id,
            activationOwner: activation.owner,
            activationPosition: activation.position,
            legacyScriptIndex: activation.legacyScriptIndex,
          });
        }
        for (const target of [...targets].sort(compare)) {
          const records = resolutions.filter(item => item.consumer === currentPath &&
            item.shim === dependency.target && item.targetModule === target);
          edges.push({ source: currentPath, target, kind: "activation-resolved",
            symbols: records.map(item => item.symbol).sort(compare),
            executionPhases: [...new Set(records.flatMap(item => item.executionPhases))].sort(compare),
            viaShim: dependency.target });
        }
      }
    }
    for (const currentPath of completed) {
      for (const dependency of entries.get(currentPath).dependencyAudit.facts.internalDependencies) {
        if (!completedTargets.has(dependency.target)) {
          throw new Error(`Completed prefix depends on an unmigrated module: ${currentPath} → ${dependency.target}`);
        }
        edges.push({ source: currentPath, target: dependency.target, kind: "esm-import",
          symbols: [...dependency.symbols].sort(compare),
          executionPhases: [...dependency.executionPhases].sort(compare) });
      }
    }
    edges.sort((left, right) => compare(`${edgeKey(left)}\u0000${left.kind}`, `${edgeKey(right)}\u0000${right.kind}`));
    this.#requireUniqueEdges(edges);
    const nodes = [...completed, ...remaining].sort(compare);
    const logicalTopology = this.#topology(nodes, edges);
    const planningEdges = edges.filter(edge => edge.kind === "classic-global");
    const planningTopology = this.#topology(remaining, planningEdges);
    this.#requireAuditConsistency(entries, remaining, planningTopology);
    this.#requireBridgeConsumers(bridgeRegistry, unifiedGraph, completedTargets, activations);
    const nodeRecords = this.#nodeRecords({ nodes, edges, entries, completedTargets,
      logicalTopology, planningTopology, bridgeRegistry });
    const dependencyOrder = nodeRecords.filter(node => node.status === "remaining")
      .sort((left, right) => left.planningDepth - right.planningDepth ||
        compare(left.currentPath, right.currentPath))
      .map(node => node.currentPath);
    return {
      physical: this.#physicalSummary(unifiedGraph),
      activationResolution: resolutions.sort((left, right) =>
        compare(`${left.consumer}\u0000${left.shim}\u0000${left.symbol}`,
          `${right.consumer}\u0000${right.shim}\u0000${right.symbol}`)),
      logical: {
        nodeCount: nodes.length,
        completedCount: completed.length,
        remainingCount: remaining.length,
        edgeCount: edges.length,
        edgesByKind: this.#count(edges.map(edge => edge.kind)),
        fingerprint: CanonicalJson.fingerprint({ nodes, edges }),
        edges,
      },
      sccs: {
        logical: this.#sccSummary(logicalTopology),
        planning: this.#sccSummary(planningTopology),
      },
      dependencyOrder,
      nodes: nodeRecords,
    };
  }

  #activationIndex(runtimeContract, readSource) {
    const byShim = new Map();
    const owners = new Map();
    const exportsByTarget = new Map();
    runtimeContract.activationPositions.forEach((activation, position) => {
      const owner = owners.get(activation.legacySymbol);
      if (owner && owner !== activation.targetModule) {
        throw new Error(`Duplicate legacy symbol owner: ${activation.legacySymbol}`);
      }
      owners.set(activation.legacySymbol, activation.targetModule);
      if (!exportsByTarget.has(activation.targetModule)) {
        exportsByTarget.set(activation.targetModule, this.#namedExports(readSource(activation.targetModule)));
      }
      if (!exportsByTarget.get(activation.targetModule).has(activation.exportName)) {
        throw new Error(`Incorrect activation export: ${activation.targetModule} lacks ${activation.exportName}`);
      }
      if (!byShim.has(activation.sourceProvider)) byShim.set(activation.sourceProvider, new Map());
      const shim = byShim.get(activation.sourceProvider);
      if (shim.has(activation.legacySymbol)) {
        throw new Error(`Duplicate activation for ${activation.sourceProvider}:${activation.legacySymbol}`);
      }
      shim.set(activation.legacySymbol, { ...activation, position });
    });
    return { byShim, owners };
  }

  #namedExports(source) {
    const tree = espree.parse(source, { ecmaVersion: "latest", sourceType: "module" });
    const names = new Set();
    for (const node of tree.body) {
      if (node.type !== "ExportNamedDeclaration") continue;
      if (node.declaration?.id) names.add(node.declaration.id.name);
      for (const declaration of node.declaration?.declarations || []) names.add(declaration.id.name);
      for (const specifier of node.specifiers || []) names.add(specifier.exported.name);
    }
    return names;
  }

  #requireEagerOrder(entry, activation, dependency) {
    if (!dependency.executionPhases.includes("eager")) return;
    if (!(entry.manifestEvidence.legacyLoadOrder > activation.legacyScriptIndex)) {
      throw new Error(`Eager consumer precedes its activation: ${entry.currentPath} → ${activation.legacySymbol}`);
    }
  }

  #requireUniqueEdges(edges) {
    const keys = edges.map(edgeKey);
    if (new Set(keys).size !== keys.length) {
      throw new Error("Logical Domain graph contains duplicate edges");
    }
  }

  #topology(nodes, edges) {
    const unique = edges.map(edge => ({ source: edge.source, target: edge.target }));
    const graph = {
      fingerprint: CanonicalJson.fingerprint({ nodes, edges: unique }),
      nodes: () => [...nodes],
      internalDependencies: () => unique.map(edge => ({ ...edge })),
    };
    return this.topologyAnalyzer.analyze(graph).snapshot();
  }

  #requireAuditConsistency(entries, remaining, planning) {
    const depthByPath = new Map(planning.moduleDepths.map(item => [item.currentPath, item]));
    const membersById = new Map(planning.components.map(component => [component.id, component.members]));
    for (const currentPath of remaining) {
      const facts = entries.get(currentPath).dependencyAudit.facts;
      const record = depthByPath.get(currentPath);
      if (record.depth !== facts.dependencyDepth) {
        throw new Error(`Planning depth differs from audit evidence: ${currentPath}`);
      }
      if (JSON.stringify(membersById.get(record.sccId)) !== JSON.stringify([...facts.scc.members].sort(compare))) {
        throw new Error(`Planning SCC differs from audit evidence: ${currentPath}`);
      }
    }
  }

  // Every bridge that keeps a classic consumer on a completed module must still be backed by an
  // observed consumer read of the activation shim; otherwise the recorded consumer is missing.
  #requireBridgeConsumers(bridgeRegistry, unifiedGraph, completedTargets, activations) {
    const reads = new Set(unifiedGraph.edges
      .filter(edge => edge.mechanisms.includes("legacy-confirmed"))
      .map(edge => edgeKey(edge)));
    for (const bridge of bridgeRegistry.bridges) {
      if (bridge.introducedStage !== "stage-3" || !completedTargets.has(bridge.target)) continue;
      if (!activations.byShim.has(bridge.bridge)) {
        throw new Error(`Bridge does not name an activation shim: ${bridge.id}`);
      }
      if (!reads.has(edgeKey({ source: bridge.source, target: bridge.bridge }))) {
        throw new Error(`Bridge consumer is missing from the physical graph: ${bridge.id}`);
      }
    }
  }

  #nodeRecords({ nodes, edges, entries, completedTargets, logicalTopology, planningTopology, bridgeRegistry }) {
    const outgoing = new Map(nodes.map(node => [node, []]));
    const incoming = new Map(nodes.map(node => [node, []]));
    for (const edge of edges) {
      outgoing.get(edge.source).push(edge);
      incoming.get(edge.target).push(edge);
    }
    const logicalByPath = new Map(logicalTopology.moduleDepths.map(item => [item.currentPath, item]));
    const planningByPath = new Map(planningTopology.moduleDepths.map(item => [item.currentPath, item]));
    const bridgesByTarget = new Map();
    for (const bridge of bridgeRegistry.bridges) {
      if (!bridgesByTarget.has(bridge.target)) bridgesByTarget.set(bridge.target, []);
      bridgesByTarget.get(bridge.target).push(bridge.source);
    }
    return nodes.map(currentPath => {
      const entry = entries.get(currentPath);
      const closure = this.#closure(currentPath, outgoing);
      const isCompleted = completedTargets.has(currentPath);
      return {
        currentPath,
        targetPath: entry.targetPath,
        status: isCompleted ? "completed" : "remaining",
        logicalSccId: logicalByPath.get(currentPath).sccId,
        logicalDepth: logicalByPath.get(currentPath).depth,
        planningSccId: isCompleted ? null : planningByPath.get(currentPath).sccId,
        planningDepth: isCompleted ? null : planningByPath.get(currentPath).depth,
        dependencies: outgoing.get(currentPath).map(edge => ({ target: edge.target, kind: edge.kind }))
          .sort((left, right) => compare(left.target, right.target)),
        reverseDomainConsumers: incoming.get(currentPath).map(edge => edge.source).sort(compare),
        reverseExternalConsumers: isCompleted
          ? [...new Set(bridgesByTarget.get(currentPath) || [])].sort(compare)
          : [...new Set(entry.dependencyAudit.facts.reverseConsumers.map(item => item.source))].sort(compare),
        closure: {
          remaining: closure.filter(item => !completedTargets.has(item)),
          completed: closure.filter(item => completedTargets.has(item)),
        },
      };
    });
  }

  #closure(start, outgoing) {
    const seen = new Set();
    const stack = outgoing.get(start).map(edge => edge.target);
    while (stack.length > 0) {
      const next = stack.pop();
      if (next === start || seen.has(next)) continue;
      seen.add(next);
      for (const edge of outgoing.get(next)) stack.push(edge.target);
    }
    return [...seen].sort(compare);
  }

  #sccSummary(topology) {
    return {
      count: topology.components.length,
      cyclic: topology.components.filter(component => component.cyclic)
        .map(component => ({ id: component.id, members: component.members })),
      maximumDepth: topology.maximumDepth,
      fingerprint: topology.fingerprint,
    };
  }

  #physicalSummary(unifiedGraph) {
    const edges = unifiedGraph.edges.map(edge => ({ source: edge.source, target: edge.target,
      mechanisms: [...edge.mechanisms].sort(compare) }))
      .sort((left, right) => compare(edgeKey(left), edgeKey(right)));
    return {
      preserved: true,
      nodeCount: unifiedGraph.nodes.length,
      edgeCount: edges.length,
      mechanisms: this.#count(edges.flatMap(edge => edge.mechanisms)),
      fingerprint: CanonicalJson.fingerprint(edges),
    };
  }

  #count(values) {
    const counts = {};
    for (const value of [...values].sort(compare)) counts[value] = (counts[value] || 0) + 1;
    return counts;
  }
}

module.exports = { PostFreezeLogicalGraphBuilder };
