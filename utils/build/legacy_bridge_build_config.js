const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const espree = require("espree");
const {
  EsmDependencyObserver,
} = require("../architecture/guards/observation/esm_dependency_observer");

const { CanonicalBridgeIdentity } = require("../architecture/migration/canonical_bridge_identity");
const { StageTwoExecutionStateValidator, ActiveBridgePlanResolver } = require("../architecture/migration/stage_two_bridge_plan");

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
