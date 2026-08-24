const path = require("node:path");
const { ArchitecturePolicy } = require("./core/architecture_policy");
const {
  ArchitectureGuardPolicyValidator,
} = require("./guards/contracts/architecture_guard_policy_validator");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const POLICY_PATH = path.join(
  PROJECT_ROOT,
  "architecture",
  "module_architecture.json",
);

class ValidationResult {
  #errors = [];

  require(condition, message) {
    if (!condition) this.#errors.push(message);
  }

  add(message) {
    this.#errors.push(message);
  }

  assertValid() {
    if (this.#errors.length === 0) return;
    throw new Error(
      `Architecture policy is invalid:\n- ${this.#errors.join("\n- ")}`,
    );
  }
}

class BoundaryPolicyValidator {
  validate(policy, result) {
    result.require(
      policy.definition.schemaVersion === 2,
      "schemaVersion must equal 2",
    );
    result.require(
      typeof policy.definition.policyId === "string" &&
        policy.definition.policyId.length > 0,
      "policyId must be a non-empty string",
    );
    result.require(
      policy.boundaries.length > 0,
      "targetBoundaries must not be empty",
    );

    const boundaryIds = new Set();
    const pathPrefixes = new Set();
    for (const boundary of policy.boundaries) {
      this.#validateBoundaryShape(boundary, result);
      if (boundaryIds.has(boundary.id)) {
        result.add(`duplicate boundary id: ${boundary.id}`);
      }
      boundaryIds.add(boundary.id);

      for (const prefix of boundary.pathPrefixes || []) {
        if (pathPrefixes.has(prefix)) {
          result.add(`duplicate boundary path prefix: ${prefix}`);
        }
        pathPrefixes.add(prefix);
      }
    }

    for (const boundary of policy.boundaries) {
      for (const dependencyId of boundary.allowedDependencies || []) {
        result.require(
          boundaryIds.has(dependencyId),
          `${boundary.id} references unknown dependency boundary: ${dependencyId}`,
        );
      }
    }

    const engineDependencies = policy.getBoundary("engine")
      ?.allowedDependencies || [];
    result.require(
      engineDependencies.length === 1 && engineDependencies[0] === "engine",
      "engine must depend only on engine",
    );
    this.#requireForbiddenDependencies(policy, result, "game-domain", [
      "game-config-raw",
      "game-config",
      "game-application",
      "game-presentation",
      "platform",
      "dev",
      "bootstrap-production",
      "bootstrap-development",
    ]);
    const rawConfigDependencies = policy.getBoundary("game-config-raw")
      ?.allowedDependencies;
    result.require(
      Array.isArray(rawConfigDependencies) && rawConfigDependencies.length === 0,
      "game-config-raw must be dependency-free",
    );
    this.#requireForbiddenDependencies(policy, result, "game-application", [
      "game-presentation",
      "platform",
      "dev",
      "bootstrap-production",
      "bootstrap-development",
    ]);
    this.#requireForbiddenDependencies(policy, result, "platform", [
      "game-config",
      "game-domain",
      "game-application",
      "game-presentation",
      "dev",
      "bootstrap-production",
      "bootstrap-development",
    ]);
  }

  #validateBoundaryShape(boundary, result) {
    result.require(
      typeof boundary.id === "string" && boundary.id.length > 0,
      "every boundary requires a non-empty id",
    );
    result.require(
      typeof boundary.description === "string" &&
        boundary.description.length > 0,
      `${boundary.id || "<unknown>"} requires a description`,
    );
    result.require(
      Array.isArray(boundary.pathPrefixes) && boundary.pathPrefixes.length > 0,
      `${boundary.id || "<unknown>"} requires pathPrefixes`,
    );
    result.require(
      Array.isArray(boundary.allowedDependencies),
      `${boundary.id || "<unknown>"} requires allowedDependencies`,
    );
  }

  #requireForbiddenDependencies(policy, result, boundaryId, forbiddenIds) {
    const boundary = policy.getBoundary(boundaryId);
    result.require(!!boundary, `required boundary is missing: ${boundaryId}`);
    if (!boundary) return;
    for (const forbiddenId of forbiddenIds) {
      result.require(
        !boundary.allowedDependencies.includes(forbiddenId),
        `${boundaryId} must not depend on ${forbiddenId}`,
      );
    }
  }
}

class QualifiedDependencyPolicyValidator {
  validate(policy, result) {
    const moduleRoleIds = new Set();
    for (const role of policy.moduleRoles) {
      result.require(
        typeof role.id === "string" && role.id.length > 0,
        "every module role requires an id",
      );
      result.require(
        typeof role.description === "string" && role.description.length > 0,
        `${role.id || "<unknown>"} module role requires a description`,
      );
      if (moduleRoleIds.has(role.id)) {
        result.add(`duplicate module role id: ${role.id}`);
      }
      moduleRoleIds.add(role.id);
    }
    result.require(moduleRoleIds.size > 0, "moduleRoles must not be empty");
    for (const engineRole of [
      "engine-contract",
      "engine-runtime",
      "engine-utility",
    ]) {
      result.require(
        moduleRoleIds.has(engineRole),
        `moduleRoles requires ${engineRole}`,
      );
    }

    const ruleIds = new Set();
    for (const rule of policy.qualifiedDependencies) {
      const source = policy.getBoundary(rule.sourceBoundary);
      const target = policy.getBoundary(rule.targetBoundary);
      result.require(!!source, `${rule.id} has unknown source boundary`);
      result.require(!!target, `${rule.id} has unknown target boundary`);
      result.require(
        !!source?.allowedDependencies.includes(rule.targetBoundary),
        `${rule.id} must qualify an allowed boundary edge`,
      );
      result.require(
        Array.isArray(rule.allowedTargetModuleRoles) &&
          rule.allowedTargetModuleRoles.length > 0,
        `${rule.id} requires allowedTargetModuleRoles`,
      );
      for (const roleId of rule.allowedTargetModuleRoles || []) {
        result.require(
          moduleRoleIds.has(roleId),
          `${rule.id} references unknown module role: ${roleId}`,
        );
      }
      if (ruleIds.has(rule.id)) {
        result.add(`duplicate qualified dependency id: ${rule.id}`);
      }
      ruleIds.add(rule.id);
    }

    const configDomainRule = policy.qualifiedDependencies.find(
      (rule) =>
        rule.sourceBoundary === "game-config" &&
        rule.targetBoundary === "game-domain",
    );
    result.require(
      !!configDomainRule,
      "game-config → game-domain requires a qualified dependency rule",
    );
    result.require(
      configDomainRule?.allowedTargetModuleRoles.length === 2 &&
        configDomainRule.allowedTargetModuleRoles.includes("domain-contract") &&
        configDomainRule.allowedTargetModuleRoles.includes("value-object"),
      "game-config may target only domain-contract and value-object roles",
    );
  }
}

