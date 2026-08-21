class ManifestValidationResult {
  #errors = [];

  add(message) {
    this.#errors.push(message);
  }

  require(condition, message) {
    if (!condition) this.add(message);
  }

  assertValid() {
    if (this.#errors.length === 0) return;
    throw new Error(
      `Migration manifest integrity failed:\n- ${this.#errors.join("\n- ")}`,
    );
  }
}

class ManifestSchemaRule {
  validate(context, result) {
    result.require(
      context.manifest?.schemaVersion ===
        context.policy.migrationManifest.schemaVersion,
      `Unsupported migration manifest schemaVersion: ${context.manifest?.schemaVersion}`,
    );
    result.require(
      Array.isArray(context.manifest?.modules),
      "Migration manifest modules must be an array",
    );
  }
}

class ManifestSourceCoverageRule {
  validate(context, result) {
    const modules = context.manifest?.modules;
    if (!Array.isArray(modules)) return;
    const actualPaths = new Set(
      context.sourceFiles.map((sourceFile) => sourceFile.currentPath),
    );
    const entryCounts = new Map();
    const normalizedPaths = new Map();

    for (const entry of modules) {
      const currentPath = entry?.currentPath;
      entryCounts.set(currentPath, (entryCounts.get(currentPath) || 0) + 1);
      if (typeof currentPath !== "string") continue;
      const normalized = currentPath.replaceAll("\\", "/");
      const previous = normalizedPaths.get(normalized);
      if (previous && previous !== currentPath) {
        result.add(
          `Duplicate normalized manifest paths: ${previous} and ${currentPath}`,
        );
      } else {
        normalizedPaths.set(normalized, currentPath);
      }
    }

    for (const [currentPath, count] of entryCounts) {
      if (count > 1) {
        result.add(`Duplicate migration manifest entry: ${currentPath}`);
      }
    }
    for (const actualPath of actualPaths) {
      if (!entryCounts.has(actualPath)) {
        result.add(`Untracked source module: ${actualPath}`);
      }
    }
    for (const currentPath of entryCounts.keys()) {
      if (typeof currentPath === "string" && !actualPaths.has(currentPath)) {
        result.add(`Stale migration manifest entry: ${currentPath}`);
      }
    }
  }
}

class ManifestEntryShapeRule {
  validate(context, result) {
    const modules = context.manifest?.modules;
    if (!Array.isArray(modules)) return;
    for (const [index, entry] of modules.entries()) {
      const label = entry?.currentPath || `modules[${index}]`;
      result.require(
        context.canonicalPath.isSourcePath(entry?.currentPath),
        `Non-canonical currentPath: ${label}`,
      );
      result.require(
        typeof entry?.currentArea === "string" && entry.currentArea.length > 0,
        `${label} requires currentArea`,
      );
      if (context.canonicalPath.isSourcePath(entry?.currentPath)) {
        const expectedArea = context.currentAreaResolver.resolve(
          entry.currentPath,
        );
        result.require(
          entry.currentArea === expectedArea,
          `${label} currentArea must be ${expectedArea}, received ${entry.currentArea}`,
        );
      }
      result.require(
        !!entry?.observed && typeof entry.observed === "object",
        `${label} requires observed facts`,
      );
      const legacyLoadOrder = entry?.observed?.legacyLoadOrder;
      result.require(
        legacyLoadOrder === null ||
          (Number.isInteger(legacyLoadOrder) && legacyLoadOrder > 0),
        `${label} legacyLoadOrder must be a positive integer or null`,
      );
      result.require(
        !!entry?.architecture && typeof entry.architecture === "object",
        `${label} requires architecture metadata`,
      );
      result.require(
        !!entry?.analysis && typeof entry.analysis === "object",
        `${label} requires analysis metadata`,
      );
    }
  }
}

class ManifestPolicyReferenceRule {
  validate(context, result) {
    const modules = context.manifest?.modules;
    if (!Array.isArray(modules)) return;
    const statusIds = new Set(
      context.policy.statuses.map((status) => status.id),
    );
    const roleIds = new Set(context.policy.moduleRoles.map((role) => role.id));
    const waveOrders = new Set(context.policy.waves.map((wave) => wave.order));

    for (const entry of modules) {
      const label = entry.currentPath || "<unknown>";
      const architecture = entry.architecture || {};
      result.require(
        statusIds.has(architecture.migrationStatus),
        `${label} has invalid migrationStatus: ${architecture.migrationStatus}`,
      );
      result.require(
        Array.isArray(architecture.roles),
        `${label} architecture.roles must be an array`,
      );
      const roles = Array.isArray(architecture.roles)
        ? architecture.roles
        : [];
      const seenRoles = new Set();
      for (const roleId of roles) {
        result.require(
          roleIds.has(roleId),
          `${label} has invalid module role: ${roleId}`,
        );
        result.require(
          !seenRoles.has(roleId),
          `${label} has duplicate module role: ${roleId}`,
        );
        seenRoles.add(roleId);
      }
      const sortedRoles = [...roles].sort((left, right) => {
        if (left < right) return -1;
        if (left > right) return 1;
        return 0;
      });
      result.require(
        roles.every((roleId, index) => roleId === sortedRoles[index]),
        `${label} architecture.roles must be sorted`,
      );

      const boundaryId = architecture.targetBoundary;
      result.require(
        boundaryId === null || !!context.policy.getBoundary(boundaryId),
        `${label} has invalid targetBoundary: ${boundaryId}`,
      );
      const migrationWave = architecture.migrationWave;
      result.require(
        migrationWave === null || waveOrders.has(migrationWave),
        `${label} has invalid migrationWave: ${migrationWave}`,
      );
    }
  }
}

class ManifestFieldConsistencyRule {
  validate(context, result) {
    const modules = context.manifest?.modules;
    if (!Array.isArray(modules)) return;
    const rules = context.policy.migrationManifest.fieldConsistency;

    for (const entry of modules) {
      const label = entry.currentPath || "<unknown>";
      const architecture = entry.architecture || {};
      const status = architecture.migrationStatus;
      const boundary = architecture.targetBoundary;
      const targetPath = architecture.targetPath;
      const wave = architecture.migrationWave;
      const roles = Array.isArray(architecture.roles)
        ? architecture.roles
        : [];

      if (status === rules.legacyStatus) {
        result.require(
          boundary === null && targetPath === null && wave === null,
          `${label} legacy architecture must keep targetBoundary, targetPath, and migrationWave null`,
        );
        result.require(
          roles.length === 0,
          `${label} legacy architecture must keep roles unclassified`,
        );
      }
      if (rules.classifiedStatusesRequireTargetBoundary.includes(status)) {
        result.require(
          typeof boundary === "string",
          `${label} status ${status} requires targetBoundary`,
        );
      }
      if (targetPath !== null) {
        result.require(
          context.canonicalPath.isSourcePath(targetPath),
          `${label} has non-canonical targetPath: ${targetPath}`,
        );
        if (rules.targetPathRequiresTargetBoundary) {
          result.require(
            typeof boundary === "string",
            `${label} targetPath requires targetBoundary`,
          );
        }
        const resolvedBoundary = typeof targetPath === "string"
          ? context.policy.resolveBoundary(targetPath)
          : null;
        result.require(
          !!resolvedBoundary,
          `${label} targetPath does not resolve to an architecture boundary: ${targetPath}`,
        );
        result.require(
          !resolvedBoundary || resolvedBoundary.id === boundary,
          `${label} targetPath resolves to ${resolvedBoundary?.id || "no boundary"}, not ${boundary}`,
        );
      }
      if (wave !== null && rules.migrationWaveRequiresTargetBoundary) {
        result.require(
          typeof boundary === "string",
          `${label} migrationWave requires targetBoundary`,
        );
      }
      if (rules.classifiedStatusesRequireTargetPath.includes(status)) {
        result.require(
          typeof targetPath === "string",
          `${label} status ${status} requires targetPath`,
        );
      }
      if (rules.classifiedStatusesRequireMigrationWave.includes(status)) {
        result.require(
          Number.isInteger(wave),
          `${label} status ${status} requires migrationWave`,
        );
      }
      if (rules.classifiedStatusesRequireRoles.includes(status)) {
        result.require(
          roles.length > 0,
          `${label} status ${status} requires at least one reviewed role`,
        );
      }
      if (rules.classifiedStatusesRequireReviewedBlockers.includes(status)) {
        result.require(
          entry.analysis?.blockers?.status === "verified",
          `${label} status ${status} requires reviewed blockers`,
        );
      }
      if (
        rules.migrationWaveMustAllowTargetBoundary &&
        Number.isInteger(wave) &&
        typeof boundary === "string"
      ) {
        const selectedWave = context.policy.waves.find(
          (candidate) => candidate.order === wave,
        );
        result.require(
          !!selectedWave?.targetBoundaries?.includes(boundary),
          `${label} migrationWave ${wave} does not allow targetBoundary ${boundary}`,
        );
      }
      if (
        rules.rolesMustBeAllowedByTargetBoundary &&
        typeof boundary === "string"
      ) {
        const allowedRoles =
          context.policy.classificationContract.roleCompatibility?.[boundary] ||
          [];
        for (const role of roles) {
          result.require(
            allowedRoles.includes(role),
            `${label} role ${role} is not allowed by targetBoundary ${boundary}`,
          );
        }
      }
    }
  }
}

class ObservationValidationSupport {
  constructor(contract) {
    this.contract = contract;
    this.statuses = new Map(
      contract.statuses.map((status) => [status.id, status]),
    );
  }

  validateGroup({ value, label, resultFields, exactFields, result }) {
    result.require(
      !!value && typeof value === "object" && !Array.isArray(value),
      `${label} must be an object`,
    );
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }
    this.requireExactFields(value, exactFields, label, result);
    const statusPolicy = this.statuses.get(value.status);
    result.require(
      !!statusPolicy,
      `${label} has invalid status: ${value.status}`,
    );
    const collections = [];
    for (const field of [...resultFields, "issues"]) {
      result.require(
        Array.isArray(value[field]),
        `${label}.${field} must be an array`,
      );
      if (Array.isArray(value[field])) collections.push(value[field]);
    }
    if (!statusPolicy) return false;
    const resultCount = resultFields.reduce(
      (count, field) => count + (Array.isArray(value[field]) ? value[field].length : 0),
      0,
    );
    const issueCount = Array.isArray(value.issues) ? value.issues.length : 0;
    if (statusPolicy.results === "forbidden") {
      result.require(
        resultCount === 0,
        `${label} status ${value.status} must not assert results`,
      );
    }
    if (statusPolicy.issues === "forbidden") {
      result.require(
        issueCount === 0,
        `${label} status ${value.status} must not assert issues`,
      );
    }
    if (statusPolicy.issues === "required") {
      result.require(
        issueCount > 0,
        `${label} status ${value.status} requires at least one issue`,
      );
    }
    if (Array.isArray(value.issues)) {
      this.validateIssues(value.issues, `${label}.issues`, result);
    }
    return collections.length === resultFields.length + 1;
  }

  validateIssues(issues, label, result) {
    const keys = [];
    for (const issue of issues) {
      this.requireExactFields(
        issue,
        this.contract.issueFields,
        `${label} item`,
        result,
      );
      result.require(
        this.isNonEmptyString(issue?.code) &&
          this.isNonEmptyString(issue?.message),
        `${label} items require non-empty code and message`,
      );
      keys.push(`${issue?.code}\u0000${issue?.message}`);
    }
    this.requireSortedUnique(keys, label, result);
  }

  requireExactFields(value, expectedFields, label, result) {
    const actualFields = value && typeof value === "object"
      ? Object.keys(value).sort()
      : [];
    const expected = [...expectedFields].sort();
    result.require(
      actualFields.length === expected.length &&
        expected.every((field, index) => actualFields[index] === field),
      `${label} fields must be exactly: ${expectedFields.join(", ")}`,
    );
  }

  requireSortedUnique(keys, label, result) {
    const sorted = [...keys].sort((left, right) => {
      if (left < right) return -1;
      if (left > right) return 1;
      return 0;
    });
    result.require(
      new Set(keys).size === keys.length,
      `${label} must not contain duplicates`,
    );
    result.require(
      keys.every((key, index) => key === sorted[index]),
      `${label} must use deterministic ascending order`,
    );
  }

  isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
  }
}

