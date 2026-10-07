"use strict";

const { CanonicalBridgeIdentity } = require("./canonical_bridge_identity");

class StageTwoExecutionStateValidator {
  validate({ state, approvedPlan, bridgeRegistry, runtimeFacts = null }) {
    const errors = [];
    const require = (condition, message) => {
      if (!condition) errors.push(message);
    };
    const batches = Array.isArray(approvedPlan?.batches)
      ? approvedPlan.batches
      : [];
    const orderedIds = batches.map((batch) => batch.id);
    const completed = Array.isArray(state?.completedBatchIds)
      ? state.completedBatchIds
      : [];

    require(state?.schemaVersion === 1, "execution state schemaVersion must be 1");
    require(
      state?.kind === "cyber-fishing-stage-2-execution-state",
      "execution state kind is invalid",
    );
    require(
      state?.sourceClosureVersion === approvedPlan?.approvedAtVersion,
      "execution state sourceClosureVersion must equal approvedAtVersion",
    );
    require(
      this.#isLaterVersion(
        state?.releaseVersion,
        state?.sourceClosureVersion,
      ),
      "execution state releaseVersion must be later than the closure version",
    );
    require(
      ["foundation-verified", "migration-active", "migration-complete"].includes(
        state?.status,
      ),
      "execution state status is invalid",
    );
    require(
      state?.closureTransition?.mode === "semantic-release-delta",
      "execution state requires semantic-release-delta closure transition",
    );
    require(
      completed.length <= orderedIds.length &&
        completed.every((id, index) => id === orderedIds[index]),
      "completedBatchIds must be an ordered approved prefix",
    );
    const expectedActive = orderedIds[completed.length] || null;
    require(
      state?.activeBatchId === null || state?.activeBatchId === expectedActive,
      "activeBatchId must be the first batch after the completed prefix",
    );
    require(
      typeof state?.esmRuntimeIntegrationStarted === "boolean",
      "esmRuntimeIntegrationStarted must be boolean",
    );

    const bridges = Array.isArray(bridgeRegistry?.bridges)
      ? bridgeRegistry.bridges
      : [];
    if (state?.esmRuntimeIntegrationStarted === false) {
      require(completed.length === 0, "ESM integration false requires no completed batches");
      require(state?.activeBatchId === null, "ESM integration false requires no active batch");
      require(bridges.length === 0, "ESM integration false requires an empty bridge registry");
      require(
        runtimeFacts === null || runtimeFacts.moduleScriptCount === 0,
        "ESM integration false requires zero runtime module scripts",
      );
      require(
        state?.status === "foundation-verified",
        "ESM integration false requires foundation-verified status",
      );
    } else {
      require(
        completed.length > 0 || state?.activeBatchId !== null,
        "ESM integration true requires an active or completed batch",
      );
      require(
        state?.status !== "foundation-verified",
        "ESM integration true requires migration-active or migration-complete status",
      );
    }
    if (state?.status === "migration-complete") {
      require(
        completed.length === orderedIds.length && state.activeBatchId === null,
        "migration-complete requires every approved batch completed",
      );
    }

    if (errors.length > 0) {
      throw new Error(`Stage 2 execution state failed:\n- ${errors.join("\n- ")}`);
    }
    return Object.freeze({
      nextBatchId: orderedIds[completed.length] || null,
      allowedBatchIds: Object.freeze([
        ...completed,
        ...(state.activeBatchId ? [state.activeBatchId] : []),
      ]),
    });
  }

  #isLaterVersion(current, baseline) {
    const parse = (value) =>
      /^\d+\.\d+\.\d+$/.test(value || "")
        ? value.split(".").map(Number)
        : null;
    const left = parse(current);
    const right = parse(baseline);
    if (!left || !right) return false;
    for (let index = 0; index < 3; index += 1) {
      if (left[index] !== right[index]) return left[index] > right[index];
    }
    return false;
  }
}

class ActiveBridgePlanResolver {
  constructor({ stateValidator = new StageTwoExecutionStateValidator() } = {}) {
    this.stateValidator = stateValidator;
  }

