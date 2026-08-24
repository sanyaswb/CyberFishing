"use strict";

const estraverse = require("estraverse");
const { LegacySourceParser } = require("../observation/parsing/legacy_source_parser");
const { AstNodeContextIndex } = require("../observation/scope/ast_node_context_index");
const { immutableRecord } = require("../guards/core/guard_models");

class DomainPerformanceRiskObserver {
  constructor({ parser = new LegacySourceParser() } = {}) {
    this.parser = parser;
    this.updateNames = new Set(["simulate", "step", "tick", "update"]);
    this.renderNames = new Set(["draw", "paint", "render"]);
    this.deltaNames = new Set(["deltaSeconds", "deltaTime", "dt", "frameDeltaSeconds"]);
  }

  observe({ currentPath, source, browserIdentifiers }) {
    const parsed = this.parser.parse(source);
    if (parsed.status === "failed") return this.#failed(currentPath, parsed.issue);
    try {
      const context = new AstNodeContextIndex(parsed.syntaxTree);
      const hotFunctions = new Set();
      const updateFunctions = new Set();
      const renderFunctions = new Set();
      let preservesDeltaTime = false;
      estraverse.traverse(parsed.syntaxTree, {
        fallback: "iteration",
        enter: (node) => {
          if (!this.#isFunction(node)) return;
          const name = this.#functionName(node, context);
          if (!name) return;
          if (this.updateNames.has(name)) updateFunctions.add(node);
          if (this.renderNames.has(name)) renderFunctions.add(node);
          if (this.updateNames.has(name) || this.renderNames.has(name)) {
            hotFunctions.add(node);
            if (node.params.some((parameter) =>
              parameter.type === "Identifier" && this.deltaNames.has(parameter.name)
            )) preservesDeltaTime = true;
          }
        },
      });
      let allocations = 0;
      estraverse.traverse(parsed.syntaxTree, {
        fallback: "iteration",
        enter: (node) => {
          if (!["NewExpression", "ArrayExpression", "ObjectExpression"].includes(node.type)) {
            return;
          }
          if (this.#insideFunctions(node, hotFunctions, context)) allocations += 1;
        },
      });
      const direct = hotFunctions.size > 0;
      const browserAccess = [...new Set(browserIdentifiers)].sort(this.#compareText);
      const issues = [];
      if (direct && browserAccess.some((identifier) =>
        ["Image", "fetch"].includes(identifier)
      )) issues.push("asset-or-network-access-observed-in-hot-loop-module");
      return immutableRecord({
        status: "verified",
        facts: {
          hotLoopParticipation: direct ? "direct" : "none",
          perFrameAllocations: direct
            ? allocations > 0 ? "observed" : "none-observed"
            : "unknown",
          browserAccess,
          deltaTimeSemantics: direct
            ? preservesDeltaTime ? "preserved" : "requires-review"
            : "not-applicable",
          updateRenderSeparation: updateFunctions.size > 0 && renderFunctions.size > 0
            ? "mixed"
            : hotFunctions.size > 0 ? "separated" : "not-applicable",
          evidence: [{
            sourcePath: currentPath,
            observation: "Lifecycle methods, their parameters, nested allocations and normalized browser identifiers were observed from AST facts.",
          }],
          issues: issues.sort(this.#compareText),
        },
      });
    } catch {
      return this.#failed(currentPath, {
        code: "performance-analysis-failure",
        message: "Performance risk facts could not be observed safely.",
      });
    }
  }

  #isFunction(node) {
    return ["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"].includes(
      node.type,
    );
  }

  #functionName(node, context) {
    if (node.type === "FunctionDeclaration") return node.id?.name || null;
    const parent = context.get(node)?.parent;
    if (parent?.type === "MethodDefinition") return this.#keyName(parent.key, parent.computed);
    if (parent?.type === "Property") return this.#keyName(parent.key, parent.computed);
    if (parent?.type === "VariableDeclarator" && parent.id.type === "Identifier") {
      return parent.id.name;
    }
    return node.id?.name || null;
  }

  #insideFunctions(node, functions, context) {
    return context.ancestors(node).some((item) => functions.has(item.parent));
  }

  #keyName(key, computed) {
    if (!computed && key?.type === "Identifier") return key.name;
    if (computed && key?.type === "Literal" && typeof key.value === "string") {
      return key.value;
    }
    return null;
  }

  #failed(currentPath, issue) {
    return immutableRecord({
      status: "failed",
      facts: {
        hotLoopParticipation: "none",
        perFrameAllocations: "unknown",
        browserAccess: [],
        deltaTimeSemantics: "not-applicable",
        updateRenderSeparation: "not-applicable",
        evidence: [],
        issues: [`${issue.code}: ${issue.message}`],
      },
    });
  }

  #compareText(left, right) {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }
}

module.exports = { DomainPerformanceRiskObserver };