class ManifestSymbolObservationRule {
  validate(context, result) {
    const modules = context.manifest?.modules;
    if (!Array.isArray(modules)) return;
    const contract = context.policy.observationContract;
    const support = new ObservationValidationSupport(contract);
    for (const entry of modules) {
      const label = entry.currentPath || "<unknown>";
      this.#validateProviders(entry.observed?.providers, label, contract, support, result);
      this.#validateConsumers(entry.observed?.consumers, label, contract, support, result);
      this.#validateEnvironment(entry.observed?.environment, label, contract, support, result);
    }
  }

  #validateProviders(value, label, contract, support, result) {
    if (!support.validateGroup({
      value,
      label: `${label} observed.providers`,
      resultFields: ["items"],
      exactFields: ["status", "items", "issues"],
      result,
    })) return;
    const mechanisms = new Set(contract.providerModel.mechanisms);
    const availabilities = new Set(contract.providerModel.availabilities);
    const keys = [];
    for (const item of value.items) {
      support.requireExactFields(
        item,
        contract.providerModel.requiredFields,
        `${label} provider`,
        result,
      );
      result.require(
        support.isNonEmptyString(item?.symbol),
        `${label} provider requires a non-empty symbol`,
      );
      result.require(
        mechanisms.has(item?.mechanism),
        `${label} provider has invalid mechanism: ${item?.mechanism}`,
      );
      result.require(
        availabilities.has(item?.availability),
        `${label} provider has invalid availability: ${item?.availability}`,
      );
      keys.push(
        `${item?.symbol}\u0000${item?.mechanism}\u0000${item?.availability}`,
      );
    }
    support.requireSortedUnique(keys, `${label} providers`, result);
  }

  #validateConsumers(value, label, contract, support, result) {
    if (!support.validateGroup({
      value,
      label: `${label} observed.consumers`,
      resultFields: ["items"],
      exactFields: ["status", "items", "issues"],
      result,
    })) return;
    const model = contract.consumerModel;
    const mechanisms = new Set(model.mechanisms);
    const accessRequirements = new Set(model.accessRequirements);
    const executionPhases = new Set(model.executionPhases);
    const keys = [];
    for (const item of value.items) {
      support.requireExactFields(
        item,
        model.requiredFields,
        `${label} consumer`,
        result,
      );
      result.require(
        support.isNonEmptyString(item?.symbol),
        `${label} consumer requires a non-empty symbol`,
      );
      result.require(
        mechanisms.has(item?.mechanism),
        `${label} consumer has invalid mechanism: ${item?.mechanism}`,
      );
      result.require(
        accessRequirements.has(item?.accessRequirement),
        `${label} consumer has invalid accessRequirement: ${item?.accessRequirement}`,
      );
      result.require(
        executionPhases.has(item?.executionPhase),
        `${label} consumer has invalid executionPhase: ${item?.executionPhase}`,
      );
      keys.push(
        `${item?.symbol}\u0000${item?.mechanism}\u0000` +
          `${item?.accessRequirement}\u0000${item?.executionPhase}`,
      );
    }
    support.requireSortedUnique(keys, `${label} consumers`, result);
  }

  #validateEnvironment(value, label, contract, support, result) {
    if (!support.validateGroup({
      value,
      label: `${label} observed.environment`,
      resultFields: ["builtins", "browserApis", "dynamicConstructs"],
      exactFields: [
        "status",
        "builtins",
        "browserApis",
        "dynamicConstructs",
        "issues",
      ],
      result,
    })) return;
    const model = contract.environmentModel;
    this.#validateCatalogValues(
      value.builtins,
      new Set(model.builtins),
      `${label} builtins`,
      support,
      result,
    );
    this.#validateCatalogValues(
      value.browserApis,
      new Set(model.browserApis),
      `${label} browser APIs`,
      support,
      result,
    );
    this.#validateCatalogValues(
      value.dynamicConstructs,
      new Set(model.dynamicConstructKinds),
      `${label} dynamic constructs`,
      support,
      result,
    );
    if (value.dynamicConstructs.length > 0) {
      result.require(
        value.status === model.dynamicConstructResult,
        `${label} dynamic constructs require ${model.dynamicConstructResult} environment status`,
      );
    }
  }

  #validateCatalogValues(values, catalog, label, support, result) {
    for (const value of values) {
      result.require(
        catalog.has(value),
        `${label} contains an unknown value: ${value}`,
      );
    }
    support.requireSortedUnique(values, label, result);
  }
}

