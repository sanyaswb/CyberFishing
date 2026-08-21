const estraverse = require("estraverse");

class StaticGlobalPropertyCandidateDetector {
  constructor({
    contextIndex,
    memberReadClassifier,
    accessRequirementResolver,
    executionPhaseResolver,
  }) {
    this.contextIndex = contextIndex;
    this.memberReadClassifier = memberReadClassifier;
    this.accessRequirementResolver = accessRequirementResolver;
    this.executionPhaseResolver = executionPhaseResolver;
  }

  detect(syntaxTree, scopeAnalysis) {
    const candidates = [];
    const issues = [];
    const dynamicConstructs = [];
    estraverse.traverse(syntaxTree, {
      fallback: "iteration",
      enter: (node) => {
        if (node.type !== "MemberExpression") return;
        const access = this.#readGlobalAccess(node, scopeAnalysis);
        if (!access || this.#isInsideWithBody(node)) return;
        if (!this.memberReadClassifier.isRead(node)) return;
        if (access.dynamic) {
          const code = access.mechanism === "window-property"
            ? "computed-window-property"
            : "computed-global-this-property";
          dynamicConstructs.push(code);
          issues.push({
            code,
            message: "A dynamic global-object property name cannot identify a consumer symbol safely.",
          });
          return;
        }
        if (access.symbol.trim().length === 0) {
          issues.push({
            code: "empty-global-property",
            message: "An empty global-object property cannot be represented as a consumer symbol.",
          });
          return;
        }
        const candidate = { ...access, node };
        candidates.push({
          ...candidate,
          accessRequirement: this.accessRequirementResolver.resolve(
            candidate,
            scopeAnalysis,
          ),
          executionPhase: this.executionPhaseResolver.resolve(node),
        });
      },
    });
    return { candidates, issues, dynamicConstructs };
  }

  #readGlobalAccess(member, scopeAnalysis) {
    const globalObject = member.object;
    if (globalObject.type !== "Identifier") return null;
    let mechanism = null;
    if (scopeAnalysis.isUnshadowedGlobalReference(globalObject, "window")) {
      mechanism = "window-property";
    } else if (
      scopeAnalysis.isUnshadowedGlobalReference(globalObject, "globalThis")
    ) {
      mechanism = "global-this-property";
    }
    if (!mechanism) return null;
    const symbol = this.#readStaticPropertyName(member);
    return { symbol, mechanism, dynamic: symbol === null };
  }

  #readStaticPropertyName(member) {
    if (!member.computed && member.property.type === "Identifier") {
      return member.property.name;
    }
    if (member.computed && member.property.type === "Literal") {
      const value = member.property.value;
      if (value === null || ["string", "number", "boolean", "bigint"].includes(
        typeof value,
      )) {
        return String(value);
      }
    }
    if (
      member.computed &&
      member.property.type === "TemplateLiteral" &&
      member.property.expressions.length === 0
    ) {
      return member.property.quasis[0].value.cooked;
    }
    return null;
  }

  #isInsideWithBody(node) {
    return this.contextIndex.ancestors(node).some(
      ({ parent, key }) => parent.type === "WithStatement" && key === "body",
    );
  }
}

module.exports = { StaticGlobalPropertyCandidateDetector };
