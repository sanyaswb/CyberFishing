"use strict";

const estraverse = require("estraverse");
const { LegacySourceParser } = require("../observation/parsing/legacy_source_parser");
const { AstNodeContextIndex } = require("../observation/scope/ast_node_context_index");
const { ConsumerExecutionPhaseResolver } = require("../observation/consumers/consumer_execution_phase_resolver");
const { immutableRecord } = require("../guards/core/guard_models");

class DomainStateOwnershipObserver {
  constructor({ parser = new LegacySourceParser() } = {}) {
    this.parser = parser;
  }

  observe({ currentPath, source, environment, dependencySymbols = [] }) {
    const parsed = this.parser.parse(source);
    if (parsed.status === "failed") {
      return this.#failed(currentPath, parsed.issue);
    }
    try {
      const context = new AstNodeContextIndex(parsed.syntaxTree);
      const phase = new ConsumerExecutionPhaseResolver(context);
      const owners = new Set();
      const reads = new Set();
      const writes = new Set();
      const issues = new Set();
      const dependencySymbolSet = new Set(dependencySymbols);
      const persistenceBoundaries = new Set();
      for (const identifier of environment?.browserApis || []) {
        if (["localStorage", "sessionStorage"].includes(identifier)) {
          persistenceBoundaries.add(`browser:${identifier}`);
        }
      }
      estraverse.traverse(parsed.syntaxTree, {
        fallback: "iteration",
        enter: (node) => {
          this.#observeTopLevelBinding(
            node,
            currentPath,
            context,
            phase,
            owners,
            writes,
            issues,
          );
          this.#observeMemberState(
            node,
            currentPath,
            context,
            owners,
            reads,
            writes,
          );
          this.#observeStaticField(
            node,
            currentPath,
            context,
            owners,
            writes,
            issues,
          );
          this.#observeSelfComposition(
            node,
            currentPath,
            context,
            dependencySymbolSet,
            issues,
          );
        },
      });
      const authoritativeOwners = this.#sorted(owners);
      const readFacts = this.#sorted(reads);
      const writeFacts = this.#sorted(writes);
      return immutableRecord({
        status: issues.size > 0 ? "partial" : "verified",
        facts: {
          classification: authoritativeOwners.length > 0
            ? "authoritative-owner"
            : readFacts.length > 0 || writeFacts.length > 0
              ? "state-participant"
              : "stateless",
          authoritativeOwners,
          reads: readFacts,
          writes: writeFacts,
          derivedCaches: [],
          persistenceBoundaries: this.#sorted(persistenceBoundaries),
          evidence: [{
            sourcePath: currentPath,
            observation: "Mutable bindings, class-owned fields, member reads/writes and direct browser persistence were observed from AST facts.",
          }],
          issues: this.#sorted(issues),
        },
      });
    } catch {
      return this.#failed(currentPath, {
        code: "state-analysis-failure",
        message: "State ownership facts could not be observed safely.",
      });
    }
  }

  #observeTopLevelBinding(
    node,
    currentPath,
    context,
    phase,
    owners,
    writes,
    issues,
  ) {
    if (node.type !== "VariableDeclarator" || node.id.type !== "Identifier") return;
    if (phase.resolve(node) === "deferred") return;
    const declaration = context.get(node)?.parent;
    const mutableBinding = ["let", "var"].includes(declaration?.kind) ||
      this.#isMutableInitializer(node.init);
    if (!mutableBinding) return;
    const identity = `module:${currentPath}#${node.id.name}`;
    owners.add(identity);
    writes.add(identity);
    issues.add(`module-global-mutable-state:${identity}`);
    if (this.#isCollectionInitializer(node.init)) {
      issues.add(`collection-state-requires-cache-review:${identity}`);
    }
  }

  #observeMemberState(node, currentPath, context, owners, reads, writes) {
    if (node.type !== "MemberExpression") return;
    const identity = this.#memberIdentity(node, currentPath, context);
    if (!identity) return;
    const usage = this.#memberUsage(node, context);
    if (identity.owned) owners.add(identity.path);
    if (usage.read) reads.add(identity.path);
    if (usage.write) writes.add(identity.path);
  }

  #observeStaticField(
    node,
    currentPath,
    context,
    owners,
    writes,
    issues,
  ) {
    if (node.type !== "PropertyDefinition") return;
    const property = this.#propertyName(node.key, node.computed);
    if (!property) return;
    const owner = this.#classOwner(node, currentPath, context);
    const identity = `${owner}${node.static ? "." : "#"}${property}`;
    owners.add(identity);
    if (node.value) writes.add(identity);
    if (this.#isCollectionInitializer(node.value)) {
      issues.add(`collection-state-requires-cache-review:${identity}`);
    }
  }

  #observeSelfComposition(
    node,
    currentPath,
    context,
    dependencySymbols,
    issues,
  ) {
    if (
      node.type !== "NewExpression" ||
      node.callee?.type !== "Identifier" ||
      !dependencySymbols.has(node.callee.name)
    ) return;
    const owner = this.#classOwner(node, currentPath, context);
    issues.add(
      `self-composition:${owner}->${node.callee.name}@` +
        `${node.loc.start.line}:${node.loc.start.column + 1}`,
    );
  }

  #memberIdentity(node, currentPath, context) {
    const property = this.#propertyName(node.property, node.computed);
    if (!property) return null;
    if (node.object.type === "ThisExpression") {
      return {
        path: `${this.#classOwner(node, currentPath, context)}#${property}`,
        owned: true,
      };
    }
    if (node.object.type !== "Identifier") return null;
    const parameter = this.#enclosingParameter(node.object.name, node, context);
    if (!parameter) return null;
    return { path: `parameter:${parameter}.${property}`, owned: false };
  }

  #memberUsage(node, context) {
    const parent = context.get(node)?.parent;
    if (parent?.type === "AssignmentExpression" && parent.left === node) {
      return { read: parent.operator !== "=", write: true };
    }
    if (parent?.type === "UpdateExpression" && parent.argument === node) {
      return { read: true, write: true };
    }
    if (parent?.type === "UnaryExpression" && parent.operator === "delete") {
      return { read: false, write: true };
    }
    return { read: true, write: false };
  }

  #classOwner(node, currentPath, context) {
    for (const item of context.ancestors(node)) {
      if (!["ClassDeclaration", "ClassExpression"].includes(item.parent.type)) continue;
      return item.parent.id?.name || `module:${currentPath}<anonymous-class>`;
    }
    return `module:${currentPath}<unscoped-this>`;
  }

  #enclosingParameter(name, node, context) {
    for (const item of context.ancestors(node)) {
      const parent = item.parent;
      if (!["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"].includes(
        parent.type,
      )) continue;
      if (parent.params.some((parameter) =>
        parameter.type === "Identifier" && parameter.name === name
      )) return name;
      return null;
    }
    return null;
  }

  #propertyName(property, computed) {
    if (!computed && ["Identifier", "PrivateIdentifier"].includes(property?.type)) {
      return property.name;
    }
    if (computed && property?.type === "Literal") return String(property.value);
    return null;
  }

  #isMutableInitializer(node) {
    return ["ArrayExpression", "ObjectExpression", "NewExpression"].includes(node?.type);
  }

  #isCollectionInitializer(node) {
    return node?.type === "NewExpression" &&
      node.callee?.type === "Identifier" &&
      ["Map", "Set", "WeakMap", "WeakSet"].includes(node.callee.name);
  }

  #failed(currentPath, issue) {
    return immutableRecord({
      status: "failed",
      facts: {
        classification: "stateless",
        authoritativeOwners: [],
        reads: [],
        writes: [],
        derivedCaches: [],
        persistenceBoundaries: [],
        evidence: [],
        issues: [`${issue.code}: ${issue.message}`],
      },
    });
  }

  #sorted(values) {
    return [...values].sort(this.#compareText);
  }

  #compareText(left, right) {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }
}

module.exports = { DomainStateOwnershipObserver };
