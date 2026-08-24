const { CanonicalJson } = require("../guards/core/canonical_json");

class DomainAuditValidator {
  constructor(contract) {
    this.contract = contract;
  }

  validate(document, { expectedInventory = null } = {}) {
    this.#requireObject(document, "Domain audit");
    this.#requireExactFields(document, this.contract.rootFields, "Domain audit");
    this.#require(
      document.schemaVersion === this.contract.schemaVersion,
      `Domain audit schemaVersion must be ${this.contract.schemaVersion}`,
    );
    this.#require(
      document.kind === this.contract.kind,
      `Domain audit kind must be ${this.contract.kind}`,
    );
    this.#validateSource(document.source);
    this.#require(Array.isArray(document.entries), "Domain audit entries must be an array");
    this.#requireSortedUnique(
      document.entries.map((entry) => entry?.currentPath),
      "Domain audit entry paths",
    );
    for (const entry of document.entries) this.#validateEntry(entry);
    this.#validateScopeFingerprint(document);
    if (expectedInventory) this.#validateExpectedInventory(document, expectedInventory);
    return {
      entries: document.entries.length,
      pendingAnalyses: document.entries.reduce(
        (total, entry) => total + [
          entry.dependencyAudit,
          entry.stateOwnership,
          entry.configurationInput,
          entry.performanceRisk,
        ].filter((analysis) => analysis.status === "pending").length,
        0,
      ),
    };
  }

  #validateSource(source) {
    this.#requireObject(source, "Domain audit source");
    this.#requireExactFields(source, this.contract.sourceFields, "Domain audit source");
    this.#require(
      /^\d+\.\d+\.\d+$/u.test(source.releaseVersion),
      "Domain audit source requires a semantic releaseVersion",
    );
    this.#require(
      source.manifestPath === this.contract.manifestPath,
      `Domain audit manifestPath must be ${this.contract.manifestPath}`,
    );
    this.#require(
      Number.isInteger(source.manifestSchemaVersion) &&
        source.manifestSchemaVersion > 0,
      "Domain audit requires a positive manifestSchemaVersion",
    );
    this.#requireExactFields(source.scope, ["field", "operator", "value"], "Domain audit scope");
    this.#require(
      this.#equal(source.scope, this.contract.scopeRule),
      "Domain audit scope must select exact game-domain Manifest entries",
    );
    this.#requireFingerprint(
      source.manifestScopeFingerprint,
      "Domain audit manifestScopeFingerprint",
    );
  }

  #validateEntry(entry) {
    const label = entry?.currentPath || "Domain audit entry";
    this.#requireObject(entry, label);
    this.#requireExactFields(entry, this.contract.entryFields, label);
    this.#requireModulePath(entry.currentPath, `${label} currentPath`);
    this.#requireModulePath(entry.targetPath, `${label} targetPath`);
    this.#requireSortedUnique(entry.roles, `${label} roles`);
    this.#require(entry.roles.length > 0, `${label} requires at least one role`);
    this.#validateManifestEvidence(entry);
    this.#validateAnalysis(entry.dependencyAudit, "dependencyAudit", label);
    this.#validateAnalysis(entry.stateOwnership, "stateOwnership", label);
    this.#validateAnalysis(entry.configurationInput, "configurationInput", label);
    this.#validateAnalysis(entry.performanceRisk, "performanceRisk", label);
  }

  #validateManifestEvidence(entry) {
    const evidence = entry.manifestEvidence;
    const label = `${entry.currentPath} manifestEvidence`;
    this.#requireObject(evidence, label);
    this.#requireExactFields(evidence, this.contract.evidenceFields, label);
    this.#requireFingerprint(evidence.fingerprint, `${label} fingerprint`);
    this.#require(
      Number.isInteger(evidence.legacyLoadOrder) && evidence.legacyLoadOrder > 0,
      `${label} requires a positive legacyLoadOrder`,
    );
    this.#validateObservationGroup(evidence.providers, ["status", "items", "issues"], `${label} providers`);
    this.#validateObservationGroup(evidence.consumers, ["status", "items", "issues"], `${label} consumers`);
    this.#validateObservationGroup(
      evidence.environment,
      ["status", "builtins", "browserApis", "dynamicConstructs", "issues"],
      `${label} environment`,
    );
    this.#validateObservationGroup(
      evidence.dependencies,
      ["status", "confirmed", "items", "unresolved", "ambiguous", "issues"],
      `${label} dependencies`,
    );
    this.#validateObservationGroup(evidence.blockers, ["status", "items"], `${label} blockers`);
    this.#require(Array.isArray(evidence.reverseConsumers), `${label} reverseConsumers must be an array`);
    const consumerKeys = [];
    for (const consumer of evidence.reverseConsumers) {
      this.#requireExactFields(consumer, ["source", "symbols"], `${label} reverse consumer`);
      this.#requireModulePath(consumer.source, `${label} reverse consumer source`);
      this.#requireSortedUnique(consumer.symbols, `${label} reverse consumer symbols`);
      this.#require(consumer.symbols.length > 0, `${label} reverse consumer requires symbols`);
      consumerKeys.push(consumer.source);
    }
    this.#requireSortedUnique(consumerKeys, `${label} reverse consumer sources`);
    const fingerprintEvidence = this.#clone(evidence);
    delete fingerprintEvidence.fingerprint;
    const expectedFingerprint = CanonicalJson.fingerprint({
      currentPath: entry.currentPath,
      targetPath: entry.targetPath,
      roles: entry.roles,
      manifestEvidence: fingerprintEvidence,
    });
    this.#require(
      evidence.fingerprint === expectedFingerprint,
      `${label} has a stale fingerprint`,
    );
  }

  #validateObservationGroup(value, fields, label) {
    this.#requireObject(value, label);
    this.#requireExactFields(value, fields, label);
    this.#require(
      typeof value.status === "string" && value.status.length > 0,
      `${label} requires status`,
    );
    for (const field of fields.filter((field) => field !== "status")) {
      this.#require(Array.isArray(value[field]), `${label}.${field} must be an array`);
    }
  }

  #validateAnalysis(analysis, kind, entryLabel) {
    const label = `${entryLabel} ${kind}`;
    this.#requireObject(analysis, label);
    this.#requireExactFields(analysis, this.contract.analysisFields, label);
    this.#require(
      this.contract.statuses.includes(analysis.status),
      `${label} has invalid status: ${analysis.status}`,
    );
    if (analysis.status === "pending") {
      this.#require(analysis.facts === null, `${label} pending facts must be null`);
      return;
    }
    this.#requireObject(analysis.facts, `${label} facts`);
    if (kind === "dependencyAudit") this.#validateDependencyFacts(analysis, label, entryLabel);
    if (kind === "stateOwnership") this.#validateStateFacts(analysis, label);
    if (kind === "configurationInput") this.#validateConfigurationFacts(analysis, label);
    if (kind === "performanceRisk") this.#validatePerformanceFacts(analysis, label);
    const evidence = analysis.facts.evidence;
    const issues = analysis.facts.issues;
    if (analysis.status === "verified") {
      this.#require(evidence.length > 0, `${label} verified facts require evidence`);
    }
    if (analysis.status === "partial") {
      this.#require(evidence.length > 0, `${label} partial facts require evidence`);
      this.#require(issues.length > 0, `${label} partial facts require issues`);
    }
    if (analysis.status === "failed") {
      this.#require(issues.length > 0, `${label} failed facts require issues`);
    }
  }

  #validateDependencyFacts(analysis, label, currentPath) {
    const facts = analysis.facts;
    this.#requireExactFields(
      facts,
      this.contract.dependencyAuditFactFields,
      `${label} facts`,
    );
    this.#requireFingerprint(facts.graphFingerprint, `${label}.graphFingerprint`);
    this.#validateDependencyRecords(
      facts.internalDependencies,
      this.contract.internalDependencyFields,
      `${label}.internalDependencies`,
      false,
    );
    this.#validateDependencyRecords(
      facts.externalDependencies,
      this.contract.externalDependencyFields,
      `${label}.externalDependencies`,
      true,
    );
    this.#validateDependencyReverseConsumers(
      facts.reverseConsumers,
      `${label}.reverseConsumers`,
    );
    this.#validateScc(facts.scc, currentPath, `${label}.scc`);
    this.#require(
      Number.isInteger(facts.dependencyDepth) && facts.dependencyDepth >= 0,
      `${label}.dependencyDepth must be a non-negative integer`,
    );
    this.#validateCapabilities(facts.capabilities, `${label}.capabilities`);
    this.#validateAvailabilityConstraints(
      facts.availabilityConstraints,
      `${label}.availabilityConstraints`,
    );
    this.#validateTopLevelEffects(
      facts.topLevelEffects,
      `${label}.topLevelEffects`,
    );
    this.#validateAuditEvidence(facts.evidence, label);
    this.#requireSortedUnique(facts.issues, `${label}.issues`);
  }

  #validateDependencyRecords(records, fields, label, external) {
    this.#require(Array.isArray(records), `${label} must be an array`);
    const keys = [];
    for (const record of records) {
      this.#requireExactFields(record, fields, `${label} record`);
      this.#requireModulePath(record.target, `${label} target`);
      this.#requireSortedUnique(record.symbols, `${label} symbols`);
      this.#require(record.symbols.length > 0, `${label} requires symbols`);
      this.#requireSortedUnique(record.executionPhases, `${label} executionPhases`);
      this.#require(
        record.executionPhases.length > 0 &&
          record.executionPhases.every((phase) =>
            ["conditional", "deferred", "eager"].includes(phase)
          ),
        `${label} has invalid executionPhase`,
      );
      if (external) {
        this.#requireNonEmptyString(record.targetBoundary, `${label} targetBoundary`);
        this.#require(
          ["allowed", "forbidden", "unknown"].includes(record.policy),
          `${label} has invalid policy`,
        );
      }
      keys.push(record.target);
    }
    this.#requireSortedUnique(keys, `${label} targets`);
  }

  #validateDependencyReverseConsumers(records, label) {
    this.#require(Array.isArray(records), `${label} must be an array`);
    const keys = [];
    for (const record of records) {
      this.#requireExactFields(
        record,
        this.contract.dependencyReverseConsumerFields,
        `${label} record`,
      );
      this.#requireModulePath(record.source, `${label} source`);
      this.#requireNonEmptyString(record.sourceBoundary, `${label} sourceBoundary`);
      this.#requireSortedUnique(record.symbols, `${label} symbols`);
      this.#require(record.symbols.length > 0, `${label} requires symbols`);
      keys.push(record.source);
    }
    this.#requireSortedUnique(keys, `${label} sources`);
  }

  #validateScc(scc, currentPath, label) {
    this.#requireExactFields(scc, this.contract.sccFields, label);
    this.#require(
      typeof scc.id === "string" && /^scc-[a-f0-9]{12}$/u.test(scc.id),
      `${label}.id must be canonical`,
    );
    this.#requireSortedUnique(scc.members, `${label}.members`);
    this.#require(
      scc.members.includes(currentPath),
      `${label}.members must include the source module`,
    );
    this.#require(Array.isArray(scc.internalEdges), `${label}.internalEdges must be an array`);
    const memberSet = new Set(scc.members);
    const edgeKeys = [];
    for (const edge of scc.internalEdges) {
      this.#requireExactFields(edge, this.contract.sccEdgeFields, `${label} edge`);
      this.#requireModulePath(edge.source, `${label} edge source`);
      this.#requireModulePath(edge.target, `${label} edge target`);
      this.#require(
        memberSet.has(edge.source) && memberSet.has(edge.target),
        `${label} internal edge must stay inside the component`,
      );
      this.#require(edge.source !== edge.target, `${label} self edges are forbidden`);
      edgeKeys.push(`${edge.source}\u0000${edge.target}`);
    }
    this.#requireSortedUnique(edgeKeys, `${label} edge keys`);
    this.#require(
      typeof scc.cyclic === "boolean" && scc.cyclic === (scc.members.length > 1),
      `${label}.cyclic must reflect component membership`,
    );
  }

  #validateCapabilities(records, label) {
    this.#require(Array.isArray(records), `${label} must be an array`);
    const keys = [];
    for (const record of records) {
      this.#requireExactFields(record, this.contract.capabilityFields, `${label} record`);
      this.#requireNonEmptyString(record.capability, `${label} capability`);
      this.#requireSortedUnique(record.identifiers, `${label} identifiers`);
      this.#require(record.identifiers.length > 0, `${label} requires identifiers`);
      this.#require(
        ["allowed", "forbidden", "unknown"].includes(record.policy),
        `${label} has invalid policy`,
      );
      keys.push(record.capability);
    }
    this.#requireSortedUnique(keys, `${label} capability keys`);
  }

  #validateAvailabilityConstraints(records, label) {
    this.#require(Array.isArray(records), `${label} must be an array`);
    const keys = [];
    for (const record of records) {
      this.#requireExactFields(
        record,
        this.contract.availabilityConstraintFields,
        `${label} record`,
      );
      this.#requireNonEmptyString(record.symbol, `${label} symbol`);
      if (record.target !== null) this.#requireModulePath(record.target, `${label} target`);
      this.#require(
        ["conditional", "deferred", "eager"].includes(record.consumerPhase),
        `${label} has invalid consumerPhase`,
      );
      this.#require(
        ["program-init", "conditional", "deferred", "missing", "ambiguous"].includes(
          record.providerAvailability,
        ),
        `${label} has invalid providerAvailability`,
      );
      this.#require(
        ["confirmed", "unresolved", "ambiguous"].includes(record.resolution),
        `${label} has invalid resolution`,
      );
      keys.push(
        `${record.symbol}\u0000${record.target || ""}\u0000` +
          `${record.consumerPhase}\u0000${record.resolution}`,
      );
    }
    this.#requireSortedUnique(keys, `${label} keys`);
  }

  #validateTopLevelEffects(records, label) {
    this.#require(Array.isArray(records), `${label} must be an array`);
    const keys = [];
    for (const record of records) {
      this.#requireExactFields(record, this.contract.topLevelEffectFields, `${label} record`);
      this.#require(
        [
          "assignment",
          "call",
          "registration",
          "instantiation",
          "mutable-initialization",
          "dynamic-code",
        ].includes(record.kind),
        `${label} has invalid effect kind`,
      );
      this.#require(
        typeof record.location === "string" && /^\d+:\d+$/u.test(record.location),
        `${label} has invalid location`,
      );
      this.#require(
        ["observable", "unknown"].includes(record.classification),
        `${label} has invalid classification`,
      );
      keys.push(`${record.location}\u0000${record.kind}`);
    }
    this.#requireSortedUnique(keys, `${label} keys`);
  }

  #validateStateFacts(analysis, label) {
    const facts = analysis.facts;
    this.#requireExactFields(facts, this.contract.stateOwnershipFactFields, `${label} facts`);
    this.#require(
      ["stateless", "authoritative-owner", "state-participant"].includes(facts.classification),
      `${label} has invalid classification`,
    );
    for (const field of [
      "authoritativeOwners",
      "reads",
      "writes",
      "derivedCaches",
      "persistenceBoundaries",
      "issues",
    ]) this.#requireSortedUnique(facts[field], `${label}.${field}`);
    this.#validateAuditEvidence(facts.evidence, label);
  }

  #validateConfigurationFacts(analysis, label) {
    const facts = analysis.facts;
    this.#requireExactFields(facts, this.contract.configurationInputFactFields, `${label} facts`);
    this.#require(Array.isArray(facts.inputs), `${label}.inputs must be an array`);
    const keys = [];
    for (const input of facts.inputs) {
      this.#requireExactFields(input, this.contract.configurationInputFields, `${label} input`);
      this.#requireNonEmptyString(input.source, `${label} input source`);
      this.#require(
        ["constructor", "factory", "composition-root", "direct-import", "global-read"].includes(input.delivery),
        `${label} input has invalid delivery`,
      );
      keys.push(`${input.source}\u0000${input.delivery}`);
    }
    this.#requireSortedUnique(keys, `${label} input keys`);
    this.#requireSortedUnique(facts.forbiddenDirectReads, `${label}.forbiddenDirectReads`);
    this.#requireSortedUnique(facts.issues, `${label}.issues`);
    this.#validateAuditEvidence(facts.evidence, label);
  }

  #validatePerformanceFacts(analysis, label) {
    const facts = analysis.facts;
    this.#requireExactFields(facts, this.contract.performanceRiskFactFields, `${label} facts`);
    this.#require(
      ["none", "indirect", "direct"].includes(facts.hotLoopParticipation),
      `${label} has invalid hotLoopParticipation`,
    );
    this.#require(
      ["none-observed", "observed", "unknown"].includes(facts.perFrameAllocations),
      `${label} has invalid perFrameAllocations`,
    );
    this.#require(
      ["not-applicable", "preserved", "requires-review"].includes(facts.deltaTimeSemantics),
      `${label} has invalid deltaTimeSemantics`,
    );
    this.#require(
      ["not-applicable", "separated", "mixed"].includes(facts.updateRenderSeparation),
      `${label} has invalid updateRenderSeparation`,
    );
    this.#requireSortedUnique(facts.browserAccess, `${label}.browserAccess`);
    this.#requireSortedUnique(facts.issues, `${label}.issues`);
    this.#validateAuditEvidence(facts.evidence, label);
  }

  #validateAuditEvidence(evidence, label) {
    this.#require(Array.isArray(evidence), `${label}.evidence must be an array`);
    const keys = [];
    for (const item of evidence) {
      this.#requireExactFields(item, this.contract.auditEvidenceFields, `${label} evidence item`);
      this.#requireModulePath(item.sourcePath, `${label} evidence sourcePath`);
      this.#requireNonEmptyString(item.observation, `${label} evidence observation`);
      keys.push(`${item.sourcePath}\u0000${item.observation}`);
    }
    this.#requireSortedUnique(keys, `${label} evidence keys`);
  }

  #validateScopeFingerprint(document) {
    const value = document.entries.map((entry) => ({
      currentPath: entry.currentPath,
      targetPath: entry.targetPath,
      roles: entry.roles,
      manifestEvidence: entry.manifestEvidence,
    }));
    this.#require(
      document.source.manifestScopeFingerprint === CanonicalJson.fingerprint(value),
      "Domain audit has a stale manifestScopeFingerprint",
    );
  }

  #validateExpectedInventory(document, expected) {
    const actualSourceContract = {
      releaseVersion: document.source.releaseVersion,
      manifestPath: document.source.manifestPath,
      manifestSchemaVersion: document.source.manifestSchemaVersion,
      scope: document.source.scope,
    };
    const expectedSourceContract = {
      releaseVersion: expected.source.releaseVersion,
      manifestPath: expected.source.manifestPath,
      manifestSchemaVersion: expected.source.manifestSchemaVersion,
      scope: expected.source.scope,
    };
    this.#require(
      this.#equal(actualSourceContract, expectedSourceContract),
      "Domain audit source differs from current Manifest inventory",
    );
    const actualEntries = new Map(document.entries.map((entry) => [entry.currentPath, entry]));
    const expectedEntries = new Map(expected.entries.map((entry) => [entry.currentPath, entry]));
    this.#require(
      actualEntries.size === expectedEntries.size &&
        [...actualEntries.keys()].every((currentPath) => expectedEntries.has(currentPath)),
      "Domain audit entries must equal the actual game-domain Manifest scope",
    );
    for (const [currentPath, expectedEntry] of expectedEntries) {
      const actual = actualEntries.get(currentPath);
      const actualFacts = {
        currentPath: actual.currentPath,
        targetPath: actual.targetPath,
        roles: actual.roles,
        manifestEvidence: actual.manifestEvidence,
      };
      const expectedFacts = {
        currentPath: expectedEntry.currentPath,
        targetPath: expectedEntry.targetPath,
        roles: expectedEntry.roles,
        manifestEvidence: expectedEntry.manifestEvidence,
      };
      this.#require(
        this.#equal(actualFacts, expectedFacts),
        `${currentPath} audit evidence differs from current Manifest facts`,
      );
    }
  }

  #requireModulePath(value, label) {
    this.#requireNonEmptyString(value, label);
    this.#require(
      value.startsWith("src/") && value.endsWith(".js") &&
        !value.includes("\\") && !value.includes("*") &&
        !value.split("/").includes("..") && !value.split("/").includes("."),
      `${label} must be a canonical project JavaScript path`,
    );
  }

  #requireFingerprint(value, label) {
    this.#require(
      typeof value === "string" && /^[a-f0-9]{64}$/u.test(value),
      `${label} must be a SHA-256 fingerprint`,
    );
  }

  #requireSortedUnique(values, label) {
    this.#require(Array.isArray(values), `${label} must be an array`);
    this.#require(
      values.every((value) => typeof value === "string" && value.length > 0),
      `${label} must contain non-empty strings`,
    );
    const sorted = [...new Set(values)].sort(this.#compareText);
    this.#require(
      sorted.length === values.length &&
        values.every((value, index) => value === sorted[index]),
      `${label} must be sorted and unique`,
    );
  }

  #requireExactFields(value, fields, label) {
    this.#requireObject(value, label);
    const actual = Object.keys(value).sort(this.#compareText);
    const expected = [...fields].sort(this.#compareText);
    this.#require(
      this.#equal(actual, expected),
      `${label} fields must equal: ${expected.join(", ")}`,
    );
  }

  #requireObject(value, label) {
    this.#require(
      value !== null && typeof value === "object" && !Array.isArray(value),
      `${label} must be an object`,
    );
  }

  #requireNonEmptyString(value, label) {
    this.#require(
      typeof value === "string" && value.trim().length > 0,
      `${label} must be a non-empty string`,
    );
  }

  #require(condition, message) {
    if (!condition) throw new Error(message);
  }

  #equal(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  #compareText(left, right) {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }
}

module.exports = { DomainAuditValidator };
