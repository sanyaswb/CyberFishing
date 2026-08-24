"use strict";

const estraverse = require("estraverse");
const {
  LegacySourceParser,
} = require("../observation/parsing/legacy_source_parser");
const {
  EslintScopeAnalyzer,
} = require("../observation/scope/eslint_scope_analysis");
const {
  AstNodeContextIndex,
} = require("../observation/scope/ast_node_context_index");
const {
  ConsumerExecutionPhaseResolver,
} = require("../observation/consumers/consumer_execution_phase_resolver");
const { immutableRecord } = require("../guards/core/guard_models");

class DomainSourceEffectObserver {
  constructor({
    parser = new LegacySourceParser(),
    scopeAnalyzer = new EslintScopeAnalyzer(),
  } = {}) {
    this.parser = parser;
    this.scopeAnalyzer = scopeAnalyzer;
    this.registrationNames = new Set([
      "addEventListener",
      "on",
      "once",
      "register",
      "subscribe",
    ]);
  }

  observe({ currentPath, source, environment }) {
    const parsed = this.parser.parse(source);
    if (parsed.status === "failed") {
      return immutableRecord({
        currentPath,
        status: "failed",
        topLevelEffects: [],
        directGlobalObjects: [],
        issues: [this.#issue(parsed.issue.code, parsed.issue.message)],
      });
    }
    try {
      const contextIndex = new AstNodeContextIndex(parsed.syntaxTree);
      const phaseResolver = new ConsumerExecutionPhaseResolver(contextIndex);
      const scope = this.scopeAnalyzer.analyze(
        parsed.syntaxTree,
        parsed.sourceType,
      );
      const effects = [];
      const issues = (environment?.issues || []).map((issue) =>
        this.#issue(issue.code, issue.message)
      );
      for (const construct of environment?.dynamicConstructs || []) {
        issues.push(this.#issue(
          construct,
          "Dynamic construct prevents complete static domain observation.",
        ));
      }
      const directGlobalObjects = new Set();
      estraverse.traverse(parsed.syntaxTree, {
        fallback: "iteration",
        enter: (node) => {
          this.#observeDirectGlobalObject(
            node,
            contextIndex,
            scope,
            directGlobalObjects,
          );
          if (phaseResolver.resolve(node) === "deferred") return;
          this.#observeEffect(node, effects, issues, scope);
        },
      });
      const uniqueIssues = this.#uniqueSorted(
        issues,
        (issue) => `${issue.code}\u0000${issue.message}`,
      );
      return immutableRecord({
        currentPath,
        status: uniqueIssues.length > 0 ? "partial" : "verified",
        topLevelEffects: this.#uniqueSorted(
          effects,
          (effect) => `${effect.location}\u0000${effect.kind}`,
        ),
        directGlobalObjects: [...directGlobalObjects].sort(this.#compareText),
        issues: uniqueIssues,
      });
    } catch {
      return immutableRecord({
        currentPath,
        status: "failed",
        topLevelEffects: [],
        directGlobalObjects: [],
        issues: [this.#issue(
          "effect-analysis-failure",
          "Top-level source effects could not be observed safely.",
        )],
      });
    }
  }

  #observeDirectGlobalObject(node, contextIndex, scope, result) {
    if (
      node.type !== "Identifier" ||
      !["window", "globalThis"].includes(node.name) ||
      !scope.isUnshadowedGlobalReference(node, node.name)
    ) return;
    const context = contextIndex.get(node);
    if (context?.parent.type === "MemberExpression" && context.key === "object") {
      return;
    }
    if (
      context?.parent.type === "UnaryExpression" &&
      context.parent.operator === "typeof"
    ) return;
    result.add(node.name);
  }

  #observeEffect(node, effects, issues, scope) {
    if (node.type === "WithStatement") {
      effects.push(this.#effect("dynamic-code", node, "unknown"));
      issues.push(this.#issue(
        "with-statement",
        "A top-level with statement prevents complete static observation.",
      ));
      return;
    }
    if (node.type === "AwaitExpression") {
      effects.push(this.#effect("dynamic-code", node, "unknown"));
      issues.push(this.#issue(
        "top-level-await",
        "Top-level await requires explicit migration review.",
      ));
      return;
    }
    if (node.type === "CallExpression") {
      if (this.#isDynamicCodeCall(node, scope)) {
        effects.push(this.#effect("dynamic-code", node, "unknown"));
        issues.push(this.#issue(
          "dynamic-code-call",
          "A top-level dynamic-code call cannot be analyzed completely.",
        ));
      } else {
        const kind = this.registrationNames.has(this.#calleeName(node.callee))
          ? "registration"
          : "call";
        effects.push(this.#effect(kind, node, "observable"));
      }
      return;
    }
    if (node.type === "NewExpression") {
      if (this.#isGlobalNamedCallee(node.callee, "Function", scope)) {
        effects.push(this.#effect("dynamic-code", node, "unknown"));
        issues.push(this.#issue(
          "function-constructor",
          "A top-level Function constructor cannot be analyzed completely.",
        ));
      } else {
        effects.push(this.#effect("instantiation", node, "observable"));
      }
      return;
    }
    if (node.type === "AssignmentExpression" || node.type === "UpdateExpression") {
      effects.push(this.#effect("assignment", node, "observable"));
      if (
        node.type === "AssignmentExpression" &&
        this.#isMutableLiteral(node.right)
      ) effects.push(this.#effect("mutable-initialization", node, "observable"));
      return;
    }
    if (
      node.type === "VariableDeclarator" &&
      this.#isMutableLiteral(node.init)
    ) effects.push(this.#effect("mutable-initialization", node, "observable"));
    if (
      node.type === "PropertyDefinition" &&
      node.static === true &&
      this.#isMutableLiteral(node.value)
    ) effects.push(this.#effect("mutable-initialization", node, "observable"));
  }

  #isDynamicCodeCall(node, scope) {
    if (this.#isGlobalNamedCallee(node.callee, "eval", scope)) return true;
    if (this.#isGlobalNamedCallee(node.callee, "Function", scope)) return true;
    const name = this.#calleeName(node.callee);
    return ["setTimeout", "setInterval"].includes(name) &&
      node.arguments[0]?.type === "Literal" &&
      typeof node.arguments[0].value === "string";
  }

  #isGlobalNamedCallee(callee, name, scope) {
    if (callee?.type === "Identifier") {
      return scope.isUnshadowedGlobalReference(callee, name);
    }
    if (callee?.type !== "MemberExpression") return false;
    const property = this.#staticPropertyName(callee);
    return property === name &&
      callee.object?.type === "Identifier" &&
      ["window", "globalThis"].some((globalName) =>
        scope.isUnshadowedGlobalReference(callee.object, globalName)
      );
  }

  #calleeName(callee) {
    if (callee?.type === "Identifier") return callee.name;
    if (callee?.type === "MemberExpression") return this.#staticPropertyName(callee);
    if (callee?.type === "ChainExpression") return this.#calleeName(callee.expression);
    return null;
  }

  #staticPropertyName(member) {
    if (!member.computed && member.property?.type === "Identifier") {
      return member.property.name;
    }
    if (
      member.computed &&
      member.property?.type === "Literal" &&
      typeof member.property.value === "string"
    ) return member.property.value;
    return null;
  }

  #isMutableLiteral(node) {
    return node?.type === "ArrayExpression" || node?.type === "ObjectExpression";
  }

  #effect(kind, node, classification) {
    return { kind, location: this.#location(node), classification };
  }

  #location(node) {
    return `${node.loc.start.line}:${node.loc.start.column + 1}`;
  }

  #issue(code, message) {
    return { code, message };
  }

  #uniqueSorted(values, keyOf) {
    const unique = new Map();
    for (const value of values) unique.set(keyOf(value), value);
    return [...unique.entries()]
      .sort(([left], [right]) => this.#compareText(left, right))
      .map(([, value]) => value);
  }

  #compareText(left, right) {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }
}

module.exports = { DomainSourceEffectObserver };
