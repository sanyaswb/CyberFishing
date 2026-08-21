const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const espree = require("espree");
const {
  EsmDependencyObserver,
} = require("../architecture/guards/observation/esm_dependency_observer");

class CanonicalBridgeIdentity {
  static normalizePath(value) {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error("Bridge identity path must be a non-empty string");
    }
    if (
      value.includes("\\") ||
      /[*?[\]]/.test(value) ||
      path.isAbsolute(value) ||
      /^[A-Za-z]:/.test(value) ||
      value.split("/").some((part) =>
        part === "" || part === "." || part === "..")
    ) {
      throw new Error(`Bridge identity path is not canonical: ${value}`);
    }
    return value;
  }

  static object(record) {
    return {
      bridge: this.normalizePath(record.bridge),
      owner: this.#requireText(record.owner, "owner"),
      source: this.normalizePath(record.source),
      target: this.normalizePath(record.target),
    };
  }

  static serialize(record) {
    const identity = this.object(record);
    return JSON.stringify({
      bridge: identity.bridge,
      owner: identity.owner,
      source: identity.source,
      target: identity.target,
    });
  }

  static id(record) {
    const digest = crypto
      .createHash("sha256")
      .update(Buffer.from(this.serialize(record), "utf8"))
      .digest("hex");
    return `bridge-${digest.slice(0, 12)}`;
  }

  static #requireText(value, field) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`Bridge identity ${field} must be a non-empty string`);
    }
    return value;
  }
}

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

class BridgeWrapperContractValidator {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
  }

  validate(plan) {
    const wrapperAbsolute = this.#absolute(plan.wrapperPath);
    const targetAbsolute = this.#absolute(plan.targetModule);
    if (!fs.existsSync(wrapperAbsolute)) {
      throw new Error(`Active bridge wrapper is missing: ${plan.wrapperPath}`);
    }
    if (!fs.existsSync(targetAbsolute)) {
      throw new Error(`Active bridge target is missing: ${plan.targetModule}`);
    }
    const tree = espree.parse(fs.readFileSync(wrapperAbsolute, "utf8"), {
      ecmaVersion: "latest",
      sourceType: "module",
      loc: true,
    });
    const imports = tree.body.filter((node) => node.type === "ImportDeclaration");
    const statements = tree.body.filter((node) => node.type !== "ImportDeclaration");
    if (imports.length !== 1) throw new Error("Bridge wrapper requires exactly one import");
    const importedPath = imports[0].source.value;
    if (
      typeof importedPath !== "string" ||
      !importedPath.startsWith(".") ||
      !importedPath.endsWith(".js")
    ) {
      throw new Error("Bridge wrapper import must be relative with explicit .js");
    }
    const resolvedTarget = path
      .relative(
        this.projectRoot,
        path.resolve(path.dirname(wrapperAbsolute), importedPath),
      )
      .replaceAll("\\", "/");
    if (resolvedTarget !== plan.targetModule) {
      throw new Error("Bridge wrapper import differs from approved target");
    }
    const expectedSymbols = plan.globalProviders.map((item) => item.symbol).sort();
    const importedSymbols = imports[0].specifiers.map((specifier) => {
      if (
        specifier.type !== "ImportSpecifier" ||
        specifier.imported.name !== specifier.local.name
      ) {
        throw new Error("Bridge wrapper requires non-aliased named imports");
      }
      return specifier.imported.name;
    }).sort();
    if (!this.#sameArray(importedSymbols, expectedSymbols)) {
      throw new Error("Bridge wrapper imports differ from approved providers");
    }
    if (statements.length !== expectedSymbols.length) {
      throw new Error("Bridge wrapper may only contain exact global assignments");
    }
    const assignedSymbols = statements.map((statement) =>
      this.#assignmentSymbol(statement),
    ).sort();
    if (!this.#sameArray(assignedSymbols, expectedSymbols)) {
      throw new Error("Bridge wrapper global assignments differ from approved providers");
    }
    this.#validateTargetExports(targetAbsolute, expectedSymbols);
    return Object.freeze({
      wrapperPath: plan.wrapperPath,
      targetModule: plan.targetModule,
      symbols: Object.freeze(expectedSymbols),
    });
  }

  #assignmentSymbol(statement) {
    const expression = statement?.type === "ExpressionStatement"
      ? statement.expression
      : null;
    const left = expression?.type === "AssignmentExpression" &&
      expression.operator === "="
      ? expression.left
      : null;
    if (
      left?.type !== "MemberExpression" ||
      left.computed ||
      left.object?.type !== "Identifier" ||
      left.object.name !== "globalThis" ||
      left.property?.type !== "Identifier" ||
      expression.right?.type !== "Identifier" ||
      expression.right.name !== left.property.name
    ) {
      throw new Error("Bridge wrapper contains non-contract business logic");
    }
    return left.property.name;
  }

  #validateTargetExports(targetAbsolute, expectedSymbols) {
    const tree = espree.parse(fs.readFileSync(targetAbsolute, "utf8"), {
      ecmaVersion: "latest",
      sourceType: "module",
    });
    const exports = [];
    for (const node of tree.body) {
      if (node.type === "ExportDefaultDeclaration" || node.type === "ExportAllDeclaration") {
        throw new Error("Bridge target must use named exports only");
      }
      if (node.type !== "ExportNamedDeclaration") continue;
      if (node.declaration?.id?.name) exports.push(node.declaration.id.name);
      for (const specifier of node.specifiers || []) exports.push(specifier.exported.name);
    }
    if (!expectedSymbols.every((symbol) => exports.includes(symbol))) {
      throw new Error("Bridge target is missing an approved named export");
    }
  }

  #absolute(relativePath) {
    const absolute = path.resolve(this.projectRoot, relativePath);
    const relative = path.relative(this.projectRoot, absolute);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`Bridge path escapes project root: ${relativePath}`);
    }
    return absolute;
  }

  #sameArray(left, right) {
    return left.length === right.length &&
      left.every((value, index) => value === right[index]);
  }
}

