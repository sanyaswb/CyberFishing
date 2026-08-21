class ConsumerAccessRequirementResolver {
  constructor(contextIndex) {
    this.contextIndex = contextIndex;
  }

  resolve(candidate, scopeAnalysis) {
    if (this.#isDirectTypeofProbe(candidate)) return "guarded";
    if (this.#isOptionalGlobalUse(candidate)) return "guarded";
    if (this.#isDirectGlobalGuardProbe(candidate)) return "guarded";

    for (const { parent, key } of this.contextIndex.ancestors(candidate.node)) {
      if (
        (parent.type === "IfStatement" ||
          parent.type === "ConditionalExpression") &&
        (key === "consequent" || key === "alternate")
      ) {
        const proof = this.#presenceProof(parent.test, candidate, scopeAnalysis);
        if (
          (key === "consequent" && proof.whenTrue) ||
          (key === "alternate" && proof.whenFalse)
        ) {
          return "guarded";
        }
      }
      if (parent.type === "LogicalExpression" && key === "right") {
        const proof = this.#presenceProof(parent.left, candidate, scopeAnalysis);
        if (
          (parent.operator === "&&" && proof.whenTrue) ||
          (parent.operator === "||" && proof.whenFalse)
        ) {
          return "guarded";
        }
      }
    }
    return "required";
  }

  #isDirectTypeofProbe(candidate) {
    let node = candidate.node;
    let context = this.contextIndex.get(node);
    if (context?.parent.type === "ChainExpression") {
      node = context.parent;
      context = this.contextIndex.get(node);
    }
    return context?.parent.type === "UnaryExpression" &&
      context.parent.operator === "typeof" &&
      context.parent.argument === node;
  }

  #isOptionalGlobalUse(candidate) {
    if (candidate.mechanism === "identifier") return false;
    let node = candidate.node;
    let context = this.contextIndex.get(node);
    if (context?.parent.type === "ChainExpression") {
      node = context.parent;
      context = this.contextIndex.get(node);
    }
    return !!context && (
      (context.parent.type === "CallExpression" &&
        context.parent.optional === true &&
        context.key === "callee") ||
      (context.parent.type === "MemberExpression" &&
        context.parent.optional === true &&
        context.key === "object")
    );
  }

  #isDirectGlobalGuardProbe(candidate) {
    if (candidate.mechanism === "identifier") return false;
    let node = candidate.node;
    let context = this.contextIndex.get(node);
    while (
      context &&
      (context.parent.type === "ChainExpression" ||
        (context.parent.type === "UnaryExpression" &&
          context.parent.operator === "!"))
    ) {
      node = context.parent;
      context = this.contextIndex.get(node);
    }
    if (!context) return false;
    if (
      (context.parent.type === "IfStatement" ||
        context.parent.type === "ConditionalExpression") &&
      context.key === "test"
    ) {
      return true;
    }
    return context.parent.type === "LogicalExpression" &&
      context.key === "left";
  }

  #presenceProof(expression, candidate, scopeAnalysis) {
    if (!expression) return this.#noProof();
    if (expression.type === "UnaryExpression" && expression.operator === "!") {
      const nested = this.#presenceProof(
        expression.argument,
        candidate,
        scopeAnalysis,
      );
      return { whenTrue: nested.whenFalse, whenFalse: nested.whenTrue };
    }
    if (expression.type === "BinaryExpression") {
      return this.#binaryPresenceProof(expression, candidate, scopeAnalysis);
    }
    if (expression.type === "LogicalExpression") {
      const left = this.#presenceProof(expression.left, candidate, scopeAnalysis);
      const right = this.#presenceProof(expression.right, candidate, scopeAnalysis);
      if (expression.operator === "&&") {
        return {
          whenTrue: left.whenTrue || right.whenTrue,
          whenFalse: false,
        };
      }
      if (expression.operator === "||") {
        return {
          whenTrue: false,
          whenFalse: left.whenFalse || right.whenFalse,
        };
      }
    }
    if (
      candidate.mechanism !== "identifier" &&
      this.#matchesAccess(expression, candidate, scopeAnalysis)
    ) {
      return { whenTrue: true, whenFalse: false };
    }
    return this.#noProof();
  }

  #binaryPresenceProof(expression, candidate, scopeAnalysis) {
    if (!["===", "==", "!==", "!="].includes(expression.operator)) {
      return this.#noProof();
    }
    const comparison = this.#readTypeofComparison(
      expression.left,
      expression.right,
      candidate,
      scopeAnalysis,
    ) || this.#readTypeofComparison(
      expression.right,
      expression.left,
      candidate,
      scopeAnalysis,
    );
    if (!comparison) return this.#noProof();

    const equality = expression.operator === "===" || expression.operator === "==";
    if (comparison.typeName === "undefined") {
      return equality
        ? { whenTrue: false, whenFalse: true }
        : { whenTrue: true, whenFalse: false };
    }
    return equality
      ? { whenTrue: true, whenFalse: false }
      : { whenTrue: false, whenFalse: true };
  }

  #readTypeofComparison(
    possibleTypeof,
    possibleLiteral,
    candidate,
    scopeAnalysis,
  ) {
    if (
      possibleTypeof.type !== "UnaryExpression" ||
      possibleTypeof.operator !== "typeof" ||
      possibleLiteral.type !== "Literal" ||
      typeof possibleLiteral.value !== "string" ||
      !this.#matchesAccess(possibleTypeof.argument, candidate, scopeAnalysis)
    ) {
      return null;
    }
    return { typeName: possibleLiteral.value };
  }

  #matchesAccess(expression, candidate, scopeAnalysis) {
    if (candidate.mechanism === "identifier") {
      return expression.type === "Identifier" &&
        expression.name === candidate.symbol &&
        scopeAnalysis.findReference(expression)?.resolved === null;
    }
    if (expression.type === "ChainExpression") expression = expression.expression;
    if (expression.type !== "MemberExpression") return false;
    const globalObject = expression.object;
    const expectedObject = candidate.mechanism === "window-property"
      ? "window"
      : "globalThis";
    if (!scopeAnalysis.isUnshadowedGlobalReference(
      globalObject,
      expectedObject,
    )) {
      return false;
    }
    return this.#readStaticPropertyName(expression) === candidate.symbol;
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

  #noProof() {
    return { whenTrue: false, whenFalse: false };
  }
}

module.exports = { ConsumerAccessRequirementResolver };