class BoundaryDependencyGraph {
  constructor(policy) {
    this.policy = policy;
  }

  findReachable(boundaryId) {
    const visited = new Set();
    const pending = [boundaryId];
    while (pending.length > 0) {
      const currentId = pending.pop();
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      const boundary = this.policy.getBoundary(currentId);
      if (!boundary) continue;
      for (const dependencyId of boundary.allowedDependencies) {
        if (!visited.has(dependencyId)) pending.push(dependencyId);
      }
    }
    return visited;
  }
}

class EnvironmentPolicyValidator {
  validate(policy, result) {
    const environments = policy.definition.environments || {};
    const production = environments.production;
    const development = environments.development;
    result.require(!!production, "production environment policy is required");
    result.require(!!development, "development environment policy is required");
    if (!production || !development) return;

    result.require(
      !!policy.getBoundary(production.rootBoundary),
      `unknown production root boundary: ${production.rootBoundary}`,
    );
    result.require(
      !!policy.getBoundary(development.rootBoundary),
      `unknown development root boundary: ${development.rootBoundary}`,
    );

    for (const boundaryId of production.forbiddenReachableBoundaries || []) {
      result.require(
        !!policy.getBoundary(boundaryId),
        `unknown production-forbidden boundary: ${boundaryId}`,
      );
    }

    const reachable = new BoundaryDependencyGraph(policy).findReachable(
      production.rootBoundary,
    );
    result.require(
      production.forbiddenReachableBoundaries.includes("dev"),
      "production environment must explicitly forbid dev",
    );
    for (const forbiddenId of production.forbiddenReachableBoundaries || []) {
      result.require(
        !reachable.has(forbiddenId),
        `production graph must not reach ${forbiddenId}`,
      );
    }

    const developmentReachable = new BoundaryDependencyGraph(
      policy,
    ).findReachable(development.rootBoundary);
    result.require(
      developmentReachable.has("dev"),
      "development graph must reach dev composition",
    );

    const allowedDevConsumers = new Set([
      "dev",
      "bootstrap-development",
    ]);
    for (const boundary of policy.boundaries) {
      if (!boundary.allowedDependencies.includes("dev")) continue;
      result.require(
        allowedDevConsumers.has(boundary.id),
        `${boundary.id} must not depend on dev`,
      );
    }
  }
}

class MigrationPolicyValidator {
  validate(policy, result) {
    const statusIds = this.#validateStatuses(policy, result);
    this.#validateWaves(policy, result);

    for (const statusId of policy.definition.moduleConventions
      ?.appliesToStatuses || []) {
      result.require(
        statusIds.has(statusId),
        `module conventions reference unknown migration status: ${statusId}`,
      );
    }
  }

  #validateStatuses(policy, result) {
    const statusIds = new Set();
    result.require(policy.statuses.length > 0, "migration statuses are required");
    for (const status of policy.statuses) {
      result.require(
        typeof status.id === "string" && status.id.length > 0,
        "every migration status requires an id",
      );
      result.require(
        typeof status.description === "string" && status.description.length > 0,
        `${status.id || "<unknown>"} status requires a description`,
      );
      result.require(
        Array.isArray(status.allowedTransitions),
        `${status.id || "<unknown>"} requires allowedTransitions`,
      );
      if (statusIds.has(status.id)) {
        result.add(`duplicate migration status id: ${status.id}`);
      }
      statusIds.add(status.id);
    }
    for (const status of policy.statuses) {
      for (const transitionId of status.allowedTransitions || []) {
        result.require(
          statusIds.has(transitionId),
          `${status.id} references unknown transition status: ${transitionId}`,
        );
      }
    }
    return statusIds;
  }

  #validateWaves(policy, result) {
    const waveIds = new Set();
    const waveOrders = new Set();
    const coveredBoundaries = new Set();
    result.require(policy.waves.length > 0, "migration waves are required");
    for (const wave of policy.waves) {
      result.require(
        Number.isInteger(wave.order) && wave.order >= 0,
        `${wave.id || "<unknown>"} wave requires a non-negative order`,
      );
      result.require(
        typeof wave.description === "string" && wave.description.length > 0,
        `${wave.id || "<unknown>"} wave requires a description`,
      );
      if (waveIds.has(wave.id)) result.add(`duplicate migration wave id: ${wave.id}`);
      if (waveOrders.has(wave.order)) {
        result.add(`duplicate migration wave order: ${wave.order}`);
      }
      waveIds.add(wave.id);
      waveOrders.add(wave.order);
      for (const boundaryId of wave.targetBoundaries || []) {
        result.require(
          !!policy.getBoundary(boundaryId),
          `${wave.id} wave references unknown boundary: ${boundaryId}`,
        );
        coveredBoundaries.add(boundaryId);
      }
    }

    const sortedOrders = [...waveOrders].sort((left, right) => left - right);
    sortedOrders.forEach((order, index) => {
      result.require(order === index, `migration wave order is missing: ${index}`);
    });
    for (const boundary of policy.boundaries) {
      result.require(
        coveredBoundaries.has(boundary.id),
        `migration waves do not cover boundary: ${boundary.id}`,
      );
    }
  }
}

