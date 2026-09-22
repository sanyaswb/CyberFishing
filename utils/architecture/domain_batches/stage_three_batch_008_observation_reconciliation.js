"use strict";
const { StageThreeObservationReconciliation, StageThreeObservationContract } = require("./stage_three_observation_reconciliation");
const { Batch008ObservationManifestTransition } = require("./stage_three_batch_008_observation_transition");
const { BATCH_008_PREBUILD_PROFILE: profile } = require("./stage_three_batch_prebuild_profile");

class StageThreeBatch008ObservationReconciliation extends StageThreeObservationReconciliation {
  constructor() { super({ profile, transitionFactory: inputs => new Batch008ObservationManifestTransition(inputs) }); }
}
class StageThreeBatch008ObservationContract extends StageThreeObservationContract {
  constructor() { super({ profile, kind: "cyber-fishing-stage-3-batch-008-observation-reconciliation",
    nextGate: "stage-3.8.8-full-acceptance-and-browser-smoke" }); }
}
module.exports = { StageThreeBatch008ObservationReconciliation, StageThreeBatch008ObservationContract };