class ApprovedDependencyClosureValidator {
  constructor({ projectRoot, approvedPlan, state, architecturePolicy = null, manifest = null }) {
    this.projectRoot = projectRoot;
    this.approvedPlan = approvedPlan;
    this.state = state;
    this.architecturePolicy = architecturePolicy;
    this.manifest = manifest;
    this.observer = new EsmDependencyObserver({ projectRoot });
  }

  validate(plan) {
    const allowed = this.#allowedProjectModules(plan);
    const visited = new Set();
    const edges = [];
    const queue = [plan.wrapperPath];
    while (queue.length > 0) {
      const source = queue.shift();
      if (visited.has(source)) continue;
      visited.add(source);
      if (!allowed.has(source)) {
        throw new Error(`Bridge dependency closure contains unapproved module: ${source}`);
      }
      const observation = this.observer.observeFile(source);
      if (observation.status !== "verified") {
        throw new Error(`Bridge dependency observation is not verified: ${source}`);
      }
      this.#validateModulePolicy(source, observation, plan);
      for (const dependency of observation.observations) {
        if (dependency.resolutionStatus !== "confirmed-project") {
          throw new Error(
            `Bridge dependency is not a confirmed project module: ${dependency.specifier}`,
          );
        }
        if (!dependency.hasExplicitJsExtension) {
          throw new Error(`Bridge dependency requires explicit .js: ${dependency.specifier}`);
        }
        const target = dependency.resolvedTarget;
        if (!allowed.has(target)) {
          throw new Error(`Bridge dependency closure contains unapproved module: ${target}`);
        }
        this.#validateBoundaryEdge(source, target);
        edges.push(Object.freeze({ source, target }));
        queue.push(target);
      }
    }
    if (!visited.has(plan.targetModule)) {
      throw new Error("Bridge dependency closure does not reach the approved target");
    }
    return Object.freeze({
      bundledModules: Object.freeze([...visited].sort()),
      edges: Object.freeze(edges.sort((a, b) =>
        `${a.source}\u0000${a.target}`.localeCompare(`${b.source}\u0000${b.target}`))),
    });
  }