  resolve({ state, approvedPlan, bridgeRegistry, runtimeFacts = null }) {
    const execution = this.stateValidator.validate({
      state,
      approvedPlan,
      bridgeRegistry,
      runtimeFacts,
    });
    const contracts = this.#indexContracts(approvedPlan);
    const records = Array.isArray(bridgeRegistry?.bridges)
      ? bridgeRegistry.bridges
      : [];
    this.#validateRegistryOrder(records);
    const recordsByWrapper = new Map();
    const seenConsumers = new Set();

    for (const record of records) {
      this.#assertRecordShape(record);
      const contract = contracts.get(record.bridge);
      if (!contract) throw new Error(`Unapproved bridge wrapper: ${record.bridge}`);
      if (!execution.allowedBatchIds.includes(contract.batchId)) {
        throw new Error(`Bridge owner is not active/completed: ${record.owner}`);
      }
      const expectedId = CanonicalBridgeIdentity.id(record);
      if (record.id !== expectedId) {
        throw new Error(`Non-canonical bridge id: ${record.id}`);
      }
      if (record.owner !== contract.batchId) {
        throw new Error(`${record.id} owner differs from approved batch`);
      }
      if (record.target !== contract.targetModule) {
        throw new Error(`${record.id} target differs from approved target`);
      }
      if (record.introducedStage !== "stage-2") {
        throw new Error(`${record.id} introducedStage must be stage-2`);
      }
      if (record.removalStage !== contract.removalStage) {
        throw new Error(`${record.id} removalStage differs from approved contract`);
      }
      if (typeof record.reason !== "string" || record.reason.trim().length === 0) {
        throw new Error(`${record.id} requires reason`);
      }
      const consumerKey = `${record.bridge}\u0000${record.source}`;
      if (seenConsumers.has(consumerKey)) {
        throw new Error(`Duplicate bridge consumer: ${record.source}`);
      }
      seenConsumers.add(consumerKey);
      this.#assertProviders(record.globalProviders, contract.globalProviders, record.id);
      if (!recordsByWrapper.has(record.bridge)) recordsByWrapper.set(record.bridge, []);
      recordsByWrapper.get(record.bridge).push(record);
    }

    const activeContracts = [...contracts.values()].filter((contract) =>
      execution.allowedBatchIds.includes(contract.batchId),
    );
    for (const contract of activeContracts) {
      const wrapperRecords = recordsByWrapper.get(contract.wrapperPath) || [];
      const actual = wrapperRecords.map((record) => record.source).sort();
      const expected = [...contract.legacyConsumers].sort();
      if (!this.#sameArray(actual, expected)) {
        throw new Error(
          `Bridge consumer set mismatch for ${contract.wrapperPath}: ` +
            `expected ${expected.join(", ") || "<empty>"}; ` +
            `received ${actual.join(", ") || "<empty>"}`,
        );
      }
    }
    if (activeContracts.length === 0 && records.length > 0) {
      throw new Error("Bridge registry must be empty without an active/completed batch");
    }

    return Object.freeze({
      execution,
      plans: Object.freeze(
        activeContracts
          .map((contract) =>
            Object.freeze({
              ...contract,
              registryIds: Object.freeze(
                (recordsByWrapper.get(contract.wrapperPath) || [])
                  .map((record) => record.id)
                  .sort(),
              ),
            }),
          )
          .sort((left, right) => left.wrapperPath.localeCompare(right.wrapperPath)),
      ),
    });
  }

  #indexContracts(approvedPlan) {
    const contracts = new Map();
    for (const batch of approvedPlan.batches || []) {
      for (const bridge of batch.bridgeStrategy?.bridges || []) {
        if (contracts.has(bridge.wrapperPath)) {
          throw new Error(`Duplicate approved bridge wrapper: ${bridge.wrapperPath}`);
        }
        CanonicalBridgeIdentity.normalizePath(bridge.wrapperPath);
        CanonicalBridgeIdentity.normalizePath(bridge.targetModule);
        CanonicalBridgeIdentity.normalizePath(bridge.outputPath);
        contracts.set(bridge.wrapperPath, {
          batchId: batch.id,
          targetBoundary: batch.targetBoundary,
          wrapperPath: bridge.wrapperPath,
          targetModule: bridge.targetModule,
          outputPath: bridge.outputPath,
          legacyConsumers: Object.freeze([...bridge.legacyConsumers]),
          globalProviders: Object.freeze(
            bridge.globalProviders.map(({ symbol, mechanism }) => ({
              symbol,
              mechanism,
            })),
          ),
          removalStage: batch.bridgeStrategy.removalStage,
        });
      }
    }
    return contracts;
  }

  #validateRegistryOrder(records) {
    const ids = records.map((record) => record.id);
    if (!this.#sameArray(ids, [...ids].sort())) {
      throw new Error("Bridge registry must be sorted by canonical id");
    }
    if (new Set(ids).size !== ids.length) {
      throw new Error("Bridge registry ids must be unique");
    }
  }

  #assertProviders(actual, expected, id) {
    const normalize = (items) =>
      (Array.isArray(items) ? items : [])
        .map((item) => `${item.symbol}\u0000${item.mechanism}`)
        .sort();
    if (!this.#sameArray(normalize(actual), normalize(expected))) {
      throw new Error(`${id} globalProviders differ from approved contract`);
    }
  }

  #assertRecordShape(record) {
    const expectedKeys = [
      "bridge",
      "globalProviders",
      "id",
      "introducedStage",
      "owner",
      "reason",
      "removalStage",
      "source",
      "target",
    ];
    if (!this.#sameArray(Object.keys(record || {}).sort(), expectedKeys)) {
      throw new Error(
        `Bridge record has non-contract fields: ${record?.id || "<unknown>"}`,
      );
    }
    for (const provider of record.globalProviders || []) {
      if (!this.#sameArray(Object.keys(provider).sort(), ["mechanism", "symbol"])) {
        throw new Error(`${record.id} bridge global has non-contract fields`);
      }
    }
  }

  #sameArray(left, right) {
    return left.length === right.length &&
      left.every((value, index) => value === right[index]);
  }
}

module.exports = { StageTwoExecutionStateValidator, ActiveBridgePlanResolver };
