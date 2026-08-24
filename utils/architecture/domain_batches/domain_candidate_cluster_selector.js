"use strict";

const crypto = require("node:crypto");
const { immutableRecord } = require("../guards/core/guard_models");

class DomainEligibilityDecisionResolver {
  resolve({ modules, policy }) {
    const moduleByPath = new Map(modules.map((module) => [module.currentPath, module]));
    const decisions = new Map(
      modules.map((module) => [module.currentPath, policy.classify(module)]),
    );
    let changed = true;
    while (changed) {
      changed = false;
      for (const module of modules) {
        const decision = decisions.get(module.currentPath);
        if (decision.status === "deferred") continue;
        const deferredDependencies = module.dependencyAudit.facts.internalDependencies
          .map((dependency) => dependency.target)
          .filter((target) => decisions.get(target)?.status === "deferred")
          .sort();
        const deferredSccMembers = module.dependencyAudit.facts.scc.members
          .filter((member) => decisions.get(member)?.status === "deferred")
          .sort();
        const blockedBy = [...new Set([...deferredDependencies, ...deferredSccMembers])];
        if (blockedBy.length === 0) continue;
        decisions.set(module.currentPath, immutableRecord({
          ...decision,
          status: "deferred",
          reasonCodes: [...new Set([
            ...decision.reasonCodes,
            deferredSccMembers.length > 0
              ? "deferred-scc-member"
              : "deferred-domain-dependency",
          ])].sort(),
          prerequisites: [
            ...decision.prerequisites,
            ...blockedBy.map((target) => ({
              id: `domain-dependency:${target}`,
              kind: "domain-dependency",
              action: "complete-deferred-domain-prerequisite",
              module: target,
            })),
          ].sort((left, right) => left.id.localeCompare(right.id)),
        }));
        changed = true;
      }
    }
    for (const [currentPath] of decisions) {
      if (!moduleByPath.has(currentPath)) {
        throw new Error(`Eligibility produced an unknown module: ${currentPath}`);
      }
    }
    return decisions;
  }
}

class DomainCandidateClusterSelector {
  constructor(policy) {
    this.policy = policy;
  }

  select({ modules, decisions }) {
    const moduleByPath = new Map(modules.map((module) => [module.currentPath, module]));
    const componentByModule = this.#weakComponents(modules);
    const units = this.#sccUnits(
      modules,
      decisions,
      moduleByPath,
      componentByModule,
    );
    const candidateUnits = units.filter((unit) => unit.status !== "deferred");
    const deferredUnits = units.filter((unit) => unit.status === "deferred");
    const cohorts = new Map();
    for (const unit of candidateUnits) {
      const key = [
        unit.depth,
        unit.graphComponentId,
        unit.targetArea,
        unit.riskTier,
        unit.status,
      ].join("\u0000");
      if (!cohorts.has(key)) cohorts.set(key, []);
      cohorts.get(key).push(unit);
    }
    const rawGroups = [];
    for (const [, cohort] of [...cohorts.entries()].sort(([left], [right]) =>
      left.localeCompare(right))) {
      cohort.sort((left, right) => left.id.localeCompare(right.id));
      let group = [];
      let count = 0;
      for (const unit of cohort) {
        if (
          group.length > 0 &&
          count + unit.members.length > this.policy.clustering.maximumModulesPerBatch
        ) {
          rawGroups.push(group);
          group = [];
          count = 0;
        }
        group.push(unit);
        count += unit.members.length;
      }
      if (group.length > 0) rawGroups.push(group);
    }
    rawGroups.sort((left, right) => this.#groupKey(left).localeCompare(this.#groupKey(right)));
    const batches = rawGroups.map((unitsInBatch, index) => {
      const members = unitsInBatch.flatMap((unit) => unit.members).sort();
      const sample = unitsInBatch[0];
      const digest = crypto
        .createHash("sha256")
        .update(JSON.stringify(members))
        .digest("hex")
        .slice(0, 8);
      return immutableRecord({
        id: `stage-3.candidate-${String(index + 1).padStart(3, "0")}-${sample.targetArea}-${digest}`,
        order: index + 1,
        depth: sample.depth,
        targetArea: sample.targetArea,
        riskTier: sample.riskTier,
        eligibilityStatus: sample.status,
        sccIds: unitsInBatch.map((unit) => unit.id).sort(),
        graphComponentId: sample.graphComponentId,
        modulePaths: members,
      });
    });
    this.#validateDependencyOrder(batches, moduleByPath);
    return immutableRecord({
      batches,
      deferredModules: deferredUnits.flatMap((unit) => unit.members).sort(),
    });
  }