class ManifestDependencyObservationRule {
  validate(context, result) {
    const modules = context.manifest?.modules;
    if (!Array.isArray(modules)) return;
    const contract = context.policy.observationContract;
    const support = new ObservationValidationSupport(contract);
    const actualPaths = new Set(
      context.sourceFiles.map((sourceFile) => sourceFile.currentPath),
    );
    for (const entry of modules) {
      this.#validateEntry(entry, contract, support, actualPaths, result);
    }
  }

  #validateEntry(entry, contract, support, actualPaths, result) {
    const label = entry.currentPath || "<unknown>";
    const dependencies = entry.analysis?.dependencies;
    if (!support.validateGroup({
      value: dependencies,
      label: `${label} analysis.dependencies`,
      resultFields: ["confirmed", "items", "unresolved", "ambiguous"],
      exactFields: [
        "status",
        "confirmed",
        "items",
        "unresolved",
        "ambiguous",
        "issues",
      ],
      result,
    })) return;
    result.require(
      entry.consumers === undefined &&
        entry.analysis?.consumers === undefined &&
        entry.analysis?.reverseConsumers === undefined &&
        dependencies.consumers === undefined,
      `${label} reverse consumers are derived-only and must not be persisted`,
    );

    const resolution = contract.resolutionModel;
    const consumerModel = contract.consumerModel;
    const consumerKeys = new Set(
      (entry.observed?.consumers?.items || []).map((consumer) =>
        this.#consumerKey(consumer),
      ),
    );
    const resolvedConsumerKeys = new Set();
    const confirmedEdgeSymbols = this.#validateConfirmed({
      records: dependencies.confirmed,
      label,
      resolution,
      consumerModel,
      consumerKeys,
      resolvedConsumerKeys,
      actualPaths,
      support,
      result,
    });
    const persistedEdgeSymbols = new Set();
    const dependencyKeys = [];
    for (const item of dependencies.items) {
      support.requireExactFields(
        item,
        resolution.confirmedDependencyFields,
        `${label} confirmed dependency`,
        result,
      );
      result.require(
        item?.resolution === "confirmed",
        `${label} dependency edge resolution must be confirmed`,
      );
      result.require(
        contextPathIsValid(item?.target, actualPaths, contextPath =>
          contextPath !== entry.currentPath,
        ),
        `${label} has invalid confirmed dependency target: ${item?.target}`,
      );
      this.#validateSymbols(
        item?.symbols,
        `${label} dependency ${item?.target}`,
        support,
        result,
      );
      for (const symbol of Array.isArray(item?.symbols) ? item.symbols : []) {
        const edgeSymbol = this.#edgeSymbolKey(item?.target, symbol);
        persistedEdgeSymbols.add(edgeSymbol);
        result.require(
          confirmedEdgeSymbols.has(edgeSymbol),
          `${label} dependency edge lacks confirmed resolution provenance: ` +
            `${symbol} → ${item?.target}`,
        );
      }
      dependencyKeys.push(item?.target);
    }
    support.requireSortedUnique(
      dependencyKeys,
      `${label} confirmed dependencies`,
      result,
    );
    for (const edgeSymbol of confirmedEdgeSymbols) {
      result.require(
        persistedEdgeSymbols.has(edgeSymbol),
        `${label} confirmed inter-file resolution is missing a dependency edge: ` +
          edgeSymbol.replace("\u0000", " → "),
      );
    }

    this.#validateUnresolved({
      records: dependencies.unresolved,
      label,
      resolution,
      consumerModel,
      consumerKeys,
      resolvedConsumerKeys,
      support,
      result,
    });
    this.#validateAmbiguous({
      records: dependencies.ambiguous,
      label,
      resolution,
      consumerModel,
      consumerKeys,
      resolvedConsumerKeys,
      actualPaths,
      support,
      result,
    });
    if (["verified", "partial"].includes(dependencies.status)) {
      result.require(
        ["verified", "partial"].includes(entry.observed?.consumers?.status),
        `${label} dependency observation requires verified or partial consumers`,
      );
      for (const consumerKey of consumerKeys) {
        result.require(
          resolvedConsumerKeys.has(consumerKey),
          `${label} observed consumer has no resolution result: ` +
            consumerKey.replaceAll("\u0000", " / "),
        );
      }
    }
    if (dependencies.status === "failed") {
      result.require(
        entry.observed?.consumers?.status === "failed",
        `${label} failed dependency analysis requires failed consumers`,
      );
    }
  }

  #validateConfirmed(options) {
    const keys = [];
    const interFileEdgeSymbols = new Set();
    for (const record of options.records) {
      this.#validateResolutionRecord(
        record,
        options.resolution.confirmedResolutionFields,
        "confirmed",
        options,
      );
      options.result.require(
        options.actualPaths.has(record?.target),
        `${options.label} confirmed resolution has invalid target: ${record?.target}`,
      );
      if (record?.target !== options.label) {
        interFileEdgeSymbols.add(
          this.#edgeSymbolKey(record?.target, record?.symbol),
        );
      }
      keys.push(this.#consumerKey(record));
    }
    options.support.requireSortedUnique(
      keys,
      `${options.label} confirmed resolutions`,
      options.result,
    );
    return interFileEdgeSymbols;
  }

  #validateUnresolved(options) {
    const keys = [];
    for (const record of options.records) {
      this.#validateResolutionRecord(
        record,
        options.resolution.unresolvedSymbolFields,
        "unresolved",
        options,
      );
      keys.push(this.#consumerKey(record));
    }
    options.support.requireSortedUnique(
      keys,
      `${options.label} unresolved symbols`,
      options.result,
    );
  }

  #validateAmbiguous(options) {
    const keys = [];
    for (const record of options.records) {
      this.#validateResolutionRecord(
        record,
        options.resolution.ambiguousSymbolFields,
        "ambiguous",
        options,
      );
      const candidates = Array.isArray(record?.candidates)
        ? record.candidates
        : [];
      options.result.require(
        candidates.length >= options.resolution.ambiguousProviderMinimum,
        `${options.label} ambiguous symbol requires at least ` +
          `${options.resolution.ambiguousProviderMinimum} candidates`,
      );
      for (const candidate of candidates) {
        options.result.require(
          options.actualPaths.has(candidate),
          `${options.label} ambiguous symbol has invalid candidate: ${candidate}`,
        );
      }
      options.support.requireSortedUnique(
        candidates,
        `${options.label} ambiguous candidates for ${record?.symbol}`,
        options.result,
      );
      keys.push(this.#consumerKey(record));
    }
    options.support.requireSortedUnique(
      keys,
      `${options.label} ambiguous symbols`,
      options.result,
    );
  }

  #validateResolutionRecord(record, fields, kind, options) {
    const {
      label,
      consumerModel,
      consumerKeys,
      resolvedConsumerKeys,
      support,
      result,
    } = options;
    support.requireExactFields(
      record,
      fields,
      `${label} ${kind} symbol`,
      result,
    );
    result.require(
      record?.resolution === kind,
      `${label} ${kind} record has invalid resolution: ${record?.resolution}`,
    );
    result.require(
      support.isNonEmptyString(record?.symbol),
      `${label} ${kind} record requires a symbol`,
    );
    result.require(
      consumerModel.mechanisms.includes(record?.mechanism) &&
        consumerModel.accessRequirements.includes(record?.accessRequirement) &&
        consumerModel.executionPhases.includes(record?.executionPhase),
      `${label} ${kind} record must preserve consumer provenance`,
    );
    const consumerKey = this.#consumerKey(record);
    result.require(
      consumerKeys.has(consumerKey),
      `${label} ${kind} symbol is not an observed consumer: ${record?.symbol}`,
    );
    this.#registerConsumerResolution(
      consumerKey,
      record?.symbol,
      resolvedConsumerKeys,
      label,
      result,
    );
  }

  #validateSymbols(symbols, label, support, result) {
    result.require(
      Array.isArray(symbols) && symbols.length > 0,
      `${label} requires at least one symbol`,
    );
    if (!Array.isArray(symbols)) return;
    for (const symbol of symbols) {
      result.require(
        support.isNonEmptyString(symbol),
        `${label} contains an invalid symbol`,
      );
    }
    support.requireSortedUnique(symbols, `${label} symbols`, result);
  }

  #registerConsumerResolution(
    consumerKey,
    symbol,
    resolvedConsumerKeys,
    label,
    result,
  ) {
    result.require(
      !resolvedConsumerKeys.has(consumerKey),
      `${label} consumer observation has more than one resolution result: ${symbol}`,
    );
    resolvedConsumerKeys.add(consumerKey);
  }

  #consumerKey(record) {
    return `${record?.symbol}\u0000${record?.mechanism}\u0000` +
      `${record?.accessRequirement}\u0000${record?.executionPhase}`;
  }

  #edgeSymbolKey(target, symbol) {
    return `${target}\u0000${symbol}`;
  }
}

