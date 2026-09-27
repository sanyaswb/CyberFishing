"use strict";

const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const { STAGE_3_22 } = require("./post_freeze_review_profile");

const ID_PATTERN = STAGE_3_22.idPattern;

// Validates the Stage 3.22 candidate plan against the logical graph: identifiers, batch size,
// atomic SCCs, dependency order, candidate-only membership, unique ownership and complete,
// non-overlapping coverage of every remaining Domain module.
class PostFreezePlanValidator {
  constructor({ profile = STAGE_3_22 } = {}) {
    this.profile = profile;
  }

  validate({ plan, eligibility, logicalGraph, runtimeContract, firstOrder, maximumModulesPerBatch }) {
    const errors = [];
    const require = (condition, message) => { if (!condition) errors.push(message); };
    const categories = new Map(eligibility.records.map(record => [record.currentPath, record.category]));
    const nodes = new Map(logicalGraph.nodes.map(node => [node.currentPath, node]));
    const batchOf = new Map();
    plan.batches.forEach((batch, index) => {
      const match = this.profile.idPattern.exec(batch.id);
      require(Boolean(match), `candidate id is invalid: ${batch.id}`);
      require(batch.order === firstOrder + index, `candidate order is not contiguous: ${batch.id}`);
      require(match && Number(match[1]) === batch.order, `candidate id number differs from order: ${batch.id}`);
      require(batch.modules.length > 0 && batch.modules.length <= maximumModulesPerBatch,
        `candidate batch size is invalid: ${batch.id}`);
      for (const module of batch.modules) {
        require(!batchOf.has(module.currentPath), `module assigned twice: ${module.currentPath}`);
        batchOf.set(module.currentPath, batch);
        require(categories.get(module.currentPath) === "candidate",
          `blocked or deferred module assigned to a candidate batch: ${module.currentPath}`);
      }
      require(batch.cumulativeRuntimeTopology.topologyRevalidation.requiredBeforeApprovedFreeze === false,
        `candidate batch carries a graph-changing prerequisite: ${batch.id}`);
    });
    for (const [currentPath, batch] of batchOf) {
      const node = nodes.get(currentPath);
      require(Boolean(node), `assigned module is outside the logical graph: ${currentPath}`);
      if (!node) continue;
      const scc = logicalGraph.nodes.filter(item => item.planningSccId === node.planningSccId);
      for (const member of scc) {
        require(batchOf.get(member.currentPath) === batch, `SCC is split across batches: ${node.planningSccId}`);
      }
      for (const dependency of node.dependencies.filter(item => item.kind === "classic-global")) {
        const dependencyBatch = batchOf.get(dependency.target);
        if (!dependencyBatch) {
          errors.push(`candidate depends on a blocked or deferred module: ${currentPath} → ${dependency.target}`);
          continue;
        }
        const sameScc = nodes.get(dependency.target).planningSccId === node.planningSccId;
        require(dependencyBatch.order < batch.order || (dependencyBatch === batch && sameScc),
          `dependency order is invalid: ${currentPath} → ${dependency.target}`);
      }
    }
    this.#ownership(plan, runtimeContract, require);
    this.#coverage(plan, eligibility, require);
    if (errors.length > 0) {
      throw new Error(`Stage ${this.profile.stage} candidate plan failed:\n- ${[...new Set(errors)].join("\n- ")}`);
    }
    return true;
  }

  #ownership(plan, runtimeContract, require) {
    const symbols = new Map(runtimeContract.activationPositions.map(item => [item.legacySymbol, item.targetModule]));
    const targets = new Set(runtimeContract.activationPositions.map(item => item.targetModule));
    const planTargets = new Set();
    for (const batch of plan.batches) {
      for (const module of batch.modules) {
        require(!targets.has(module.targetPath) && !planTargets.has(module.targetPath),
          `duplicate target owner: ${module.targetPath}`);
        planTargets.add(module.targetPath);
      }
      for (const activation of batch.compatibility.newActivations) {
        const owner = symbols.get(activation.contract.legacySymbol);
        require(!owner || owner === activation.contract.targetModule,
          `duplicate legacy symbol owner: ${activation.contract.legacySymbol}`);
        symbols.set(activation.contract.legacySymbol, activation.contract.targetModule);
      }
    }
  }

  #coverage(plan, eligibility, require) {
    const assigned = plan.batches.flatMap(batch => batch.modules.map(module => module.currentPath)).sort(compare);
    const blocked = plan.prerequisiteBlocked.map(item => item.currentPath).sort(compare);
    const deferred = plan.deferred.map(item => item.currentPath).sort(compare);
    const all = [...assigned, ...blocked, ...deferred];
    const expected = eligibility.records.map(record => record.currentPath).sort(compare);
    require(new Set(all).size === all.length, "coverage overlaps");
    require(JSON.stringify([...all].sort(compare)) === JSON.stringify(expected), "coverage is incomplete");
    require(JSON.stringify(plan.coverage.assigned) === JSON.stringify(assigned), "assigned coverage differs");
    require(JSON.stringify(plan.coverage.prerequisiteBlocked) === JSON.stringify(blocked), "blocked coverage differs");
    require(JSON.stringify(plan.coverage.deferred) === JSON.stringify(deferred), "deferred coverage differs");
    require(Array.isArray(plan.coverage.unassigned) && plan.coverage.unassigned.length === 0,
      "coverage has unassigned modules");
  }
}

module.exports = { PostFreezePlanValidator, ID_PATTERN };
