class ConsumerExecutionPhaseResolver {
  constructor(contextIndex) {
    this.contextIndex = contextIndex;
  }

  resolve(node) {
    let phase = "eager";
    for (const context of this.contextIndex.ancestors(node)) {
      if (this.#isDeferredBoundary(context)) return "deferred";
      if (this.#isConditionalBoundary(context)) phase = "conditional";
    }
    return phase;
  }

  #isDeferredBoundary({ parent, key }) {
    if (this.#isFunction(parent)) return true;
    return parent.type === "PropertyDefinition" &&
      parent.static !== true &&
      key === "value";
  }

  #isConditionalBoundary({ parent, key }) {
    if (parent.type === "IfStatement") {
      return key === "consequent" || key === "alternate";
    }
    if (parent.type === "ConditionalExpression") {
      return key === "consequent" || key === "alternate";
    }
    if (parent.type === "LogicalExpression") return key === "right";
    if (parent.type === "SwitchCase") return true;
    if (parent.type === "CatchClause") return true;
    if (parent.type === "TryStatement") {
      return key === "block" || key === "handler" || key === "finalizer";
    }
    if (parent.type === "ForStatement") {
      return key === "test" || key === "update" || key === "body";
    }
    if (parent.type === "ForInStatement" || parent.type === "ForOfStatement") {
      return key === "left" || key === "body";
    }
    if (parent.type === "WhileStatement" || parent.type === "DoWhileStatement") {
      return key === "test" || key === "body";
    }
    if (parent.type === "CallExpression" && parent.optional === true) {
      return key === "arguments";
    }
    if (parent.type === "MemberExpression" && parent.optional === true) {
      return key === "property";
    }
    return false;
  }

  #isFunction(node) {
    return node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression";
  }
}

module.exports = { ConsumerExecutionPhaseResolver };