class ModuleConventionPolicyValidator {
  validate(policy, result) {
    const conventions = policy.definition.moduleConventions || {};
    result.require(
      conventions.exports?.preferredMode === "named",
      "named exports must be the preferred export mode",
    );
    result.require(
      conventions.exports?.defaultExports === "forbidden-with-exception",
      "default exports must require an explicit exception",
    );
    result.require(
      conventions.relativeImports?.explicitExtension === ".js",
      "relative imports must use the explicit .js extension",
    );
    result.require(
      conventions.barrelModules === "forbidden-with-exception",
      "barrel modules must require an explicit exception",
    );
    result.require(
      conventions.runtimeGlobalExports === "forbid-new",
      "new runtime global exports must be forbidden",
    );
    result.require(
      conventions.rawConfiguration?.boundary === "game-config-raw" &&
        conventions.rawConfiguration?.importPolicy === "forbidden" &&
        conventions.rawConfiguration?.domainConceptConstants === "forbidden",
      "raw configuration must forbid imports and disguised domain concepts",
    );
    for (const boundaryId of conventions.sideEffectImports
      ?.allowedBoundaries || []) {
      result.require(
        !!policy.getBoundary(boundaryId),
        `side-effect import policy references unknown boundary: ${boundaryId}`,
      );
    }
  }
}

class MigrationManifestPolicyValidator {
  validate(policy, result) {
    const manifest = policy.migrationManifest;
    const statusIds = new Set(policy.statuses.map((status) => status.id));

    result.require(
      manifest.schemaVersion === 5,
      "migration manifest schemaVersion must equal 5",
    );
    this.#validateSchemaMigration(manifest, result);
    result.require(
      manifest.sourceScope === "src/**/*.js" &&
        manifest.coveragePolicy === "filesystem-equality",
      "migration manifest coverage must follow the actual src/**/*.js filesystem",
    );
    result.require(
      !("expectedModuleCount" in manifest),
      "migration manifest policy must not contain a fixed module count",
    );
    result.require(
      manifest.entrySort === "currentPath-ascending",
      "migration manifest entries must sort by currentPath",
    );
    result.require(
      manifest.currentArea?.strategy === "source-relative-directory",
      "currentArea must be derived mechanically from the source path",
    );
    result.require(
      manifest.legacyLoadOrder?.source === "index.html" &&
        manifest.legacyLoadOrder?.firstValue === 1 &&
        manifest.legacyLoadOrder?.outsideLegacyGraph === null,
      "legacy load order must be read from index.html and support null",
    );
    this.#validateObservationContract(policy.observationContract, result);
    this.#validateClassificationContract(policy, result);

    const initial = manifest.initialArchitecture || {};
    result.require(
      statusIds.has(initial.migrationStatus),
      "initial manifest migrationStatus must exist in architecture policy",
    );
    result.require(
      Array.isArray(initial.roles) && initial.roles.length === 0,
      "initial manifest roles must be unclassified",
    );
    for (const field of ["targetBoundary", "targetPath", "migrationWave"]) {
      result.require(
        initial[field] === null,
        `initial manifest ${field} must be null`,
      );
    }
    this.#validateInitialObservation(manifest, result);

    const consistency = manifest.fieldConsistency || {};
    for (const statusField of [
      "classifiedStatusesRequireTargetBoundary",
      "classifiedStatusesRequireTargetPath",
      "classifiedStatusesRequireMigrationWave",
      "classifiedStatusesRequireRoles",
      "classifiedStatusesRequireReviewedBlockers",
    ]) {
      for (const statusId of consistency[statusField] || []) {
        result.require(
          statusIds.has(statusId),
          `${statusField} references unknown status: ${statusId}`,
        );
      }
    }
    result.require(
      statusIds.has(consistency.legacyStatus),
      "manifest field consistency requires a valid legacyStatus",
    );
    result.require(
      consistency.targetPathRequiresTargetBoundary === true &&
        consistency.migrationWaveRequiresTargetBoundary === true &&
        consistency.migrationWaveMustAllowTargetBoundary === true &&
        consistency.rolesMustBeAllowedByTargetBoundary === true,
      "targetPath, migrationWave, and roles must be compatible with targetBoundary",
    );
  }