class ManifestBlockerAnalysisRule {
  validate(context, result) {
    const modules = context.manifest?.modules;
    if (!Array.isArray(modules)) return;
    const allowedStatuses = new Set(
      context.policy.migrationManifest.blockerStatuses,
    );
    const allowedBlockers = new Set(
      context.policy.classificationContract.blockerCatalog,
    );
    for (const entry of modules) {
      const label = entry.currentPath || "<unknown>";
      const blockers = entry.analysis?.blockers;
      result.require(
        !!blockers && typeof blockers === "object" && !Array.isArray(blockers),
        `${label} requires analysis.blockers`,
      );
      if (!blockers || typeof blockers !== "object") continue;
      result.require(
        Object.keys(blockers).sort().join(",") === "items,status",
        `${label} blockers fields must be exactly: status, items`,
      );
      result.require(
        allowedStatuses.has(blockers.status),
        `${label} blockers have invalid status: ${blockers.status}`,
      );
      result.require(
        Array.isArray(blockers.items),
        `${label} blockers.items must be an array`,
      );
      if (!Array.isArray(blockers.items)) continue;
      if (blockers.status === "pending") {
        result.require(
          blockers.items.length === 0,
          `${label} pending blockers must not assert items`,
        );
      }
      for (const blocker of blockers.items) {
        result.require(
          typeof blocker === "string" && blocker.trim().length > 0,
          `${label} has an invalid blocker`,
        );
        result.require(
          allowedBlockers.has(blocker),
          `${label} has unknown blocker: ${blocker}`,
        );
      }
      const sorted = [...blockers.items].sort();
      result.require(
        blockers.items.every((item, index) => item === sorted[index]) &&
          new Set(blockers.items).size === blockers.items.length,
        `${label} blockers must be unique and sorted`,
      );
    }
  }
}

