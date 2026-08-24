"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const espree = require("espree");
const estraverse = require("estraverse");
const { immutableRecord } = require("../../architecture/guards/core/guard_models");

class ModuleEvaluationEffectObserver {
  observe({ modulePath, source }) {
    let tree;
    try {
      tree = espree.parse(source, {
        ecmaVersion: "latest",
        sourceType: "module",
        loc: true,
      });
    } catch (error) {
      throw new Error(`Cannot parse cumulative ESM module ${modulePath}: ${error.message}`);
    }
    const findings = [];
    for (const statement of tree.body) this.#statement(statement, findings);
    const unique = new Map();
    for (const finding of findings) {
      unique.set(`${finding.classification}\u0000${finding.kind}\u0000${finding.location}`, finding);
    }
    const observations = [...unique.values()].sort((left, right) =>
      `${left.classification}\u0000${left.kind}\u0000${left.location}`.localeCompare(
        `${right.classification}\u0000${right.kind}\u0000${right.location}`,
      ));
    const classification = observations.some((item) => item.classification === "unsafe")
      ? "unsafe"
      : observations.length > 0
        ? "needs-review"
        : "safe";
    const evidenceFingerprint = crypto
      .createHash("sha256")
      .update(JSON.stringify({ modulePath, observations }))
      .digest("hex");
    return immutableRecord({
      module: modulePath,
      classification,
      observations,
      evidenceFingerprint,
    });
  }

  #statement(node, findings) {
    if (!node) return;
    if (node.type === "ImportDeclaration") return;
    if (node.type === "ExportNamedDeclaration") {
      if (node.declaration) this.#statement(node.declaration, findings);
      return;
    }
    if (node.type === "ExportDefaultDeclaration" || node.type === "ExportAllDeclaration") {
      findings.push(this.#finding("unsupported-export", node, "unsafe"));
      return;
    }
    if (node.type === "FunctionDeclaration") return;
    if (node.type === "ClassDeclaration") {
      this.#class(node, findings);
      return;
    }
    if (node.type === "VariableDeclaration") {
      for (const declaration of node.declarations) {
        this.#initializer(declaration.init, findings);
      }
      return;
    }
    if (node.type === "ExpressionStatement" && typeof node.directive === "string") return;
    if (node.type === "EmptyStatement") return;
    const classification = [
      "ExpressionStatement",
      "IfStatement",
      "ForStatement",
      "ForInStatement",
      "ForOfStatement",
      "WhileStatement",
      "DoWhileStatement",
      "TryStatement",
      "ThrowStatement",
      "SwitchStatement",
      "WithStatement",
    ].includes(node.type) ? "unsafe" : "needs-review";
    findings.push(this.#finding(`top-level-${node.type}`, node, classification));
  }

  #class(node, findings) {
    if (node.superClass) this.#initializer(node.superClass, findings);
    for (const element of node.body?.body || []) {
      if (element.computed) this.#initializer(element.key, findings);
      if (element.type === "StaticBlock") {
        findings.push(this.#finding("class-static-block", element, "unsafe"));
      } else if (element.static && element.value) {
        this.#initializer(element.value, findings);
      }
    }
  }

  #initializer(node, findings) {
    if (!node) return;
    if (["Literal", "Identifier", "FunctionExpression", "ArrowFunctionExpression"].includes(node.type)) {
      return;
    }
    if (node.type === "ClassExpression") {
      this.#class(node, findings);
      return;
    }
    if (["ArrayExpression", "ObjectExpression"].includes(node.type)) {
      findings.push(this.#finding("module-mutable-initialization", node, "needs-review"));
      this.#nestedDynamic(node, findings);
      return;
    }
    if (["CallExpression", "NewExpression", "TaggedTemplateExpression"].includes(node.type)) {
      findings.push(this.#finding("initializer-execution", node, "needs-review"));
      return;
    }
    if (["AssignmentExpression", "UpdateExpression", "AwaitExpression", "YieldExpression"].includes(node.type)) {
      findings.push(this.#finding("observable-initializer", node, "unsafe"));
      return;
    }
    if (node.type === "MemberExpression" || node.type === "ChainExpression") {
      findings.push(this.#finding("initializer-property-read", node, "needs-review"));
      return;
    }
    if (["BinaryExpression", "LogicalExpression", "UnaryExpression", "ConditionalExpression", "TemplateLiteral"].includes(node.type)) {
      this.#nestedDynamic(node, findings);
      return;
    }
    findings.push(this.#finding(`initializer-${node.type}`, node, "needs-review"));
  }

  #nestedDynamic(root, findings) {
    estraverse.traverse(root, {
      fallback: "iteration",
      enter: (node) => {
        if (node === root) return;
        if (["FunctionExpression", "ArrowFunctionExpression", "ClassExpression"].includes(node.type)) {
          return estraverse.VisitorOption.Skip;
        }
        if (["CallExpression", "NewExpression", "TaggedTemplateExpression", "MemberExpression"].includes(node.type)) {
          findings.push(this.#finding("nested-initializer-execution", node, "needs-review"));
          return estraverse.VisitorOption.Skip;
        }
        if (["AssignmentExpression", "UpdateExpression", "AwaitExpression", "YieldExpression"].includes(node.type)) {
          findings.push(this.#finding("nested-observable-initializer", node, "unsafe"));
          return estraverse.VisitorOption.Skip;
        }
      },
    });
  }

  #finding(kind, node, classification) {
    return {
      kind,
      classification,
      location: `${node.loc?.start.line || 0}:${(node.loc?.start.column || 0) + 1}`,
    };
  }
}

class CumulativeSideEffectGate {
  constructor({ projectRoot, observer = new ModuleEvaluationEffectObserver() } = {}) {
    this.projectRoot = path.resolve(projectRoot);
    this.observer = observer;
  }

  verify({ graph, reviews = [] }) {
    const reviewByModule = new Map(reviews.map((review) => [review.module, review]));
    const observations = [];
    for (const record of graph.modules) {
      const source = fs.readFileSync(path.resolve(this.projectRoot, record.path), "utf8");
      const observation = this.observer.observe({ modulePath: record.path, source });
      const review = reviewByModule.get(record.path) || null;
      if (observation.classification !== "safe") {
        if (!review) {
          throw new Error(
            `Cumulative module evaluation requires review: ${record.path} ` +
              `(${observation.classification})`,
          );
        }
        if (
          review.decision !== "approved-compatible" ||
          review.evidenceFingerprint !== observation.evidenceFingerprint
        ) {
          throw new Error(`Cumulative module side-effect review is stale: ${record.path}`);
        }
      } else if (review) {
        throw new Error(`Cumulative module side-effect review is stale and unnecessary: ${record.path}`);
      }
      observations.push({ ...observation, reviewed: Boolean(review) });
      reviewByModule.delete(record.path);
    }
    if (reviewByModule.size > 0) {
      throw new Error(
        `Cumulative side-effect review targets modules outside the graph: ` +
          [...reviewByModule.keys()].sort().join(", "),
      );
    }
    return immutableRecord({ status: "verified", modules: observations });
  }
}

module.exports = { CumulativeSideEffectGate, ModuleEvaluationEffectObserver };
