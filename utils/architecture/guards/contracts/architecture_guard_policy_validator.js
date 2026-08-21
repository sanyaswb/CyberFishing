class ArchitectureGuardPolicyValidator {
  validate(policy) {
    const errors = [];
    const require = (condition, message) => { if (!condition) errors.push(message); };
    require(policy.schemaVersion === 2, "architecture policy schemaVersion must equal 2");
    const guards = policy.architectureGuards;
    require(guards?.schemaVersion === 1, "architectureGuards schemaVersion must equal 1");
    require(this.#sameSet(guards?.statuses, ["PASS", "KNOWN-DEBT", "FAIL"]), "guard statuses must be PASS/KNOWN-DEBT/FAIL");
    require(this.#sameSet(guards?.unifiedEdgeMechanisms, ["legacy-confirmed", "static-import", "dynamic-import", "side-effect-import", "re-export", "approved-bridge"]), "unified edge mechanisms are incomplete");
    require(Array.isArray(guards?.developmentOnlyRoles) && guards.developmentOnlyRoles.includes("dev-tool"), "developmentOnlyRoles requires dev-tool");
    require(guards?.ownershipValidation === "manifest-target-boundary", "ownership must use manifest targetBoundary");
    require(guards?.physicalPathValidation === "esm-and-verified-only", "physical path validation must be ESM/verified-only");
    require(guards?.cycleIdentity === "sorted-scc-members-and-internal-edges", "cycle identity must be SCC-based");
    const browser = guards?.browserCapabilities;
    require(browser && typeof browser.catalog === "object", "browser capability catalog is required");
    const seen = new Set();
    for (const [capability, identifiers] of Object.entries(browser?.catalog || {})) {
      require(Array.isArray(identifiers) && identifiers.length > 0, `${capability} requires identifiers`);
      for (const identifier of identifiers || []) { require(!seen.has(identifier), `browser identifier mapped more than once: ${identifier}`); seen.add(identifier); }
    }
    const boundaryIds = new Set(policy.targetBoundaries.map((item) => item.id));
    for (const boundary of Object.keys(browser?.allowedBoundaries || {})) require(boundaryIds.has(boundary), `unknown browser capability boundary: ${boundary}`);
    require(this.#sameSet(Object.keys(browser?.allowedBoundaries || {}), ["platform", "dev"]), "browser capabilities must be allowed only for platform/dev");
    const contracts = guards?.artifacts || {};
    for (const key of ["knownDebt", "migrationBridges", "globalProviderBaseline"]) require(typeof contracts[key] === "string" && contracts[key].startsWith("architecture/guards/"), `missing guard artifact path: ${key}`);
    for (const exception of policy.exceptions.entries || []) {
      require(!exception.currentPath.includes("*"), `${exception.id} wildcard currentPath forbidden`);
      if (exception.target) require(!exception.target.includes("*"), `${exception.id} wildcard target forbidden`);
      if (exception.subject) require(!exception.subject.includes("*"), `${exception.id} wildcard subject forbidden`);
    }
    if (errors.length) throw new Error(`Architecture guard policy invalid:\n- ${errors.join("\n- ")}`);
  }
  #sameSet(actual, expected) { return Array.isArray(actual) && actual.length === expected.length && expected.every((item) => actual.includes(item)); }
}

module.exports = { ArchitectureGuardPolicyValidator };