function contextPathIsValid(candidate, actualPaths, additionalRule) {
  return typeof candidate === "string" &&
    actualPaths.has(candidate) &&
    additionalRule(candidate);
}

class ManifestLegacyOrderRule {
  validate(context, result) {
    const modules = context.manifest?.modules;
    if (!Array.isArray(modules)) return;
    const actualPaths = new Set(
      context.sourceFiles.map((sourceFile) => sourceFile.currentPath),
    );
    const expectedOrder = new Map();

    for (const script of context.legacyScripts) {
      if (script.type !== "classic") continue;
      if (!actualPaths.has(script.currentPath)) {
        result.add(
          `Legacy runtime script outside migration manifest scope: ${script.source}`,
        );
        continue;
      }
      if (expectedOrder.has(script.currentPath)) {
        result.add(`Duplicate legacy runtime script: ${script.currentPath}`);
        continue;
      }
      expectedOrder.set(script.currentPath, script.legacyLoadOrder);
    }

    for (const entry of modules) {
      const expected = expectedOrder.get(entry.currentPath) ?? null;
      const actual = entry.observed?.legacyLoadOrder;
      result.require(
        actual === expected,
        `${entry.currentPath} legacyLoadOrder mismatch: expected ${expected}, received ${actual}`,
      );
    }
  }
}

