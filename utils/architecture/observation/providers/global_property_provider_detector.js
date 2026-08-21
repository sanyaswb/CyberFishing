const estraverse = require("estraverse");

class GlobalPropertyProviderDetector {
  constructor({ assignmentTargetReader, availabilityResolver, contextIndex }) {
    this.assignmentTargetReader = assignmentTargetReader;
    this.availabilityResolver = availabilityResolver;
    this.contextIndex = contextIndex;
  }

  detect(syntaxTree, scopeAnalysis) {
    const providers = [];
    const issues = [];
    estraverse.traverse(syntaxTree, {
      fallback: "iteration",
      enter: (node) => {
        if (node.type === "AssignmentExpression") {
          this.#inspectAssignment(node, scopeAnalysis, providers, issues);
        } else if (node.type === "ForInStatement" || node.type === "ForOfStatement") {
          this.#inspectIterationTarget(node, scopeAnalysis, providers, issues);
        } else if (node.type === "UpdateExpression") {
          this.#inspectUpdate(node, scopeAnalysis, issues);
        }
      },
    });
    return { providers, issues };
  }

  #inspectAssignment(node, scopeAnalysis, providers, issues) {
    for (const target of this.assignmentTargetReader.read(node.left)) {
      const property = this.#readGlobalProperty(target, scopeAnalysis);
      if (!property) continue;
      if (this.contextIndex.hasAncestorType(target, "WithStatement")) continue;
      if (property.dynamic) {
        issues.push(this.#dynamicPropertyIssue(property.mechanism));
      } else if (property.symbol.trim().length === 0) {
        issues.push(this.#emptyPropertyIssue());
      } else if (node.operator !== "=") {
        issues.push(this.#nonDefinitiveWriteIssue());
      } else {
        providers.push(this.#toProvider(property, target));
      }
    }
  }

  #inspectIterationTarget(node, scopeAnalysis, providers, issues) {
    if (node.left.type === "VariableDeclaration") return;
    for (const target of this.assignmentTargetReader.read(node.left)) {
      const property = this.#readGlobalProperty(target, scopeAnalysis);
      if (!property) continue;
      if (this.contextIndex.hasAncestorType(target, "WithStatement")) continue;
      if (property.dynamic) {
        issues.push(this.#dynamicPropertyIssue(property.mechanism));
      } else if (property.symbol.trim().length === 0) {
        issues.push(this.#emptyPropertyIssue());
      } else {
        providers.push(this.#toProvider(property, target));
      }
    }
  }

  #inspectUpdate(node, scopeAnalysis, issues) {
    const property = this.#readGlobalProperty(node.argument, scopeAnalysis);
    if (!property) return;
    if (this.contextIndex.hasAncestorType(node.argument, "WithStatement")) return;
    issues.push(
      property.dynamic
        ? this.#dynamicPropertyIssue(property.mechanism)
        : this.#nonDefinitiveWriteIssue(),
    );
  }

  #readGlobalProperty(target, scopeAnalysis) {
    if (target.type !== "MemberExpression" || target.optional) return null;
    const globalObject = target.object;
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

    const symbol = this.#readStaticPropertyName(target);
    return { mechanism, symbol, dynamic: symbol === null };
  }

  #readStaticPropertyName(member) {
    if (!member.computed && member.property.type === "Identifier") {
      return member.property.name;
    }
    if (!member.computed) return null;
    if (member.property.type === "Literal") {
      const value = member.property.value;
      if (value === null || ["string", "number", "boolean", "bigint"].includes(
        typeof value,
      )) {
        return String(value);
      }
    }
    if (
      member.property.type === "TemplateLiteral" &&
      member.property.expressions.length === 0
    ) {
      return member.property.quasis[0].value.cooked;
    }
    return null;
  }

  #toProvider(property, node) {
    return {
      symbol: property.symbol,
      mechanism: property.mechanism,
      availability: this.availabilityResolver.resolve(node),
    };
  }

  #dynamicPropertyIssue(mechanism) {
    return {
      code: mechanism === "window-property"
        ? "computed-window-property"
        : "computed-global-this-property",
      message: "A dynamic global-object property name cannot be observed safely.",
    };
  }

  #nonDefinitiveWriteIssue() {
    return {
      code: "non-definitive-global-write",
      message: "A compound, logical, or update write does not prove provider creation.",
    };
  }

  #emptyPropertyIssue() {
    return {
      code: "empty-global-property",
      message: "An empty global-object property cannot be represented as a provider symbol.",
    };
  }
}

module.exports = { GlobalPropertyProviderDetector };
