const estraverse = require("estraverse");

class UnsupportedProviderConstructDetector {
  constructor({ contextIndex }) {
    this.contextIndex = contextIndex;
  }

  detect(syntaxTree, scopeAnalysis) {
    const issues = [];
    estraverse.traverse(syntaxTree, {
      fallback: "iteration",
      enter: (node) => {
        if (node.type === "WithStatement") {
          issues.push(this.#issue(
            "with-statement",
            "A with statement prevents complete static provider observation.",
          ));
        } else if (this.#isDirectEval(node, scopeAnalysis)) {
          issues.push(this.#issue(
            "eval-call",
            "Direct eval may create providers that static observation cannot prove.",
          ));
        } else if (this.#isFunctionConstructor(node, scopeAnalysis)) {
          issues.push(this.#issue(
            "function-constructor",
            "The Function constructor may create unobservable runtime behavior.",
          ));
        } else if (this.#isGlobalObjectMutationApi(node, scopeAnalysis)) {
          issues.push(this.#issue(
            "global-object-mutation-api",
            "A global-object mutation API is outside the Stage 1.5.2 provider contract.",
          ));
        } else if (this.#isSloppyTopLevelBlockFunction(node, scopeAnalysis)) {
          issues.push(this.#issue(
            "annex-b-block-function",
            "A sloppy top-level block function has implementation-sensitive global semantics.",
          ));
        }
      },
    });
    return { providers: [], issues };
  }

  #isDirectEval(node, scopeAnalysis) {
    return node.type === "CallExpression" &&
      scopeAnalysis.isUnshadowedGlobalReference(node.callee, "eval");
  }

  #isFunctionConstructor(node, scopeAnalysis) {
    return (node.type === "CallExpression" || node.type === "NewExpression") &&
      scopeAnalysis.isUnshadowedGlobalReference(node.callee, "Function");
  }

  #isGlobalObjectMutationApi(node, scopeAnalysis) {
    if (node.type !== "CallExpression") return false;
    const callee = node.callee;
    if (callee.type !== "MemberExpression" || callee.optional) return false;
    if (!scopeAnalysis.isUnshadowedGlobalReference(callee.object, "Object")) {
      return false;
    }
    const method = this.#readStaticPropertyName(callee);
    if (!["assign", "defineProperty", "defineProperties"].includes(method)) {
      return false;
    }
    const target = node.arguments[0];
    return scopeAnalysis.isUnshadowedGlobalReference(target, "window") ||
      scopeAnalysis.isUnshadowedGlobalReference(target, "globalThis");
  }

  #isSloppyTopLevelBlockFunction(node, scopeAnalysis) {
    if (node.type !== "FunctionDeclaration") return false;
    if (scopeAnalysis.globalScope.isStrict) return false;
    const contexts = this.contextIndex.ancestors(node);
    const parent = contexts[0]?.parent;
    if (!parent || parent.type === "Program") return false;
    return !contexts.some(({ parent: ancestor }) =>
      ancestor.type === "FunctionDeclaration" ||
      ancestor.type === "FunctionExpression" ||
      ancestor.type === "ArrowFunctionExpression"
    );
  }

  #readStaticPropertyName(member) {
    if (!member.computed && member.property.type === "Identifier") {
      return member.property.name;
    }
    if (
      member.computed &&
      member.property.type === "Literal" &&
      typeof member.property.value === "string"
    ) {
      return member.property.value;
    }
    return null;
  }

  #issue(code, message) {
    return { code, message };
  }
}

module.exports = { UnsupportedProviderConstructDetector };