class ManifestStableOrderRule {
  validate(context, result) {
    const modules = context.manifest?.modules;
    if (!Array.isArray(modules)) return;
    const currentPaths = modules.map((entry) => entry.currentPath);
    const sortedPaths = [...currentPaths].sort((left, right) => {
      if (left < right) return -1;
      if (left > right) return 1;
      return 0;
    });
    for (let index = 0; index < currentPaths.length; index += 1) {
      result.require(
        currentPaths[index] === sortedPaths[index],
        `Manifest modules must sort by currentPath; mismatch at index ${index}`,
      );
    }
  }
}

class MigrationManifestValidator {
  constructor(rules) {
    this.rules = rules;
  }

  validate(context) {
    const result = new ManifestValidationResult();
    for (const rule of this.rules) rule.validate(context, result);
    result.assertValid();
  }
}

function createMigrationManifestValidator() {
  return new MigrationManifestValidator([
    new ManifestSchemaRule(),
    new ManifestSourceCoverageRule(),
    new ManifestEntryShapeRule(),
    new ManifestPolicyReferenceRule(),
    new ManifestFieldConsistencyRule(),
    new ManifestSymbolObservationRule(),
    new ManifestDependencyObservationRule(),
    new ManifestBlockerAnalysisRule(),
    new ManifestLegacyOrderRule(),
    new ManifestStableOrderRule(),
  ]);
}

module.exports = {
  MigrationManifestValidator,
  createMigrationManifestValidator,
};