  #sccUnits(modules, decisions, moduleByPath, componentByModule) {
    const byId = new Map();
    for (const module of modules) {
      const scc = module.dependencyAudit.facts.scc;
      if (!byId.has(scc.id)) {
        byId.set(scc.id, {
          id: scc.id,
          members: [...scc.members].sort(),
          cyclic: scc.cyclic,
        });
      }
    }
    return [...byId.values()].map((unit) => {
      const memberRecords = unit.members.map((member) => moduleByPath.get(member));
      if (memberRecords.some((record) => !record)) {
        throw new Error(`SCC contains module outside candidate scope: ${unit.id}`);
      }
      const memberDecisions = unit.members.map((member) => decisions.get(member));
      const deferred = memberDecisions.some((decision) => decision.status === "deferred");
      const conditional = memberDecisions.some((decision) =>
        decision.status === "conditionally-eligible");
      const areas = [...new Set(memberRecords.map((record) => record.targetArea))];
      const graphComponents = [...new Set(unit.members.map((member) =>
        componentByModule.get(member)))];
      if (graphComponents.length !== 1) {
        throw new Error(`SCC crosses weak dependency components: ${unit.id}`);
      }
      if (areas.length !== 1 && !deferred) {
        throw new Error(`Candidate SCC crosses reviewed target areas: ${unit.id}`);
      }
      if (
        unit.members.length > this.policy.clustering.maximumModulesPerBatch &&
        !deferred
      ) {
        throw new Error(`Atomic SCC exceeds maximum candidate batch size: ${unit.id}`);
      }
      return {
        ...unit,
        depth: Math.max(...memberRecords.map((record) =>
          record.dependencyAudit.facts.dependencyDepth)),
        targetArea: areas.length === 1 ? areas[0] : "cross-area-deferred",
        graphComponentId: graphComponents[0],
        riskTier: this.#riskTier(memberRecords),
        status: deferred
          ? "deferred"
          : conditional
            ? "conditionally-eligible"
            : "eligible",
      };
    }).sort((left, right) => left.id.localeCompare(right.id));
  }

  #riskTier(records) {
    if (records.some((record) => record.performanceRisk.facts.hotLoopParticipation === "direct")) {
      return "hot-loop";
    }
    if (records.some((record) => record.configurationInput.facts.forbiddenDirectReads.length > 0)) {
      return "config-di";
    }
    if (records.some((record) => record.stateOwnership.status === "partial")) {
      return "state-identity";
    }
    if (records.some((record) => record.dependencyAudit.facts.topLevelEffects.length > 0)) {
      return "evaluation-effects";
    }
    return "standard";
  }

  #groupKey(units) {
    const unit = units[0];
    const eligibilityOrder = {
      eligible: "0",
      "conditionally-eligible": "1",
    }[unit.status] || "9";
    const riskOrder = {
      standard: "0",
      "evaluation-effects": "1",
      "state-identity": "2",
      "config-di": "3",
      "hot-loop": "4",
    }[unit.riskTier] || "9";
    return [
      String(unit.depth).padStart(3, "0"),
      eligibilityOrder,
      riskOrder,
      unit.graphComponentId,
      unit.targetArea,
      units.map((item) => item.id).join("\u0000"),
    ].join("\u0000");
  }

  #validateDependencyOrder(batches, moduleByPath) {
    const batchOrderByModule = new Map();
    for (const batch of batches) {
      for (const modulePath of batch.modulePaths) {
        if (batchOrderByModule.has(modulePath)) {
          throw new Error(`Candidate module assigned twice: ${modulePath}`);
        }
        batchOrderByModule.set(modulePath, batch.order);
      }
    }
    for (const [modulePath, order] of batchOrderByModule) {
      const module = moduleByPath.get(modulePath);
      for (const dependency of module.dependencyAudit.facts.internalDependencies) {
        const dependencyOrder = batchOrderByModule.get(dependency.target);
        if (dependencyOrder === undefined) {
          throw new Error(
            `Candidate module depends on an unassigned/deferred module: ` +
              `${modulePath} → ${dependency.target}`,
          );
        }
        const sameScc = module.dependencyAudit.facts.scc.members.includes(dependency.target);
        if (dependencyOrder > order || (dependencyOrder === order && !sameScc)) {
          throw new Error(
            `Candidate dependency order is invalid: ${modulePath} → ${dependency.target}`,
          );
        }
      }
    }
  }

  #weakComponents(modules) {
    const scope = new Set(modules.map((module) => module.currentPath));
    const adjacency = new Map([...scope].map((modulePath) => [modulePath, new Set()]));
    const connect = (left, right) => {
      if (!adjacency.has(left)) adjacency.set(left, new Set());
      if (!adjacency.has(right)) adjacency.set(right, new Set());
      adjacency.get(left).add(right);
      adjacency.get(right).add(left);
    };
    for (const module of modules) {
      for (const dependency of module.dependencyAudit.facts.internalDependencies) {
        if (!scope.has(dependency.target)) continue;
        connect(module.currentPath, dependency.target);
      }
      for (const consumer of module.dependencyAudit.facts.reverseConsumers) {
        connect(module.currentPath, `legacy-consumer:${consumer.source}`);
      }
    }
    const result = new Map();
    const visited = new Set();
    for (const start of [...scope].sort()) {
      if (visited.has(start)) continue;
      const componentNodes = [];
      const queue = [start];
      visited.add(start);
      while (queue.length > 0) {
        const current = queue.shift();
        componentNodes.push(current);
        for (const neighbor of [...adjacency.get(current)].sort()) {
          if (visited.has(neighbor)) continue;
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
      const members = componentNodes.filter((node) => scope.has(node)).sort();
      const id = `component-${crypto
        .createHash("sha256")
        .update(JSON.stringify(members))
        .digest("hex")
        .slice(0, 12)}`;
      for (const member of members) result.set(member, id);
    }
    return result;
  }
}

module.exports = {
  DomainCandidateClusterSelector,
  DomainEligibilityDecisionResolver,
};
