"use strict";

const assert = require("node:assert/strict");
const { StageThreePrerequisiteLedger } = require("./prerequisite_ledger");

const CONTRACT = "architecture/migration/stage_3_compatibility_runtime.json";

// Runtime additions approved by recorded prerequisite transitions rather than by a migration batch (the
// Vector2 Engine activation of prerequisite 027): the activations of the runtime contract owned by the
// backlog task of a recorded transition that wrote the contract, and the approved infrastructure modules
// they expose or historically exposed. A retired prerequisite activation remains the provenance for an
// imported Engine module even though it no longer belongs to the active activation set. Checks that derive
// the expected runtime from the approved batch plan add exactly the active prerequisite activations;
// anything else in the contract still has to come from a batch.
class PrerequisiteRuntimeApprovals {
  static of(root, contract) {
    const owners = new Set(new StageThreePrerequisiteLedger(root).records()
      .filter(record => record.writes.some(write => write.path === CONTRACT))
      .map(record => record.backlogTask.id));
    const activations = contract.activationPositions.filter(activation => owners.has(activation.owner));
    const retiredActivations = (contract.retiredActivations || []).map(record => record.activation)
      .filter(activation => owners.has(activation.owner));
    const infrastructureModules = [...new Set([...activations, ...retiredActivations]
      .map(activation => activation.targetModule))].sort();
    assert.deepEqual([...contract.approvedInfrastructureModules].sort(), infrastructureModules,
      "approved infrastructure modules are exactly the targets of prerequisite-approved activations");
    return Object.freeze({
      activations: Object.freeze(activations),
      activationIds: Object.freeze(activations.map(activation => activation.id).sort()),
      infrastructureModules: Object.freeze(infrastructureModules),
    });
  }
}

module.exports = { PrerequisiteRuntimeApprovals };
