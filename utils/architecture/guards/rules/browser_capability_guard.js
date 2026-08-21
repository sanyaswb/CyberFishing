class BrowserCapabilityGuard {
  run(snapshot, classifier) {
    const policy = snapshot.policy.architectureGuards.browserCapabilities;
    const identifierToCapability = new Map();
    const diagnostics = [];
    for (const [capability, identifiers] of Object.entries(policy.catalog)) for (const identifier of identifiers) {
      if (identifierToCapability.has(identifier)) diagnostics.push(classifier.classify(this.#policyViolation(identifier, `Duplicate browser identifier mapping: ${identifier}`), { debtEligible: false }));
      identifierToCapability.set(identifier, capability);
    }
    const allow = policy.allowedBoundaries;
    const esmByPath = new Map(snapshot.sources.map((item) => [item.currentPath, item.esm]));
    const projectSymbols = new Set(snapshot.manifest.modules.flatMap((item) => item.observed.providers.items.map((provider) => provider.symbol)));
    for (const module of snapshot.manifest.modules) {
      const identifiers = new Set(module.observed.environment.browserApis);
      const locations = new Map();
      const esm = esmByPath.get(module.currentPath);
      if (esm?.hasEsmSyntax) {
        for (const identifier of esm.externalIdentifiers || []) if (identifierToCapability.has(identifier)) identifiers.add(identifier);
        for (const member of esm.globalMemberReads || []) if (!projectSymbols.has(member.identifier)) { identifiers.add(member.identifier); locations.set(member.identifier, member.location); }
      }
      for (const identifier of identifiers) {
      const capability = identifierToCapability.get(identifier);
      const normalizedCapability = capability || (esm?.globalMemberReads || []).some((member) => member.identifier === identifier) ? (capability || policy.unknownBrowserPropertyCapability) : null;
      if (!normalizedCapability) { diagnostics.push(classifier.classify(this.#policyViolation(identifier, `Unknown browser identifier: ${identifier}`), { debtEligible: false })); continue; }
      const boundary = module.architecture.targetBoundary;
      if (!(allow[boundary] || []).includes(normalizedCapability)) {
        const target = `environment:${normalizedCapability}`;
        diagnostics.push(classifier.classify({ rule: "browser-capability", source: module.currentPath, target, location: locations.get(identifier) || null, message: `${boundary} cannot use ${normalizedCapability} (${identifier})`, identity: { rule: "browser-capability", source: module.currentPath, target, identifier } }));
      }
    }
    }
    return diagnostics;
  }
  #policyViolation(identifier, message) { return { rule: "browser-capability-policy", source: "architecture/module_architecture.json", target: identifier, location: null, message, identity: { rule: "browser-capability-policy", identifier } }; }
}

module.exports = { BrowserCapabilityGuard };
