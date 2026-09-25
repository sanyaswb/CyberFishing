"use strict";
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const espree = require("espree");
const { ModuleEvaluationEffectObserver } = require("../../build/compat_runtime/cumulative_side_effect_gate");
const { EsmDependencyObserver } = require("../guards/observation/esm_dependency_observer");
const { immutableRecord } = require("../guards/core/guard_models");

// A deliberately conservative, batch-scoped proof: no imported/eager external
// dependency is silently treated as safe merely because the old build passed.
class Batch009EarlierEvaluationGate {
  verify({ projectRoot, modules, read, reviews }) {
    assert.equal(new Set(modules.map(m => m.targetPath)).size, modules.length, "duplicate module record");
    const effects = new ModuleEvaluationEffectObserver();
    const esm = new EsmDependencyObserver({ projectRoot });
    const reviewMap = new Map(reviews.map(r => [r.module, r]));
    assert.equal(reviewMap.size, reviews.length, "duplicate side-effect review");
    const records = modules.map(module => {
      const raw = read(module.currentPath);
      const source = module.currentPath === module.targetPath ? raw : raw.replace(/^class /u, "export class ");
      const observed = esm.observeFile(module.targetPath, source);
      assert.equal(observed.status, "verified", "unknown ESM construct");
      assert.equal(observed.observations.length, 0, "batch-009 closure changed: dependency requires re-audit");
      assert.equal(observed.globalAssignments.length, 0, "ESM global assignment");
      const tree = espree.parse(source, { ecmaVersion: "latest", sourceType: "module" });
      const initializations = [];
      for (const statement of tree.body) {
        const node = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
        assert(node, "unsupported export");
        if (node.type === "FunctionDeclaration") continue;
        if (node.type === "ClassDeclaration") {
          assert.equal(node.superClass, null, "eager superclass dependency requires review");
          for (const member of node.body.body) {
            assert(!member.computed && member.type !== "StaticBlock", "eager class effect requires review");
            if (member.static && member.type === "PropertyDefinition") {
              const value = member.value;
              const literal = value?.arguments?.[0];
              const frozenLiteral = value?.type === "CallExpression" &&
                value.callee?.type === "MemberExpression" && value.callee.object?.name === "Object" &&
                value.callee.property?.name === "freeze" && value.arguments.length === 1 &&
                (literal.type === "ArrayExpression" && literal.elements.every(element =>
                  element?.type === "Literal" && typeof element.value === "string") ||
                literal.type === "ObjectExpression" && literal.properties.every(property =>
                  property.type === "Property" && property.kind === "init" && !property.computed &&
                  !property.method && property.key.type === "Identifier" &&
                  property.value.type === "Literal" && typeof property.value.value === "string"));
              assert(frozenLiteral, "static initialization requires review");
              initializations.push({ binding: `${node.id.name}.${member.key.name}`,
                kind: "frozen-literal-static-field" });
            }
          }
          continue;
        }
        assert.equal(node.type, "VariableDeclaration", "unsupported top-level effect");
        for (const declaration of node.declarations) {
          assert.equal(declaration.id.type, "Identifier", "dynamic binding initialization");
          const init = declaration.init;
          const localWeakMap = init?.type === "NewExpression" && init.callee.type === "Identifier" &&
            init.callee.name === "WeakMap" && init.arguments.length === 0;
          const frozenLiteralRange = init?.type === "CallExpression" &&
            init.callee?.type === "MemberExpression" && init.callee.object?.name === "Object" &&
            init.callee.property?.name === "freeze" && init.arguments.length === 1 &&
            init.arguments[0].type === "ArrayExpression" && init.arguments[0].elements.length === 2 &&
            init.arguments[0].elements.every(value => value.type === "Literal" &&
              typeof value.value === "number" || value.type === "UnaryExpression" &&
              value.operator === "-" && value.argument?.type === "Literal" &&
              typeof value.argument.value === "number");
          assert(init?.type === "Literal" || localWeakMap || frozenLiteralRange,
            "unknown eager initializer");
          initializations.push({ binding: declaration.id.name, kind: localWeakMap
            ? "private-empty-weakmap" : frozenLiteralRange ? "frozen-literal-range" : "primitive-literal" });
        }
      }
      const effect = effects.observe({ modulePath: module.targetPath, source });
      const review = reviewMap.get(module.targetPath);
      if (effect.classification !== "safe") {
        assert.equal(effect.classification, "needs-review", "unsafe evaluation");
        assert.equal(review?.decision, "approved-compatible", "missing reviewed initialization");
        assert.equal(review.evidenceFingerprint, effect.evidenceFingerprint, "stale effect review");
        assert(initializations.some(i => ["private-empty-weakmap", "frozen-literal-range",
          "frozen-literal-static-field"].includes(i.kind)),
          "review does not prove compatible initialization");
      } else assert(!review, "stale unnecessary review");
      reviewMap.delete(module.targetPath);
      return {
        source: module.currentPath, target: module.targetPath,
        sourceSha256: crypto.createHash("sha256").update(raw).digest("hex"),
        candidateSha256: crypto.createHash("sha256").update(source).digest("hex"),
        dependencies: [], effect, initializations, review: review || null,
        earlierEvaluation: "compatible-no-external-state-read-or-mutation",
      };
    }).sort((a, b) => a.target.localeCompare(b.target));
    assert.equal(reviewMap.size, 0, "review outside closure");
    return immutableRecord({ status: "verified", records,
      safeCount: records.filter(r => r.effect.classification === "safe").length,
      reviewedCount: records.filter(r => r.review).length,
      unsafeCount: 0, unknownCount: 0, dependencyEdges: [],
      proofScope: "source-evaluation-only-not-live-cutover-acceptance",
      revalidationRequiredAtCandidateBuild: true,
    });
  }
}
module.exports = { Batch009EarlierEvaluationGate };
