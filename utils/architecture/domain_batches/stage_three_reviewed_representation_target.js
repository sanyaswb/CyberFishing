"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const espree = require("espree");
const { immutableRecord } = require("../guards/core/guard_models");
const { RepresentationOnlyNamedEsmTarget } = require("./stage_three_representation_target");
const { StageThreeReviewedEvaluationEffect } = require("./stage_three_reviewed_evaluation_effect");
const { ModuleEvaluationEffectObserver } = require("../../build/compat_runtime/cumulative_side_effect_gate");

const sha = value => crypto.createHash("sha256").update(value).digest("hex");
// A leaf projection whose reviewed evaluation is verified on the complete source by the caller.
const DEFERRED_EVALUATION = Symbol("deferred-evaluation");

class RepresentationOnlyReviewedEsmTarget {
  // `imports` are the plan's exact reviewed imports of completed-prefix exports. They form a
  // header of single named imports; removing it must restore the leaf projection byte-for-byte.
  project({ imports = [], ...options }) {
    const deferred = imports.length > 0 && Boolean(options.contract?.privateStaticSets);
    if (deferred) assert(options.targetEvaluation, `${options.targetPath}: reviewed private static set evaluation is required`);
    const base = this.#projectLeaf(deferred ? { ...options, targetEvaluation: DEFERRED_EVALUATION } : options);
    if (imports.length === 0) return base;
    const projected = this.#withImports(base, imports, options);
    if (deferred) this.#verifyEvaluation(projected, options);
    return projected;
  }

  // The ESM source a side-effect review observes to record the reviewed evaluation; it is never
  // published and never replaces a verified projection.
  observationSource({ imports = [], ...options }) {
    assert(options.contract?.privateStaticSets, `${options.targetPath}: only reviewed evaluations need observation`);
    const base = this.#projectLeaf({ ...options, targetEvaluation: DEFERRED_EVALUATION });
    return imports.length === 0 ? base.targetSource : this.#withImports(base, imports, options).targetSource;
  }

