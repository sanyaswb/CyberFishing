const estraverse = require("estraverse");

class UnsupportedConsumerConstructDetector {
  detect(syntaxTree, scopeAnalysis) {
    const issues = [];
    const dynamicConstructs = [];
    estraverse.traverse(syntaxTree, {
      fallback: "iteration",
      enter: (node) => {
        if (node.type === "WithStatement") {
          this.#record(
            "with-statement",
            "A with statement prevents complete static consumer observation.",
            issues,
            dynamicConstructs,
          );
        } else if (this.#isEvalCall(node, scopeAnalysis)) {
          this.#record(
            "eval-call",
            "Eval may create or consume symbols that static observation cannot prove.",
            issues,
            dynamicConstructs,
          );
        } else if (this.#isFunctionConstructor(node, scopeAnalysis)) {
          this.#record(
            "function-constructor",
            "The Function constructor may consume symbols through dynamic code.",
            issues,
            dynamicConstructs,
          );
        } else if (this.#isStringCodeTimer(node, scopeAnalysis)) {
          this.#record(
            "string-code-execution",
            "A timer with string code prevents complete static consumer observation.",
            issues,
            dynamicConstructs,
          );
        }
      },
    });
    return { candidates: [], issues, dynamicConstructs };
  }

  #isEvalCall(node, scopeAnalysis) {
    return node.type === "CallExpression" &&
      this.#isGlobalNamedCallee(node.callee, "eval", scopeAnalysis);
  }

  #isFunctionConstructor(node, scopeAnalysis) {
    return (node.type === "CallExpression" || node.type === "NewExpression") &&
      this.#isGlobalNamedCallee(node.callee, "Function", scopeAnalysis);
  }

  #isStringCodeTimer(node, scopeAnalysis) {
    if (node.type !== "CallExpression") return false;
    if (
      !this.#isGlobalNamedCallee(node.callee, "setTimeout", scopeAnalysis) &&
      !this.#isGlobalNamedCallee(node.callee, "setInterval", scopeAnalysis)
    ) {
      return false;
    }
    return node.arguments[0]?.type === "Literal" &&
      typeof node.arguments[0].value === "string";
  }

  #isGlobalNamedCallee(callee, name, scopeAnalysis) {
    if (callee.type === "ChainExpression") {
      return this.#isGlobalNamedCallee(callee.expression, name, scopeAnalysis);
    }
    if (callee.type === "SequenceExpression") {
      const last = callee.expressions.at(-1);
      return !!last && this.#isGlobalNamedCallee(last, name, scopeAnalysis);
    }
    if (callee.type === "Identifier") {
      return scopeAnalysis.isUnshadowedGlobalReference(callee, name);
    }
    if (callee.type !== "MemberExpression") return false;
    const object = callee.object;
    const isGlobalObject =
      scopeAnalysis.isUnshadowedGlobalReference(object, "window") ||
      scopeAnalysis.isUnshadowedGlobalReference(object, "globalThis");
    return isGlobalObject && this.#readStaticPropertyName(callee) === name;
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

  #record(code, message, issues, dynamicConstructs) {
    issues.push({ code, message });
    dynamicConstructs.push(code);
  }
}

module.exports = { UnsupportedConsumerConstructDetector };
