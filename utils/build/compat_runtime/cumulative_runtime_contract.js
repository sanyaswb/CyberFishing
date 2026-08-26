"use strict";

const crypto = require("node:crypto");
const path = require("node:path");
const { immutableRecord } = require("../../architecture/guards/core/guard_models");

const EXACT_TRANSPORT_GLOBAL = "__CYBER_FISHING_COMPAT_RUNTIME__";

class CanonicalCompatibilityPath {
  static normalize(value, label = "path") {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`${label} must be a non-empty string`);
    }
    if (
      value.includes("\\") ||
      /[*?[\]]/.test(value) ||
      path.isAbsolute(value) ||
      /^[A-Za-z]:/.test(value) ||
      value.split("/").some((part) => part === "" || part === "." || part === "..")
    ) {
      throw new Error(`${label} is not a canonical project path: ${value}`);
    }
    return value;
  }
}

class CanonicalActivationIdentity {
  static object(record) {
    return {
      exportName: this.#identifier(record.exportName, "exportName"),
      legacyScriptIndex: this.#scriptIndex(record.legacyScriptIndex),
      legacySymbol: this.#identifier(record.legacySymbol, "legacySymbol"),
      shimFile: CanonicalCompatibilityPath.normalize(record.shimFile, "shimFile"),
      sourceProvider: CanonicalCompatibilityPath.normalize(
        record.sourceProvider,
        "sourceProvider",
      ),
      targetModule: CanonicalCompatibilityPath.normalize(
        record.targetModule,
        "targetModule",
      ),
    };
  }

  static serialize(record) {
    return JSON.stringify(this.object(record));
  }

  static id(record) {
    const digest = crypto
      .createHash("sha256")
      .update(Buffer.from(this.serialize(record), "utf8"))
      .digest("hex");
    return `activation-${digest.slice(0, 12)}`;
  }

  static #identifier(value, label) {
    if (typeof value !== "string" || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value)) {
      throw new Error(`${label} must be a JavaScript identifier`);
    }
    return value;
  }

  static #scriptIndex(value) {
    if (!Number.isInteger(value) || value < 1) {
      throw new Error("legacyScriptIndex must be a positive integer");
    }
    return value;
  }
}