  #allowedProjectModules(plan) {
    const allowedBatchIds = new Set([
      ...this.state.completedBatchIds,
      ...(this.state.activeBatchId ? [this.state.activeBatchId] : []),
    ]);
    const values = new Set([plan.wrapperPath, plan.targetModule]);
    for (const batch of this.approvedPlan.batches || []) {
      if (!allowedBatchIds.has(batch.id)) continue;
      for (const module of batch.modules || []) values.add(module.targetPath);
    }
    return values;
  }

  #validateBoundaryEdge(source, target) {
    if (!this.architecturePolicy) return;
    const sourceBoundary = this.#boundaryFor(source);
    const targetBoundary = this.#boundaryFor(target);
    if (!sourceBoundary || !targetBoundary) {
      throw new Error(`Bridge graph lacks boundary metadata: ${source} → ${target}`);
    }
    const definition = this.architecturePolicy.getBoundary(sourceBoundary);
    if (!definition?.allowedDependencies?.includes(targetBoundary)) {
      throw new Error(
        `Bridge graph violates boundary policy: ${sourceBoundary} → ${targetBoundary}`,
      );
    }
    if (["dev", "bootstrap-development", "entrypoint-dev"].includes(targetBoundary)) {
      throw new Error(`Bridge graph leaks development module: ${target}`);
    }
    const sourceEntry = this.#entryFor(source);
    const targetEntry = this.#entryFor(target);
    const developmentOnlyRoles = new Set(
      this.architecturePolicy.architectureGuards?.developmentOnlyRoles || [],
    );
    if ((targetEntry?.architecture?.roles || []).some((role) =>
      developmentOnlyRoles.has(role))) {
      throw new Error(`Bridge graph leaks development-only role: ${target}`);
    }
    const qualified = this.architecturePolicy.qualifiedDependencies.find(
      (rule) =>
        rule.sourceBoundary === sourceBoundary &&
        rule.targetBoundary === targetBoundary,
    );
    if (qualified) {
      const targetRoles = targetEntry?.architecture?.roles || [];
      if (!targetRoles.some((role) =>
        qualified.allowedTargetModuleRoles.includes(role))) {
        throw new Error(
          `Bridge graph violates qualified role policy: ${source} → ${target}`,
        );
      }
    }
  }

  #validateModulePolicy(modulePath, observation, plan) {
    if (!this.architecturePolicy) return;
    const boundary = this.#boundaryFor(modulePath);
    const entry = this.#entryFor(modulePath);
    const isWrapper = modulePath === plan.wrapperPath;
    const conventions = this.architecturePolicy.definition.moduleConventions || {};

    if (
      !isWrapper &&
      !conventions.appliesToStatuses?.includes(entry?.architecture?.migrationStatus)
    ) {
      throw new Error(`Bridge graph ESM status mismatch: ${modulePath}`);
    }
    if (observation.exports.some((item) => item.kind === "default")) {
      throw new Error(`Bridge graph contains forbidden default export: ${modulePath}`);
    }
    if (observation.exports.some((item) => item.kind === "barrel")) {
      throw new Error(`Bridge graph contains forbidden barrel export: ${modulePath}`);
    }
    if (
      observation.observations.some((item) =>
        item.mechanism === "side-effect-import") &&
      !conventions.sideEffectImports?.allowedBoundaries?.includes(boundary)
    ) {
      throw new Error(`Bridge graph contains forbidden side-effect import: ${modulePath}`);
    }
    if (!isWrapper && observation.globalAssignments.length > 0) {
      throw new Error(`Bridge graph ESM module exports through a global: ${modulePath}`);
    }
    if (!isWrapper && observation.globalMemberReads.length > 0) {
      throw new Error(`Bridge graph ESM module reads a global property: ${modulePath}`);
    }

    const environment =
      this.architecturePolicy.observationContract.environmentModel || {};
    const builtins = new Set(environment.builtins || []);
    const browserApis = new Set(environment.browserApis || []);
    const browserPolicy =
      this.architecturePolicy.architectureGuards?.browserCapabilities || {};
    const allowedCapabilities = new Set(
      browserPolicy.allowedBoundaries?.[boundary] || [],
    );
    const capabilityByIdentifier = new Map();
    for (const [capability, identifiers] of Object.entries(
      browserPolicy.catalog || {},
    )) {
      for (const identifier of identifiers) {
        capabilityByIdentifier.set(identifier, capability);
      }
    }
    for (const identifier of observation.externalIdentifiers) {
      if (builtins.has(identifier)) continue;
      if (browserApis.has(identifier)) {
        const capability = capabilityByIdentifier.get(identifier);
        if (capability && allowedCapabilities.has(capability)) continue;
        throw new Error(
          `Bridge graph module uses forbidden browser capability: ${modulePath}`,
        );
      }
      throw new Error(
        `Bridge graph ESM module consumes unresolved global ${identifier}: ` +
          modulePath,
      );
    }

    const observedBrowserApis = entry?.observed?.environment?.browserApis || [];
    if (
      observedBrowserApis.length > 0 &&
      !["platform", "dev"].includes(boundary)
    ) {
      throw new Error(
        `Bridge graph module uses forbidden browser capability: ${modulePath}`,
      );
    }
  }

  #entryFor(modulePath) {
    return (this.manifest?.modules || []).find(
      (candidate) =>
        candidate.currentPath === modulePath ||
        candidate.architecture?.targetPath === modulePath,
    ) || null;
  }

  #boundaryFor(modulePath) {
    const entry = this.#entryFor(modulePath);
    return entry?.architecture?.targetBoundary ||
      this.architecturePolicy.resolveBoundary(modulePath)?.id || null;
  }
}

module.exports = {
  ActiveBridgePlanResolver,
  ApprovedDependencyClosureValidator,
  BridgeWrapperContractValidator,
  CanonicalBridgeIdentity,
  StageTwoExecutionStateValidator,
};