  #validateClassificationContract(policy, result) {
    const contract = policy.classificationContract;
    const reviewedStatuses = policy.statuses
      .map((status) => status.id)
      .filter((status) => status !== "legacy");
    result.require(
      contract.stage === "1.6" &&
        contract.decisionMode === "reviewed-explicit" &&
        contract.architectureMutation === "reviewed-decision-only" &&
        contract.ownershipInference === "forbidden",
      "classification must be an explicit reviewed Stage 1.6 decision",
    );
    result.require(
      this.#hasExactValues(contract.decisionFields, [
        "targetBoundary",
        "targetPath",
        "roles",
        "migrationWave",
        "blockers",
      ]),
      "classification decision fields are incomplete",
    );
    result.require(
      this.#hasExactValues(contract.forbiddenOwnershipHeuristics, [
        "current-path",
        "filename",
        "class-name",
        "class-suffix",
      ]),
      "classification must forbid path, filename, and class-name ownership guesses",
    );
    result.require(
      this.#hasExactValues(contract.requiredEvidence, [
        "source-responsibility-review",
        "observed.providers",
        "observed.consumers",
        "observed.environment",
        "analysis.dependencies",
        "derived.reverseConsumers",
      ]) && contract.evidenceLifecycle === "in-memory-read-only",
      "classification evidence must combine source review and read-only observed graph facts",
    );
    result.require(
      this.#hasExactValues(contract.evidenceEntryFields, [
        "currentPath",
        "decision",
        "observations",
        "dependencies",
        "metrics",
      ]) && this.#hasExactValues(contract.decisionEntryFields, [
        "migrationStatus",
        "targetBoundary",
        "targetPath",
        "roles",
        "migrationWave",
        "blockers",
      ]),
      "classification evidence and decision record fields are incomplete",
    );
    result.require(
      this.#hasExactValues(contract.metricFields, [
        "providerCount",
        "consumerCount",
        "confirmedCount",
        "outgoingEdgeCount",
        "incomingEdgeCount",
        "unresolvedCount",
        "ambiguousCount",
        "builtinCount",
        "browserApiCount",
        "dynamicConstructCount",
        "observationIssueCount",
        "dependencyIssueCount",
      ]),
      "classification evidence metrics are incomplete",
    );
    result.require(
      this.#hasExactValues(contract.reviewedStatuses, reviewedStatuses),
      "classification reviewedStatuses must contain every non-legacy status",
    );
    const expectedRoleCompatibility = {
      engine: ["engine-contract", "engine-runtime", "engine-utility"],
      "game-config-raw": ["raw-config"],
      "game-config": ["config-factory"],
      "game-domain": [
        "compatibility-bridge",
        "domain-behavior",
        "domain-contract",
        "value-object",
      ],
      "game-application-ports": ["application-port"],
      "game-application": ["application-service"],
      "game-presentation": ["presentation"],
      platform: ["platform-adapter"],
      dev: ["dev-tool"],
      "bootstrap-production": ["bootstrap"],
      "bootstrap-development": ["bootstrap"],
      "entrypoint-game": ["entrypoint"],
      "entrypoint-dev": ["entrypoint"],
    };
    result.require(
      this.#hasExactValues(
        Object.keys(contract.roleCompatibility || {}),
        policy.boundaries.map((boundary) => boundary.id),
      ),
      "classification role compatibility must cover every target boundary",
    );
    for (const [boundaryId, expectedRoles] of Object.entries(
      expectedRoleCompatibility,
    )) {
      result.require(
        this.#hasExactValues(
          contract.roleCompatibility?.[boundaryId],
          expectedRoles,
        ),
        `${boundaryId} has invalid compatible module roles`,
      );
    }
    const consistency = policy.migrationManifest.fieldConsistency || {};
    for (const field of [
      "classifiedStatusesRequireTargetBoundary",
      "classifiedStatusesRequireTargetPath",
      "classifiedStatusesRequireMigrationWave",
      "classifiedStatusesRequireRoles",
      "classifiedStatusesRequireReviewedBlockers",
    ]) {
      result.require(
        this.#hasExactValues(consistency[field], reviewedStatuses),
        `${field} must contain every reviewed classification status`,
      );
    }
    result.require(
      contract.targetPathSelection === "reviewed-explicit" &&
        contract.roleSelection === "reviewed-explicit" &&
        contract.blockerSelection === "reviewed-explicit",
      "target path, role, and blocker selection must remain reviewed and explicit",
    );
    result.require(
      contract.mixedResponsibility?.targetBoundary ===
        "single-reviewed-owner" &&
        contract.mixedResponsibility?.blocker ===
          "mixed-responsibility-requires-decomposition" &&
        contract.blockerCatalog?.includes(
          "mixed-responsibility-requires-decomposition",
        ),
      "mixed-responsibility modules require a single owner and decomposition blocker",
    );
    const blockerCatalog = contract.blockerCatalog || [];
    const sortedBlockers = [...new Set(blockerCatalog)].sort();
    result.require(
      blockerCatalog.length > 0 &&
        blockerCatalog.every((blocker, index) =>
          blocker === sortedBlockers[index]
        ) &&
        [
          "browser-api-coupling",
          "dev-production-coupling",
          "high-level-self-composition",
          "legacy-global-contract",
          "mixed-responsibility-requires-decomposition",
          "unresolved-project-symbol",
        ].every((blocker) => blockerCatalog.includes(blocker)),
      "classification blocker catalog must be sorted, unique, and cover known Stage 1.6 debt",
    );
    const candidate = contract.candidateSelection || {};
    result.require(
      candidate.classificationEffect === "none" &&
        candidate.requiredMigrationStatus === "legacy" &&
        candidate.requiredObservationStatus === "verified" &&
        candidate.leafDefinition ===
          "zero-confirmed-inter-file-outgoing-edges" &&
        candidate.providerRequirement === "at-least-one" &&
        candidate.uncertaintyPolicy ===
          "exclude-unresolved-ambiguous-dynamic-or-issued",
      "classification candidates must remain conservative, legacy, and decision-free",
    );
    result.require(
      candidate.ordering?.join(",") === [
        "browserApiCount-ascending",
        "incomingEdgeCount-descending",
        "providerCount-descending",
        "currentPath-ascending",
      ].join(",") && this.#hasExactValues(candidate.resultFields, [
        "currentPath",
        "incomingEdgeCount",
        "providerCount",
        "browserApiCount",
        "legacyLoadOrder",
        "reviewRequired",
      ]),
      "classification candidate ordering and result fields are incomplete",
    );
  }

  #validateSchemaMigration(manifest, result) {
    const migrations = manifest.schemaMigrations || [];
    const v1ToV2 = migrations.find(
      (migration) =>
        migration.fromVersion === 1 && migration.toVersion === 2,
    );
    result.require(
      !!v1ToV2,
      "migration manifest requires an explicit schema migration from v1 to v2",
    );
    result.require(
      v1ToV2?.preconditions?.dependencyStatus === "pending" &&
        v1ToV2?.preconditions?.dependencyItems === "empty",
      "v1 to v2 migration must reject dependencies without pending/empty semantics",
    );
    for (const preservedField of [
      "currentPath",
      "currentArea",
      "observed.legacyLoadOrder",
      "architecture",
      "analysis.blockers",
    ]) {
      result.require(
        v1ToV2?.preserves?.includes(preservedField),
        `v1 to v2 migration must preserve ${preservedField}`,
      );
    }
    const v2ToV3 = migrations.find(
      (migration) =>
        migration.fromVersion === 2 && migration.toVersion === 3,
    );
    result.require(
      !!v2ToV3,
      "migration manifest requires an explicit schema migration from v2 to v3",
    );
    result.require(
      v2ToV3?.preconditions?.providerStatus === "pending" &&
        v2ToV3?.preconditions?.providerItems === "empty" &&
        v2ToV3?.preconditions?.providerIssues === "empty",
      "v2 to v3 migration must reject reviewed provider observations",
    );
    for (const preservedField of [
      "currentPath",
      "currentArea",
      "observed.legacyLoadOrder",
      "observed.consumers",
      "observed.environment",
      "architecture",
      "analysis",
    ]) {
      result.require(
        v2ToV3?.preserves?.includes(preservedField),
        `v2 to v3 migration must preserve ${preservedField}`,
      );
    }
    const v3ToV4 = migrations.find(
      (migration) =>
        migration.fromVersion === 3 && migration.toVersion === 4,
    );
    result.require(
      !!v3ToV4,
      "migration manifest requires an explicit schema migration from v3 to v4",
    );
    result.require(
      v3ToV4?.preconditions?.consumerStatus === "pending" &&
        v3ToV4?.preconditions?.consumerItems === "empty" &&
        v3ToV4?.preconditions?.consumerIssues === "empty",
      "v3 to v4 migration must reject reviewed consumer observations",
    );
    for (const preservedField of [
      "currentPath",
      "currentArea",
      "observed.legacyLoadOrder",
      "observed.providers",
      "observed.environment",
      "architecture",
      "analysis",
    ]) {
      result.require(
        v3ToV4?.preserves?.includes(preservedField),
        `v3 to v4 migration must preserve ${preservedField}`,
      );
    }
    const v4ToV5 = migrations.find(
      (migration) =>
        migration.fromVersion === 4 && migration.toVersion === 5,
    );
    result.require(
      !!v4ToV5,
      "migration manifest requires an explicit schema migration from v4 to v5",
    );
    result.require(
      v4ToV5?.preconditions?.dependencyStatus === "pending" &&
        v4ToV5?.preconditions?.confirmedItems === "absent" &&
        v4ToV5?.preconditions?.dependencyItems === "empty" &&
        v4ToV5?.preconditions?.unresolvedItems === "empty" &&
        v4ToV5?.preconditions?.ambiguousItems === "empty" &&
        v4ToV5?.preconditions?.dependencyIssues === "empty",
      "v4 to v5 migration must reject previously resolved dependency data",
    );
    for (const preservedField of [
      "currentPath",
      "currentArea",
      "observed",
      "architecture",
      "analysis.blockers",
    ]) {
      result.require(
        v4ToV5?.preserves?.includes(preservedField),
        `v4 to v5 migration must preserve ${preservedField}`,
      );
    }
    result.require(
      v4ToV5?.initializes?.includes("analysis.dependencies.confirmed"),
      "v4 to v5 migration must initialize fact-level confirmed resolutions",
    );
  }

  #validateObservationContract(contract, result) {
    result.require(
      contract.principle === "facts-only" &&
        contract.scannerMode === "ast-scope-aware" &&
        contract.architectureClassification === "forbidden",
      "observation must be fact-only, AST scope-aware, and classification-free",
    );
    const statuses = new Map(
      (contract.statuses || []).map((status) => [status.id, status]),
    );
    result.require(
      statuses.size === 4 &&
        ["pending", "verified", "partial", "failed"].every((status) =>
          statuses.has(status),
        ),
      "observation statuses must be pending, verified, partial, and failed",
    );
    result.require(
      statuses.get("pending")?.results === "forbidden" &&
        statuses.get("pending")?.issues === "forbidden" &&
        statuses.get("verified")?.results === "allowed" &&
        statuses.get("verified")?.issues === "forbidden" &&
        statuses.get("partial")?.results === "allowed" &&
        statuses.get("partial")?.issues === "required" &&
        statuses.get("failed")?.results === "forbidden" &&
        statuses.get("failed")?.issues === "required",
      "observation status result/issue semantics are incomplete",
    );

    const providers = contract.providerModel || {};
    for (const mechanism of [
      "global-lexical",
      "global-var",
      "global-function",
      "window-property",
      "global-this-property",
      "implicit-global",
    ]) {
      result.require(
        providers.mechanisms?.includes(mechanism),
        `provider model requires mechanism: ${mechanism}`,
      );
    }
    result.require(
      this.#hasExactValues(providers.requiredFields, [
        "symbol",
        "mechanism",
        "availability",
      ]),
      "provider records must contain symbol, mechanism, and availability",
    );
    result.require(
      this.#hasExactValues(providers.availabilities, [
        "program-init",
        "conditional",
        "deferred",
      ]),
      "provider availability must distinguish program-init, conditional, and deferred",
    );
    result.require(
      providers.availabilityPrecedence?.join(",") ===
        "program-init,conditional,deferred" &&
        this.#hasExactValues(providers.confirmedWithoutControlFlow, [
          "program-init",
        ]),
      "provider availability precedence and confirmation semantics are incomplete",
    );

    const consumers = contract.consumerModel || {};
    result.require(
      this.#hasExactValues(consumers.requiredFields, [
        "symbol",
        "mechanism",
        "accessRequirement",
        "executionPhase",
      ]),
      "consumer records must preserve symbol, mechanism, access requirement, and execution phase",
    );
    result.require(
      this.#hasExactValues(consumers.accessRequirements, [
        "required",
        "guarded",
      ]),
      "consumer access requirements must distinguish required and guarded",
    );
    result.require(
      this.#hasExactValues(consumers.executionPhases, [
        "eager",
        "conditional",
        "deferred",
      ]) &&
        consumers.executionPhasePrecedence?.join(",") ===
          "eager,conditional,deferred",
      "consumer execution phase must distinguish eager, conditional, and deferred references",
    );
    result.require(
      consumers.classification === "project-symbol-candidate",
      "external consumers must remain project symbol candidates before resolution",
    );
    for (const mechanism of [
      "identifier",
      "window-property",
      "global-this-property",
    ]) {
      result.require(
        consumers.mechanisms?.includes(mechanism),
        `consumer model requires mechanism: ${mechanism}`,
      );
    }

    const resolution = contract.resolutionModel || {};
    result.require(
      this.#hasExactValues(resolution.kinds, [
        "confirmed",
        "unresolved",
        "ambiguous",
      ]),
      "resolution kinds must be confirmed, unresolved, and ambiguous",
    );
    result.require(
      resolution.resolutionUnit?.kind === "consumer-observation" &&
        this.#hasExactValues(
          resolution.resolutionUnit?.keyFields,
          consumers.requiredFields,
        ) &&
        resolution.resolutionUnit?.deduplication === "exact-key",
      "resolution unit must be the exact consumer observation key",
    );
    result.require(
      resolution.candidateModel?.lookupKey === "symbol" &&
        resolution.candidateModel?.identity === "currentPath" &&
        resolution.candidateModel?.sameSourceCompatibleFacts === "grouped" &&
        resolution.candidateModel?.ambiguityScope ===
          "distinct-source-files" &&
        resolution.candidateModel?.environmentParticipation === "excluded",
      "provider candidates must group compatible facts by source file and exclude environment symbols",
    );
    result.require(
      this.#hasExactValues(resolution.confirmedResolutionFields, [
        ...consumers.requiredFields,
        "target",
        "resolution",
      ]),
      "confirmed resolution records must preserve consumer provenance and target",
    );
    result.require(
      this.#hasExactValues(resolution.confirmedDependencyFields, [
        "target",
        "symbols",
        "resolution",
      ]),
      "confirmed dependency provenance must contain target, symbols, and resolution",
    );
    result.require(
      this.#hasExactValues(resolution.unresolvedSymbolFields, [
        ...consumers.requiredFields,
        "resolution",
      ]) &&
        this.#hasExactValues(resolution.ambiguousSymbolFields, [
          ...consumers.requiredFields,
          "resolution",
          "candidates",
        ]),
      "unresolved and ambiguous records must preserve resolution provenance",
    );
    result.require(
      resolution.confirmedProviderCount === 1 &&
        resolution.unresolvedProviderCount === 0 &&
        resolution.ambiguousProviderMinimum === 2,
      "provider-count resolution rules are incomplete",
    );
    result.require(
      resolution.filenameHeuristics === "forbidden" &&
        resolution.pathHeuristics === "forbidden",
      "dependency resolution must forbid filename and path heuristics",
    );
    result.require(
      resolution.reverseConsumers === "derived-only",
      "reverse consumers must remain derived-only",
    );
    const availability = resolution.availabilityCompatibility || {};
    result.require(
      this.#hasExactValues(availability.trustworthyProviderAvailabilities, [
        "program-init",
      ]) &&
        availability.providerAvailabilityWithoutControlFlow?.["program-init"] ===
          "eligible" &&
        availability.providerAvailabilityWithoutControlFlow?.conditional ===
          "ineligible" &&
        availability.providerAvailabilityWithoutControlFlow?.deferred ===
          "ineligible",
      "only program-init providers may be trustworthy without control-flow proof",
    );
    result.require(
      availability.guardedConsumerPreservesSemantics === true &&
        availability.guardedConsumerRelaxesProviderProof === false,
      "guarded consumers must preserve semantics without relaxing provider proof",
    );
    const loadOrder = resolution.legacyLoadOrder || {};
    result.require(
      loadOrder.role === "resolution-evidence-only" &&
        loadOrder.executionPhaseRules?.eager ===
          "provider-must-precede-consumer" &&
        loadOrder.executionPhaseRules?.conditional ===
          "provider-must-precede-consumer" &&
        loadOrder.executionPhaseRules?.deferred ===
          "later-provider-allowed" &&
        loadOrder.sameFileProgramInit === "eligible-self-resolution" &&
        loadOrder.missingOrderResult === "partial",
      "legacyLoadOrder resolution semantics are incomplete",
    );
    result.require(
      resolution.selfResolution?.target === "consumer-currentPath" &&
        resolution.selfResolution?.result === "confirmed" &&
        resolution.selfResolution?.dependencyEdge === "forbidden" &&
        resolution.selfResolution?.automaticPreference === "forbidden",
      "self resolution must remain local without automatic preference or graph edge",
    );
    const graph = resolution.graphModel || {};
    result.require(
      graph.lifecycle === "in-memory-only" &&
        graph.nodeIdentity === "currentPath" &&
        graph.edgeSource === "consumer-currentPath" &&
        graph.edgeTarget === "provider-currentPath" &&
        graph.edgeCreation === "confirmed-inter-file-only" &&
        graph.speculativeEdges === "forbidden" &&
        graph.selfEdges === "forbidden" &&
        this.#hasExactValues(graph.edgeAggregationKey, ["source", "target"]) &&
        graph.symbolAggregation === "sorted-unique" &&
        graph.observationMutation === "forbidden" &&
        graph.architectureClassification === "forbidden",
      "in-memory graph must contain confirmed inter-file edges only",
    );
    const transient = resolution.transientResultModel || {};
    result.require(
      transient.lifecycle === "in-memory-only" &&
        this.#hasExactValues(transient.rootFields, ["sources", "graph"]) &&
        this.#hasExactValues(transient.sourceFields, [
          "currentPath",
          "status",
          "confirmed",
          "unresolved",
          "ambiguous",
          "issues",
        ]) &&
        this.#hasExactValues(transient.sourceStatuses, [
          "verified",
          "partial",
          "failed",
        ]) &&
        transient.statusSemantics?.verified ===
          "complete-for-observed-consumers" &&
        transient.statusSemantics?.partial === "results-with-issues" &&
        transient.statusSemantics?.failed === "no-resolution-results" &&
        this.#hasExactValues(transient.issueFields, ["code", "message"]) &&
        this.#hasExactValues(transient.graphFields, ["nodes", "edges"]) &&
        this.#hasExactValues(transient.graphEdgeFields, [
          "source",
          "target",
          "symbols",
        ]) &&
        transient.pending === "forbidden" &&
        transient.providerCorpusIncomplete ===
          "suppress-single-provider-confirmation",
      "transient resolver results must be explicit, in-memory, and conservative",
    );
    this.#validateClassicScriptCompatibility(
      providers,
      consumers,
      resolution.classicScriptCompatibility,
      result,
    );
    const persistence = contract.persistenceModel || {};
    result.require(
      persistence.mode === "deterministic-reconcile" &&
        persistence.command === "architecture:observe" &&
        persistence.writeTiming === "after-full-validation" &&
        persistence.byteStability === "required" &&
        persistence.staleSourceResult === "error" &&
        persistence.factLevelConfirmed ===
          "analysis.dependencies.confirmed" &&
        persistence.aggregatedInterFileEdges ===
          "analysis.dependencies.items" &&
        persistence.selfResolutionPersistence ===
          "confirmed-without-edge" &&
        persistence.reverseConsumers === "forbidden" &&
        this.#hasExactValues(persistence.updatedFields, [
          "observed.providers",
          "observed.consumers",
          "observed.environment",
          "analysis.dependencies",
        ]) &&
        this.#hasExactValues(persistence.preservedFields, [
          "currentPath",
          "currentArea",
          "observed.legacyLoadOrder",
          "architecture",
          "analysis.blockers",
        ]),
      "observation persistence must be deterministic, validated, and metadata-preserving",
    );
    const integrity = contract.integrityModel || {};
    result.require(
      integrity.authoritativeDirection ===
        "source-dependencies-to-target" &&
        integrity.graphSource === "analysis.dependencies.items" &&
        integrity.reverseConsumers === "derived-only" &&
        integrity.reversePersistence === "forbidden" &&
        integrity.graphNodeIdentity === "currentPath" &&
        this.#hasExactValues(integrity.persistedEdgeFields, [
          "source",
          "target",
          "symbols",
        ]) &&
        this.#hasExactValues(integrity.reverseEntryFields, [
          "currentPath",
          "consumers",
        ]) &&
        this.#hasExactValues(integrity.reverseConsumerFields, [
          "source",
          "symbols",
        ]) &&
        this.#hasExactValues(integrity.graphInputs, [
          "confirmed-inter-file",
        ]) &&
        this.#hasExactValues(integrity.graphExcluded, [
          "unresolved",
          "ambiguous",
          "self-resolution",
        ]) &&
        integrity.consumerResolutionCardinality === "exactly-one" &&
        integrity.edgeProvenance === "fact-level-confirmed" &&
        integrity.edgeAggregation ===
          "source-target-sorted-unique-symbols" &&
        integrity.staleObservationCheck === "fresh-scan-byte-equality" &&
        integrity.deterministicOutput === "required",
      "observation graph integrity must be directional, derived, complete, and deterministic",
    );

    const strictMode = contract.strictModeModel || {};
    for (const field of [
      "programDirective",
      "functionDirective",
      "inheritedStrictness",
      "classBodyAlwaysStrict",
      "classMethodsAlwaysStrict",
      "classFieldInitializersAlwaysStrict",
      "classStaticBlocksAlwaysStrict",
    ]) {
      result.require(
        strictMode[field] === true,
        `strict mode contract requires ${field}`,
      );
    }

    const environment = contract.environmentModel || {};
    result.require(
      environment.classificationEffect === "none",
      "environment observations must not classify architecture",
    );
    result.require(
      environment.symbolClassifications?.builtins === "language-runtime" &&
        environment.symbolClassifications?.browserApis === "browser-api" &&
        environment.symbolClassifications?.externalConsumers ===
          "project-symbol-candidate",
      "environment symbols must be separated from project consumer candidates",
    );
    result.require(
      Array.isArray(environment.builtins) && environment.builtins.length > 0,
      "observation contract requires a built-in symbol catalog",
    );
    result.require(
      environment.builtins.includes("eval"),
      "language runtime catalog must classify eval before reporting its dynamic use",
    );
    result.require(
      Array.isArray(environment.browserApis) &&
        environment.browserApis.includes("window") &&
        environment.browserApis.includes("document"),
      "observation contract requires a browser API catalog",
    );
    result.require(
      environment.builtins.every(
        (symbol) => !environment.browserApis.includes(symbol),
      ),
      "language runtime and browser API catalogs must not overlap",
    );
    for (const dynamicKind of [
      "computed-window-property",
      "computed-global-this-property",
      "eval-call",
      "function-constructor",
      "string-code-execution",
      "with-statement",
    ]) {
      result.require(
        environment.dynamicConstructKinds?.includes(dynamicKind),
        `dynamic construct model requires: ${dynamicKind}`,
      );
    }
    result.require(
      environment.dynamicConstructResult === "partial",
      "dynamic constructs must force partial observation",
    );
    result.require(
      this.#hasExactValues(contract.issueFields, ["code", "message"]),
      "observation issues must contain code and message",
    );
    for (const forbiddenField of ["line", "column", "loc", "range"]) {
      result.require(
        contract.forbiddenAuthoritativeLocationFields?.includes(forbiddenField),
        `authoritative observation records must forbid ${forbiddenField}`,
      );
    }
  }

  #validateInitialObservation(manifest, result) {
    for (const field of ["providers", "consumers"]) {
      const observed = manifest.initialObserved?.[field];
      result.require(
        this.#isPendingEmpty(observed, ["items", "issues"]),
        `initial ${field} observation must be pending and empty`,
      );
    }
    result.require(
      this.#isPendingEmpty(manifest.initialObserved?.environment, [
        "builtins",
        "browserApis",
        "dynamicConstructs",
        "issues",
      ]),
      "initial environment observation must be pending and empty",
    );
    result.require(
      this.#isPendingEmpty(manifest.initialAnalysis?.dependencies, [
        "confirmed",
        "items",
        "unresolved",
        "ambiguous",
        "issues",
      ]),
      "initial dependencies analysis must be pending with no asserted edges",
    );
    result.require(
      this.#isPendingEmpty(manifest.initialAnalysis?.blockers, ["items"]),
      "initial blockers analysis must be pending with no asserted items",
    );
    result.require(
      this.#hasExactValues(manifest.blockerStatuses, ["pending", "verified"]),
      "blocker statuses must remain pending and verified",
    );
  }

  #validateClassicScriptCompatibility(
    providers,
    consumers,
    compatibility,
    result,
  ) {
    result.require(
      compatibility?.environment === "browser-classic-script" &&
        compatibility?.duplicateCompatibleProviderRecords === "forbidden",
      "classic-script compatibility must be browser-specific and derived-only",
    );
    const matrix = compatibility?.providerToConsumerMechanisms || {};
    const allConsumers = consumers.mechanisms || [];
    result.require(
      this.#hasExactValues(matrix["global-lexical"], ["identifier"]),
      "global lexical providers must resolve only identifier consumers",
    );
    for (const mechanism of providers.mechanisms || []) {
      if (mechanism === "global-lexical") continue;
      result.require(
        this.#hasExactValues(matrix[mechanism], allConsumers),
        `${mechanism} must expose classic global-object compatibility`,
      );
    }
  }

  #isPendingEmpty(value, collectionNames) {
    return value?.status === "pending" && collectionNames.every(
      (name) => Array.isArray(value[name]) && value[name].length === 0,
    );
  }

  #hasExactValues(actual, expected) {
    return Array.isArray(actual) &&
      actual.length === expected.length &&
      expected.every((value) => actual.includes(value));
  }
}