  #verifyEvaluation(projected, { targetPath, targetEvaluation }) {
    const observed = new ModuleEvaluationEffectObserver().observe({ modulePath: targetPath,
      source: projected.targetSource });
    assert.equal(observed.evidenceFingerprint, targetEvaluation.evidenceFingerprint,
      `${targetPath}: reviewed evaluation fingerprint differs`);
    assert.deepEqual(observed.observations, targetEvaluation.observations);
  }

  #withImports(base, imports, { source, currentPath, targetPath, exports, sourceSha256 }) {
    const classic = espree.parse(source, { ecmaVersion: "latest", sourceType: "script" });
    const declared = new Set(classic.body.flatMap(node => node.id ? [node.id.name]
      : (node.declarations || []).map(item => item.id.name)));
    const lines = imports.map(record => {
      assert.match(record.specifier, /^\.{1,2}\/[a-z0-9_/.-]+\.js$/u, `${targetPath}: import specifier is not exact`);
      assert.match(record.exportName, /^[A-Za-z_$][\w$]*$/u);
      assert(!declared.has(record.exportName), `${targetPath}: import would shadow a declaration`);
      assert(new RegExp(`\\b${record.exportName}\\b`, "u").test(source),
        `${currentPath}: reviewed import ${record.exportName} is not read by the classic source`);
      return `import { ${record.exportName} } from "${record.specifier}";`;
    }).sort();
    assert.equal(new Set(lines).size, lines.length, `${targetPath}: duplicate reviewed import`);
    const header = `${lines.join("\n")}\n\n`;
    const targetSource = header + base.targetSource;
    const tree = espree.parse(targetSource, { ecmaVersion: "latest", sourceType: "module" });
    const declarations = tree.body.filter(node => node.type === "ImportDeclaration");
    assert.equal(declarations.length, lines.length, `${targetPath}: unexpected import declaration`);
    assert(tree.body.slice(0, lines.length).every(node => node.type === "ImportDeclaration" &&
      node.specifiers.length === 1 && node.specifiers[0].type === "ImportSpecifier" &&
      node.specifiers[0].imported.name === node.specifiers[0].local.name),
    `${targetPath}: reviewed imports must be single named bindings before the body`);
    assert.equal(targetSource.slice(header.length), base.targetSource, `${targetPath}: import header changed the body`);
    assert.equal(sha(source), sourceSha256);
    return immutableRecord({ ...base, exports, targetSha256: sha(targetSource), targetSource,
      validation: { ...base.validation, importCount: lines.length,
        imports: imports.map(({ specifier, exportName }) => ({ specifier, exportName }))
          .sort((left, right) => `${left.specifier}\0${left.exportName}`
            .localeCompare(`${right.specifier}\0${right.exportName}`)) } });
  }

  #projectLeaf({ source, currentPath, targetPath, exports, sourceSha256, contract,
    targetEvaluation = null }) {
    assert.equal(sha(source), sourceSha256, `${currentPath}: source changed after audit`);
    if (!contract.privateStaticSets && !contract.frozenStaticFields && !contract.frozenConstants &&
      !contract.classFamily && !contract.legacyExposure && exports.length > 1) {
      return this.#classDeclarationsOnly({ source, currentPath, targetPath, exports, sourceSha256 });
    }
    const reviewer = new StageThreeReviewedEvaluationEffect();
    if (contract.privateStaticSets) {
      assert(!contract.frozenConstants && !contract.frozenStaticFields && !contract.classFamily);
      const exposure = contract.legacyExposure || null;
      assert(!exposure || exposure.mechanism === "global-this-property");
      reviewer.privateStaticSets({ source, currentPath, ...contract.privateStaticSets,
        exposure: exposure && { symbol: exposure.symbol, location: exposure.location } });
      assert.deepEqual(exports, [contract.privateStaticSets.className]);
      assert(targetEvaluation, `${targetPath}: reviewed private static set evaluation is required`);
      const projected = new RepresentationOnlyNamedEsmTarget().project({ source, currentPath,
        targetPath, exportName: exports[0], sourceSha256, legacyExposure: exposure });
      if (targetEvaluation === DEFERRED_EVALUATION) return projected;
      const observed = new ModuleEvaluationEffectObserver().observe({ modulePath: targetPath,
        source: projected.targetSource });
      assert.equal(observed.evidenceFingerprint, targetEvaluation.evidenceFingerprint);
      assert.deepEqual(observed.observations, targetEvaluation.observations);
      return projected;
    }
    if (contract.frozenStaticFields) {
      assert(!contract.frozenConstants && !contract.legacyExposure);
      reviewer.frozenStaticFields({ source, currentPath, ...contract.frozenStaticFields });
      assert.deepEqual(exports, [contract.frozenStaticFields.className]);
      assert(targetEvaluation, `${targetPath}: reviewed static-field evaluation is required`);
      const projected = new RepresentationOnlyNamedEsmTarget().project({ source, currentPath,
        targetPath, exportName: exports[0], sourceSha256 });
      const observed = new ModuleEvaluationEffectObserver().observe({ modulePath: targetPath,
        source: projected.targetSource });
      assert.equal(observed.evidenceFingerprint, targetEvaluation.evidenceFingerprint);
      assert.deepEqual(observed.observations, targetEvaluation.observations);
      return projected;
    }
    if (!contract.frozenConstants && !contract.classFamily &&
      contract.legacyExposure?.mechanism !== "window-property") {
      assert.equal(exports.length, 1);
      return new RepresentationOnlyNamedEsmTarget().project({ source, currentPath, targetPath,
        exportName: exports[0], sourceSha256, legacyExposure: contract.legacyExposure });
    }
    let classicBody;
    let targetSource;
    if (contract.classFamily) {
      assert(!contract.legacyExposure && !contract.frozenStaticFields);
      const family = contract.classFamily;
      reviewer.classFamily({ source, currentPath, ...family });
      const tree = espree.parse(source, { ecmaVersion: "latest", sourceType: "script", range: true });
      classicBody = `${source.slice(0, tree.body[family.classes.length].range[0]).trimEnd()}\n`;
      targetSource = classicBody;
      for (const name of family.classes) {
        const token = `class ${name} `;
        assert.equal(targetSource.split(token).length - 1, 1);
        targetSource = targetSource.replace(token, `export ${token}`);
      }
      assert.deepEqual(exports, [...family.classes].sort());
    } else if (contract.frozenConstants) {
      reviewer.frozenConstants({ source, currentPath, ...contract.frozenConstants });
      classicBody = source;
      targetSource = source;
      for (const name of Object.keys(contract.frozenConstants.bindings)) {
        const token = `const ${name}`;
        assert.equal(targetSource.split(token).length - 1, 1);
        targetSource = targetSource.replace(token, `export ${token}`);
      }
      const constantClasses = contract.frozenConstants.classNames || [contract.frozenConstants.className];
      for (const name of constantClasses) {
        const token = `class ${name} `;
        assert.equal(targetSource.split(token).length - 1, 1);
        targetSource = targetSource.replace(token, `export ${token}`);
      }
      assert.deepEqual(exports, [...Object.keys(contract.frozenConstants.bindings),
        ...constantClasses].sort());
    } else {
      const exposure = contract.legacyExposure;
      reviewer.windowExposure({ source, currentPath, ...exposure });
      const tree = espree.parse(source, { ecmaVersion: "latest", sourceType: "script", range: true });
      classicBody = `${source.slice(0, tree.body[1].range[0]).trimEnd()}\n`;
      const token = `class ${exposure.symbol}`;
      assert.equal(classicBody.split(token).length - 1, 1);
      targetSource = classicBody.replace(token, `export ${token}`);
      assert.deepEqual(exports, [exposure.symbol]);
    }
    const tree = espree.parse(targetSource, { ecmaVersion: "latest", sourceType: "module" });
    assert(tree.body.every(node => node.type === "ExportNamedDeclaration"),
      `${targetPath}: only direct named exports are allowed`);
    const actual = tree.body.map(node => node.declaration.id?.name || node.declaration.declarations[0].id.name).sort();
    assert.deepEqual(actual, exports);
    assert(!targetSource.includes("window") && !targetSource.includes("globalThis") &&
      !targetSource.includes("__CYBER_FISHING_COMPAT_RUNTIME__"),
    `${targetPath}: target retains a browser or transport dependency`);
    let restored = targetSource;
    for (const name of Object.keys(contract.frozenConstants?.bindings || {})) {
      restored = restored.replace(`export const ${name}`, `const ${name}`);
    }
    for (const name of contract.classFamily?.classes || contract.frozenConstants?.classNames ||
      [contract.frozenConstants?.className || contract.legacyExposure.symbol]) {
      restored = restored.replace(`export class ${name}`, `class ${name}`);
    }
    assert.equal(restored, classicBody, `${targetPath}: non-representation source delta`);
    if (targetEvaluation) {
      const observed = new ModuleEvaluationEffectObserver().observe({ modulePath: targetPath,
        source: targetSource });
      assert.equal(observed.evidenceFingerprint, targetEvaluation.evidenceFingerprint);
      assert.deepEqual(observed.observations, targetEvaluation.observations);
    }
    return immutableRecord({ currentPath, targetPath, exportName: exports[0], exports,
      sourceSha256, targetSha256: sha(targetSource), targetSource,
      validation: { representation: "reviewed-classic-declarations-to-named-esm-exports-only",
        importCount: 0, exportCount: exports.length, dynamicImportCount: 0,
        forbiddenDependencyCount: 0, behaviorDelta: "none", stateOwnershipDelta: "none",
        allocationDelta: "none", currentPath, targetPath },
    });
  }

  // A classic script of plain class declarations only (global lexical providers, no top-level
  // effect) becomes the same classes with an `export` token each.
  #classDeclarationsOnly({ source, currentPath, targetPath, exports, sourceSha256 }) {
    const tree = espree.parse(source, { ecmaVersion: "latest", sourceType: "script" });
    assert(tree.body.every(node => node.type === "ClassDeclaration"),
      `${currentPath}: only plain class declarations may use the class-declarations shape`);
    assert.deepEqual(tree.body.map(node => node.id.name).sort(), exports, `${currentPath}: class set differs`);
    let targetSource = source;
    for (const name of exports) {
      const token = `class ${name} `;
      assert.equal(targetSource.split(token).length - 1, 1, `${currentPath}: class token is not exact: ${name}`);
      targetSource = targetSource.replace(token, `export ${token}`);
    }
    const target = espree.parse(targetSource, { ecmaVersion: "latest", sourceType: "module" });
    assert(target.body.every(node => node.type === "ExportNamedDeclaration" && node.source === null &&
      node.declaration?.type === "ClassDeclaration"), `${targetPath}: only direct named class exports are allowed`);
    assert(!targetSource.includes("window") && !targetSource.includes("globalThis") &&
      !targetSource.includes("__CYBER_FISHING_COMPAT_RUNTIME__"),
    `${targetPath}: target retains a browser or transport dependency`);
    let restored = targetSource;
    for (const name of exports) restored = restored.replace(`export class ${name} `, `class ${name} `);
    assert.equal(restored, source, `${targetPath}: non-representation source delta`);
    return immutableRecord({ currentPath, targetPath, exportName: exports[0], exports,
      sourceSha256, targetSha256: sha(targetSource), targetSource,
      validation: { representation: "classic-class-declarations-to-named-esm-exports-only",
        importCount: 0, exportCount: exports.length, dynamicImportCount: 0,
        forbiddenDependencyCount: 0, behaviorDelta: "none", stateOwnershipDelta: "none",
        allocationDelta: "none", currentPath, targetPath },
    });
  }
}

module.exports = { RepresentationOnlyReviewedEsmTarget };
