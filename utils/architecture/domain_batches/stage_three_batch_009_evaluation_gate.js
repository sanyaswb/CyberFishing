"use strict";
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const espree = require("espree");
const { ModuleEvaluationEffectObserver } = require("../../build/compat_runtime/cumulative_side_effect_gate");
const { EsmDependencyObserver } = require("../guards/observation/esm_dependency_observer");
const { immutableRecord } = require("../guards/core/guard_models");
const { isInertLiteral } = require("./stage_three_inert_literal");

const BUILTIN_ERRORS = new Set(["Error", "RangeError", "TypeError"]);

// A deliberately conservative, batch-scoped proof: no imported/eager external
// dependency is silently treated as safe merely because the old build passed.
class Batch009EarlierEvaluationGate {
  // `reviewedImports` maps a target to its exact plan-reviewed static imports of modules that are
  // themselves in the verified closure; any other dependency still requires a new audit.
  verify({ projectRoot, modules, read, reviews, reviewedImports = {} }) {
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
      const allowedImports = reviewedImports[module.targetPath] || [];
      const closure = new Set(modules.map(item => item.targetPath));
      // The exact reviewed import set; declaration order is the representation's own concern.
      const bySpecifier = (left, right) => left.specifier.localeCompare(right.specifier);
      assert.deepEqual(observed.observations.map(item => ({ mechanism: item.mechanism,
        specifier: item.specifier, resolvedTarget: item.resolvedTarget, status: item.resolutionStatus }))
        .sort(bySpecifier),
      allowedImports.map(item => ({ mechanism: "static-import", specifier: item.specifier,
        resolvedTarget: item.from, status: "confirmed-project" })).sort(bySpecifier),
      "batch-009 closure changed: dependency requires re-audit");
      assert(allowedImports.every(item => closure.has(item.from)), "reviewed import leaves the verified closure");
      assert.equal(observed.globalAssignments.length, 0, "ESM global assignment");
      const tree = espree.parse(source, { ecmaVersion: "latest", sourceType: "module" });
      const initializations = [];
      const declaredClasses = new Set();
      const declaredBindings = new Set();
      for (const statement of tree.body) {
        if (statement.type === "ImportDeclaration") {
          // Pure binding: the imported module is itself verified inside this closure.
          assert(allowedImports.some(item => item.specifier === statement.source.value &&
            statement.specifiers.length === 1 && statement.specifiers[0].type === "ImportSpecifier" &&
            statement.specifiers[0].imported.name === item.exportName &&
            statement.specifiers[0].local.name === item.exportName), "unreviewed import declaration");
          continue;
        }
        if (statement.type === "ExportNamedDeclaration" && statement.declaration === null) {
          // A local named-export list performs no initialization. It is allowed only for bindings
          // already proven earlier in this module; re-exports still require a separate review.
          assert.equal(statement.source, null, "re-export requires review");
          assert(statement.specifiers.length > 0, "empty export list is unsupported");
          for (const specifier of statement.specifiers) {
            assert(specifier.type === "ExportSpecifier" && specifier.local?.type === "Identifier" &&
              declaredBindings.has(specifier.local.name), "export names an undeclared binding");
          }
          continue;
        }
        const node = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
        assert(node, "unsupported export");
        if (node.type === "FunctionDeclaration") {
          declaredBindings.add(node.id.name);
          continue;
        }
        if (node.type === "ClassDeclaration") {
          // Only a class declared earlier in the same module may be a superclass: it is fully
          // evaluated before the subclass and is not an external eager dependency.
          const localSuperclass = node.superClass?.type === "Identifier" &&
            declaredClasses.has(node.superClass.name);
          // A reviewed import of a verified closure module is evaluated before this module by ESM
          // ordering, so it may be the eager superclass exactly like a local class.
          const importedSuperclass = node.superClass?.type === "Identifier" && !localSuperclass &&
            allowedImports.some(item => item.exportName === node.superClass.name);
          // An ECMAScript error constructor is a language builtin, not a project dependency; the
          // module must not declare or import a binding that shadows it.
          const builtinErrorSuperclass = node.superClass?.type === "Identifier" && !localSuperclass &&
            !importedSuperclass && BUILTIN_ERRORS.has(node.superClass.name) &&
            !declaredClasses.has(node.superClass.name);
          assert(node.superClass === null || localSuperclass || importedSuperclass || builtinErrorSuperclass,
            "eager superclass dependency requires review");
          if (localSuperclass) {
            initializations.push({ binding: node.id.name, kind: "local-superclass" });
          }
          if (importedSuperclass) {
            initializations.push({ binding: node.id.name, kind: "reviewed-imported-superclass" });
          }
          for (const member of node.body.body) {
            assert(!member.computed && member.type !== "StaticBlock", "eager class effect requires review");
            if (member.static && member.type === "PropertyDefinition") {
              const value = member.value;
              const literal = value?.arguments?.[0];
              const frozenLiteral = value?.type === "CallExpression" &&
                value.callee?.type === "MemberExpression" && value.callee.object?.name === "Object" &&
                value.callee.property?.name === "freeze" && value.arguments.length === 1 &&
                (literal.type === "ArrayExpression" && literal.elements.every(isInertLiteral) ||
                literal.type === "ObjectExpression" && literal.properties.every(property =>
                  property.type === "Property" && property.kind === "init" && !property.computed &&
                  !property.method && property.key.type === "Identifier" &&
                  property.value.type === "Literal" && typeof property.value.value === "string"));
              const privateLiteralSet = member.key.type === "PrivateIdentifier" &&
                value?.type === "NewExpression" && value.callee?.type === "Identifier" &&
                value.callee.name === "Set" && value.arguments.length === 1 &&
                value.arguments[0].type === "ArrayExpression" &&
                value.arguments[0].elements.every(isInertLiteral);
              const primitiveLiteral = value?.type === "Literal" &&
                (value.value === null || ["string", "boolean"].includes(typeof value.value) ||
                  typeof value.value === "number" && Number.isFinite(value.value)) ||
                isInertLiteral(value);
              assert(frozenLiteral || primitiveLiteral || privateLiteralSet,
                "static initialization requires review");
              initializations.push({ binding: `${node.id.name}.${privateLiteralSet ? "#" : ""}${member.key.name}`,
                kind: frozenLiteral ? "frozen-literal-static-field" : privateLiteralSet
                  ? "private-literal-set-static-field" : "primitive-literal-static-field" });
            }
          }
          declaredClasses.add(node.id.name);
          declaredBindings.add(node.id.name);
          continue;
        }
        assert.equal(node.type, "VariableDeclaration", "unsupported top-level effect");
        for (const declaration of node.declarations) {
          assert.equal(declaration.id.type, "Identifier", "dynamic binding initialization");
          const init = declaration.init;
          const localWeakMap = init?.type === "NewExpression" && init.callee.type === "Identifier" &&
            init.callee.name === "WeakMap" && init.arguments.length === 0;
          const frozenArgument = init?.type === "CallExpression" &&
            init.callee?.type === "MemberExpression" && init.callee.object?.name === "Object" &&
            init.callee.property?.name === "freeze" && init.arguments.length === 1
            ? init.arguments[0] : null;
          const frozenLiteralRange = frozenArgument?.type === "ArrayExpression" &&
            frozenArgument.elements.length === 2 &&
            frozenArgument.elements.every(value => value.type === "Literal" &&
              typeof value.value === "number" || value.type === "UnaryExpression" &&
              value.operator === "-" && value.argument?.type === "Literal" &&
              typeof value.argument.value === "number");
          const frozenLiteralConstant = !frozenLiteralRange && (
            frozenArgument?.type === "ArrayExpression" && frozenArgument.elements.every(isInertLiteral) ||
            frozenArgument?.type === "ObjectExpression" && frozenArgument.properties.every(property =>
              property.type === "Property" && property.kind === "init" && !property.computed &&
              !property.method && property.key.type === "Identifier" &&
              property.value.type === "Literal" && typeof property.value.value === "string"));
          assert(init?.type === "Literal" || localWeakMap || frozenLiteralRange || frozenLiteralConstant,
            "unknown eager initializer");
          initializations.push({ binding: declaration.id.name, kind: localWeakMap
            ? "private-empty-weakmap" : frozenLiteralRange ? "frozen-literal-range"
              : frozenLiteralConstant ? "frozen-literal-constant" : "primitive-literal" });
          declaredBindings.add(declaration.id.name);
        }
      }
      const effect = effects.observe({ modulePath: module.targetPath, source });
      const review = reviewMap.get(module.targetPath);
      if (effect.classification !== "safe") {
        assert.equal(effect.classification, "needs-review", "unsafe evaluation");
        assert.equal(review?.decision, "approved-compatible", "missing reviewed initialization");
        assert.equal(review.evidenceFingerprint, effect.evidenceFingerprint, "stale effect review");
        assert(initializations.some(i => ["private-empty-weakmap", "frozen-literal-range",
          "frozen-literal-constant", "frozen-literal-static-field", "local-superclass",
          "private-literal-set-static-field"].includes(i.kind)),
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