class DependencyInjectionPolicyValidator {
  validate(policy, result) {
    const dependencyInjection = policy.definition.dependencyInjection || {};
    const delivery = dependencyInjection.domainConfigurationDelivery || [];
    for (const requiredMode of [
      "constructor-injection",
      "factory",
      "composition-root",
    ]) {
      result.require(
        delivery.includes(requiredMode),
        `domain configuration delivery must allow ${requiredMode}`,
      );
    }
    result.require(
      dependencyInjection.highLevelSelfComposition === "forbidden",
      "high-level classes must not create their own composition roots",
    );
    for (const boundaryId of dependencyInjection.concreteCompositionBoundaries || []) {
      result.require(
        !!policy.getBoundary(boundaryId),
        `dependency injection policy references unknown boundary: ${boundaryId}`,
      );
    }
  }
}

class ExceptionPolicyValidator {
  #mandatoryFields = [
    "id",
    "rule",
    "currentPath",
    "reason",
    "owner",
    "removalStage",
  ];

  validate(policy, result) {
    const exceptions = policy.exceptions;
    for (const field of this.#mandatoryFields) {
      result.require(
        exceptions.requiredFields?.includes(field),
        `exception policy must require field: ${field}`,
      );
    }
    result.require(
      Array.isArray(exceptions.allowedRules) && exceptions.allowedRules.length > 0,
      "exception policy requires allowedRules",
    );
    result.require(
      Array.isArray(exceptions.allowedRemovalStages) &&
        exceptions.allowedRemovalStages.length > 0,
      "exception policy requires allowedRemovalStages",
    );

    const exceptionIds = new Set();
    for (const exception of exceptions.entries || []) {
      for (const field of this.#mandatoryFields) {
        result.require(
          typeof exception[field] === "string" && exception[field].length > 0,
          `${exception.id || "<unknown>"} exception requires ${field}`,
        );
      }
      result.require(
        exceptions.allowedRules.includes(exception.rule),
        `${exception.id} uses unknown exception rule: ${exception.rule}`,
      );
      result.require(
        exceptions.allowedRemovalStages.includes(exception.removalStage),
        `${exception.id} uses unknown removal stage: ${exception.removalStage}`,
      );
      if (exceptionIds.has(exception.id)) {
        result.add(`duplicate architecture exception id: ${exception.id}`);
      }
      exceptionIds.add(exception.id);
    }
  }
}

class ArchitecturePolicyValidationSuite {
  constructor(validators) {
    this.validators = validators;
  }

  run(policy) {
    const result = new ValidationResult();
    for (const validator of this.validators) {
      validator.validate(policy, result);
    }
    result.assertValid();
  }
}

const policy = ArchitecturePolicy.load(POLICY_PATH);
new ArchitectureGuardPolicyValidator().validate(policy.definition);
new ArchitecturePolicyValidationSuite([
  new BoundaryPolicyValidator(),
  new QualifiedDependencyPolicyValidator(),
  new EnvironmentPolicyValidator(),
  new MigrationPolicyValidator(),
  new MigrationManifestPolicyValidator(),
  new ModuleConventionPolicyValidator(),
  new DependencyInjectionPolicyValidator(),
  new ExceptionPolicyValidator(),
]).run(policy);

console.log(
  `Architecture policy passed: ${policy.boundaries.length} boundaries, ` +
    `${policy.statuses.length} statuses, ${policy.waves.length} waves, ` +
    `${policy.exceptions.entries.length} exceptions.`,
);