class CumulativeRuntimeContractValidator {
  validate(contract) {
    const errors = [];
    const require = (condition, message) => {
      if (!condition) errors.push(message);
    };
    require(contract?.schemaVersion === 1, "schemaVersion must be 1");
    require(
      contract?.kind === "cyber-fishing-stage-3-cumulative-compatibility-runtime",
      "kind is invalid",
    );
    require(
      ["foundation-verified", "migration-active", "migration-complete"].includes(
        contract?.status,
      ),
      "status is invalid",
    );
    const transport = contract?.transport || {};
    require(
      transport.symbol === EXACT_TRANSPORT_GLOBAL,
      `transport.symbol must be exactly ${EXACT_TRANSPORT_GLOBAL}`,
    );
    require(
      transport.owner === "stage-3.0.4-single-instance-compatibility-runtime",
      "transport.owner is invalid",
    );
    require(this.#text(transport.reason), "transport.reason is required");
    require(transport.introducedStage === "stage-3.0.4", "introducedStage is invalid");
    require(transport.removalStage === "stage-5", "removalStage must be stage-5");
    require(transport.surface === "module-exports-only", "transport surface is invalid");
    require(transport.ownsGameState === false, "transport must not own game state");

    const topology = contract?.topology || {};
    require(topology.buildMode === "single-cumulative-iife", "buildMode is invalid");
    require(
      topology.moduleInstancePolicy === "one-record-per-resolved-module",
      "moduleInstancePolicy is invalid",
    );
    require(
      topology.dependentTargetBuildPolicy === "isolated-per-wrapper-iife-forbidden",
      "dependent target build policy is invalid",
    );
    require(
      topology.evaluationPolicy === "full-closure-effect-gate",
      "evaluationPolicy is invalid",
    );
    require(
      topology.exposurePolicy === "exact-legacy-load-order-activation",
      "exposurePolicy is invalid",
    );

    require(
      contract?.output?.directory === "dist/stage-3-compat-runtime/",
      "output.directory is invalid",
    );
    require(
      contract?.output?.runtimeFile === "compat_runtime.iife.js",
      "output.runtimeFile is invalid",
    );
    require(
      contract?.output?.activationDirectory === "activations/",
      "output.activationDirectory is invalid",
    );

    const infrastructure = Array.isArray(contract?.approvedInfrastructureModules)
      ? contract.approvedInfrastructureModules
      : [];
    const normalizedInfrastructure = [];
    for (const modulePath of infrastructure) {
      try {
        normalizedInfrastructure.push(
          CanonicalCompatibilityPath.normalize(modulePath, "infrastructure module"),
        );
      } catch (error) {
        errors.push(error.message);
      }
    }
    require(
      this.#sameArray(normalizedInfrastructure, [...normalizedInfrastructure].sort()),
      "approvedInfrastructureModules must be sorted",
    );
    require(
      new Set(normalizedInfrastructure).size === normalizedInfrastructure.length,
      "approvedInfrastructureModules must be unique",
    );
    const allowedVirtualModules = new Set([
      "\u0000rolldown/runtime.js",
      "\u0000@oxc-project+runtime@0.146.0/helpers/esm/assertClassBrand.js",
      "\u0000@oxc-project+runtime@0.146.0/helpers/esm/checkPrivateRedeclaration.js",
      "\u0000@oxc-project+runtime@0.146.0/helpers/esm/classPrivateFieldGet2.js",
      "\u0000@oxc-project+runtime@0.146.0/helpers/esm/classPrivateFieldInitSpec.js",
      "\u0000@oxc-project+runtime@0.146.0/helpers/esm/classPrivateFieldSet2.js",
      "\u0000@oxc-project+runtime@0.146.0/helpers/esm/classPrivateMethodInitSpec.js",
    ]);
    require(
      Array.isArray(contract?.approvedVirtualModules) &&
        contract.approvedVirtualModules.length > 0 &&
        contract.approvedVirtualModules.every((item) => allowedVirtualModules.has(item)) &&
        contract.approvedVirtualModules.includes("\u0000rolldown/runtime.js") &&
        this.#sameArray(
          contract.approvedVirtualModules,
          [...contract.approvedVirtualModules].sort(),
        ) &&
        new Set(contract.approvedVirtualModules).size ===
          contract.approvedVirtualModules.length,
      "approvedVirtualModules must be the exact sorted pinned runtime allowlist",
    );
    const transitions = Array.isArray(contract?.previousRuntimeTransitions)
      ? contract.previousRuntimeTransitions
      : [];
    const transitionModules = [];
    for (const transition of transitions) {
      try {
        const modulePath = CanonicalCompatibilityPath.normalize(
          transition?.module,
          "previous runtime transition module",
        );
        require(
          this.#sameArray(Object.keys(transition || {}).sort(), [
            "activationIds",
            "module",
            "owner",
            "previousOutputs",
            "previousRuntime",
            "reason",
            "requiredTransition",
          ]),
          `previous runtime transition has non-contract fields: ${modulePath}`,
        );
        require(
          transition.previousRuntime === "stage-2-isolated-iife",
          `${modulePath} previousRuntime is invalid`,
        );
        require(
          transition.requiredTransition ===
            "replace-isolated-output-with-cumulative-activation",
          `${modulePath} requiredTransition is invalid`,
        );
        require(this.#text(transition.owner), `${modulePath} transition owner is required`);
        require(this.#text(transition.reason), `${modulePath} transition reason is required`);
        const outputPaths = Array.isArray(transition.previousOutputs)
          ? transition.previousOutputs.map((value) =>
            CanonicalCompatibilityPath.normalize(value, "previous runtime output"))
          : [];
        require(outputPaths.length > 0, `${modulePath} requires previousOutputs`);
        require(
          this.#sameArray(outputPaths, [...outputPaths].sort()) &&
            new Set(outputPaths).size === outputPaths.length,
          `${modulePath} previousOutputs must be sorted and unique`,
        );
        const activationIds = Array.isArray(transition.activationIds)
          ? transition.activationIds
          : [];
        require(activationIds.length > 0, `${modulePath} requires activationIds`);
        require(
          this.#sameArray(activationIds, [...activationIds].sort()) &&
            new Set(activationIds).size === activationIds.length,
          `${modulePath} activationIds must be sorted and unique`,
        );
        require(
          activationIds.every((id) => /^activation-[a-f0-9]{12}$/.test(id)),
          `${modulePath} activationIds are invalid`,
        );
        transitionModules.push(modulePath);
      } catch (error) {
        errors.push(error.message);
      }
    }
    require(
      this.#sameArray(transitionModules, [...transitionModules].sort()),
      "previousRuntimeTransitions must be sorted by module",
    );
    require(
      new Set(transitionModules).size === transitionModules.length,
      "previousRuntimeTransitions modules must be unique",
    );

    const reviews = Array.isArray(contract?.sideEffectReviews)
      ? contract.sideEffectReviews
      : [];
    const reviewKeys = new Set();
    for (const review of reviews) {
      try {
        const modulePath = CanonicalCompatibilityPath.normalize(
          review?.module,
          "side-effect review module",
        );
        require(
          this.#sameArray(Object.keys(review || {}).sort(), [
            "decision",
            "evidenceFingerprint",
            "module",
            "owner",
            "reason",
          ]),
          `side-effect review has non-contract fields: ${modulePath}`,
        );
        require(review.decision === "approved-compatible", `${modulePath} review decision is invalid`);
        require(/^[a-f0-9]{64}$/.test(review.evidenceFingerprint || ""), `${modulePath} review fingerprint is invalid`);
        require(this.#text(review.owner), `${modulePath} review owner is required`);
        require(this.#text(review.reason), `${modulePath} review reason is required`);
        require(!reviewKeys.has(modulePath), `duplicate side-effect review: ${modulePath}`);
        reviewKeys.add(modulePath);
      } catch (error) {
        errors.push(error.message);
      }
    }

    const activations = Array.isArray(contract?.activationPositions)
      ? contract.activationPositions
      : [];
    const plannedActivations = Array.isArray(contract?.plannedActivationPositions)
      ? contract.plannedActivationPositions
      : [];
    const activationIds = [];
    const activationPositions = new Set();
    const validateActivation = (activation, lifecycle) => {
      try {
        const identity = CanonicalActivationIdentity.object(activation);
        const expectedKeys = [
          "exportName",
          "id",
          "legacyScriptIndex",
          "legacySymbol",
          "owner",
          "reason",
          "removalStage",
          "shimFile",
          "sourceProvider",
          "targetModule",
        ];
        require(
          this.#sameArray(Object.keys(activation || {}).sort(), expectedKeys),
          `activation has non-contract fields: ${activation?.id || "<unknown>"}`,
        );
        require(
          activation.id === CanonicalActivationIdentity.id(activation),
          `activation id is not canonical: ${activation.id}`,
        );
        require(this.#text(activation.owner), `${activation.id} owner is required`);
        require(this.#text(activation.reason), `${activation.id} reason is required`);
        require(
          ["stage-3", "stage-4", "stage-5"].includes(activation.removalStage),
          `${activation.id} removalStage must be stage-3, stage-4 or stage-5`,
        );
        require(
          identity.shimFile.startsWith("activations/") && identity.shimFile.endsWith(".js"),
          `${activation.id} shimFile must be an activation .js path`,
        );
        const positionKey = `${identity.legacyScriptIndex}\u0000${identity.legacySymbol}`;
        require(!activationPositions.has(positionKey), `duplicate activation position: ${positionKey}`);
        activationPositions.add(positionKey);
        activationIds.push(activation.id);
      } catch (error) {
        errors.push(error.message);
      }
    };
    for (const activation of activations) validateActivation(activation, "active");
    for (const activation of plannedActivations) validateActivation(activation, "planned");
    require(
      this.#sameArray(
        activations.map((activation) => activation.id),
        [...activations.map((activation) => activation.id)].sort(),
      ),
      "activationPositions must be sorted by canonical id",
    );
    require(
      this.#sameArray(
        plannedActivations.map((activation) => activation.id),
        [...plannedActivations.map((activation) => activation.id)].sort(),
      ),
      "plannedActivationPositions must be sorted by canonical id",
    );
    require(new Set(activationIds).size === activationIds.length, "activation ids must be unique across active and planned records");
    if (contract?.status === "foundation-verified") {
      require(activations.length === 0, "foundation-verified requires no activation positions");
      require(plannedActivations.length === 0, "foundation-verified requires no planned activation positions");
      require(reviews.length === 0, "foundation-verified requires no side-effect reviews");
      require(transitions.length === 0, "foundation-verified requires no previous runtime transitions");
    }

    if (errors.length > 0) {
      throw new Error(`Stage 3 compatibility runtime contract failed:\n- ${errors.join("\n- ")}`);
    }
    return immutableRecord(contract);
  }

  #text(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  #sameArray(left, right) {
    return left.length === right.length &&
      left.every((value, index) => value === right[index]);
  }
}

module.exports = {
  CanonicalActivationIdentity,
  CanonicalCompatibilityPath,
  CumulativeRuntimeContractValidator,
  EXACT_TRANSPORT_GLOBAL,
};
