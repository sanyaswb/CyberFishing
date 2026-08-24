"use strict";

class DomainCapabilityClassifier {
  constructor(browserCapabilityPolicy) {
    this.policy = browserCapabilityPolicy;
    this.identifierToCapability = this.#buildCatalog(browserCapabilityPolicy);
  }

  classify({ entry, sourceObservation }) {
    const identifiers = new Set(entry.observed.environment.browserApis);
    identifiers.delete("window");
    identifiers.delete("globalThis");
    for (const globalObject of sourceObservation.directGlobalObjects) {
      identifiers.add(globalObject);
    }
    const byCapability = new Map();
    const issues = [];
    for (const identifier of identifiers) {
      const capability = this.identifierToCapability.get(identifier) ||
        (identifier === "globalThis" ? "browser-runtime" : null);
      if (!capability) {
        issues.push({
          code: "unknown-browser-capability",
          message: `Browser identifier cannot be normalized: ${identifier}.`,
        });
        const unknown = byCapability.get("unknown") || [];
        unknown.push(identifier);
        byCapability.set("unknown", unknown);
        continue;
      }
      const values = byCapability.get(capability) || [];
      values.push(identifier);
      byCapability.set(capability, values);
    }
    const allowed = new Set(
      this.policy.allowedBoundaries[entry.architecture.targetBoundary] || [],
    );
    const capabilities = [...byCapability.entries()]
      .map(([capability, values]) => ({
        capability,
        identifiers: [...new Set(values)].sort(this.#compareText),
        policy: capability === "unknown"
          ? "unknown"
          : allowed.has(capability) ? "allowed" : "forbidden",
      }))
      .sort((left, right) => this.#compareText(left.capability, right.capability));
    return { capabilities, issues: this.#sortedIssues(issues) };
  }

  #buildCatalog(policy) {
    if (!policy?.catalog || !policy?.allowedBoundaries) {
      throw new Error("Domain capability classification requires browser policy");
    }
    const result = new Map();
    for (const [capability, identifiers] of Object.entries(policy.catalog)) {
      for (const identifier of identifiers) {
        if (result.has(identifier)) {
          throw new Error(`Duplicate browser capability identifier: ${identifier}`);
        }
        result.set(identifier, capability);
      }
    }
    return result;
  }

  #sortedIssues(issues) {
    return issues.sort((left, right) =>
      this.#compareText(
        `${left.code}\u0000${left.message}`,
        `${right.code}\u0000${right.message}`,
      )
    );
  }

  #compareText(left, right) {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }
}

module.exports = { DomainCapabilityClassifier };
