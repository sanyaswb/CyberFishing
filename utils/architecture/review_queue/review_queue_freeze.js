"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { sha256, serialize } = require("../post_freeze/post_freeze_workspace");
const { BASE, INPUTS, ARTIFACTS, EVIDENCE_TASKS } = require("./review_queue_paths");
const { StageThreeCollectionIdentityEvidence } = require("./collection_identity_evidence");
const { StageThreeHotLoopEvidence, EQUIVALENCE_RULES } = require("./hot_loop_evidence");
const { StageThreeFreezeExtensionBuilder, StageThreeFreezeExtensionValidator } = require("./freeze_extension");

// Composes the Stage 3.34.0 review-queue freeze: both evidence documents and the freeze extension
// that references them, the Stage 3.22 review artifacts and the execution state by the SHA-256 of
// their exact bytes. A replay must reproduce every artifact byte-for-byte.
class StageThreeReviewQueueFreeze {
  constructor({ root }) {
    this.root = path.resolve(root);
  }

  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }

  reference(file) { return { path: file, sha256: sha256(this.bytes(file)) }; }

  json(file) { return JSON.parse(this.bytes(file).toString("utf8")); }

  build() {
    const artifacts = new Map();
    const emit = (file, document) => {
      const bytes = serialize(document);
      artifacts.set(file, bytes);
      return { path: file, sha256: sha256(bytes) };
    };
    const backlogRef = this.reference(BASE.prerequisiteBacklog);
    const backlog = this.json(BASE.prerequisiteBacklog);
    const task = id => {
      const record = backlog.tasks.find(item => item.id === id);
      if (!record || record.kind !== "freeze-evidence" || record.graphChanging !== false) {
        throw new Error(`review-queue evidence task is not a non-graph freeze-evidence task: ${id}`);
      }
      return record;
    };
    const collectionTask = task(EVIDENCE_TASKS.collectionIdentity);
    const hotLoopTask = task(EVIDENCE_TASKS.hotLoop);
    const collection = new StageThreeCollectionIdentityEvidence({ root: this.root }).build();
    const collectionRef = emit(ARTIFACTS.collectionIdentityEvidence, {
      schemaVersion: 1,
      kind: "cyber-fishing-stage-3-review-queue-collection-identity-evidence",
      stage: "3.34.0",
      evidenceTaskId: collectionTask.id,
      prerequisiteBacklog: backlogRef,
      checks: collectionTask.checks,
      records: [collection],
    });
    const hotLoop = new StageThreeHotLoopEvidence({ root: this.root }).build();
    const hotLoopRef = emit(ARTIFACTS.hotLoopEvidence, {
      schemaVersion: 1,
      kind: "cyber-fishing-stage-3-review-queue-hot-loop-evidence",
      stage: "3.34.0",
      evidenceTaskId: hotLoopTask.id,
      prerequisiteBacklog: backlogRef,
      checks: hotLoopTask.checks,
      gameCycle: { script: "utils/game-cycle-check.js", probe: "utils/architecture/review_queue/game_cycle_trace_probe.js",
        traced: "every public prototype method: call count, deltaTime range and SHA-256 of ordered arguments and results" },
      equivalenceRules: EQUIVALENCE_RULES,
      records: hotLoop,
    });
    const evidence = [
      { taskId: collectionTask.id, artifact: collectionRef, record: collection },
      ...hotLoop.map(record => ({ taskId: hotLoopTask.id, artifact: hotLoopRef, record })),
    ];
    const base = this.json(BASE.approvedPrefix);
    const extension = new StageThreeFreezeExtensionBuilder().build({
      base, baseRef: this.reference(BASE.approvedPrefix),
      candidates: this.json(BASE.candidateBatches), candidatesRef: this.reference(BASE.candidateBatches),
      reviewEvidence: this.json(BASE.reviewEvidence), reviewEvidenceRef: this.reference(BASE.reviewEvidence),
      backlog, backlogRef,
      executionState: this.json(INPUTS.executionState), executionStateRef: this.reference(INPUTS.executionState),
      evidence, readSource: file => this.bytes(file).toString("utf8"),
    });
    new StageThreeFreezeExtensionValidator().validate({ extension, base });
    emit(ARTIFACTS.freezeExtension, extension);
    return { artifacts, extension };
  }
}

module.exports = { StageThreeReviewQueueFreeze };
