"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const espree = require("espree");
const { immutableRecord } = require("../guards/core/guard_models");
const { RepresentationOnlyNamedEsmTarget } = require("./stage_three_representation_target");
const { StageThreeReviewedEvaluationEffect } = require("./stage_three_reviewed_evaluation_effect");
const { ModuleEvaluationEffectObserver } = require("../../build/compat_runtime/cumulative_side_effect_gate");

const sha = value => crypto.createHash("sha256").update(value).digest("hex");

class RepresentationOnlyReviewedEsmTarget {
  project({ source, currentPath, targetPath, exports, sourceSha256, contract,
    targetEvaluation = null }) {
    assert.equal(sha(source), sourceSha256, `${currentPath}: source changed after audit`);
    const reviewer = new StageThreeReviewedEvaluationEffect();
    if (!contract.frozenConstants && contract.legacyExposure?.mechanism !== "window-property") {
      assert.equal(exports.length, 1);
      return new RepresentationOnlyNamedEsmTarget().project({ source, currentPath, targetPath,
        exportName: exports[0], sourceSha256, legacyExposure: contract.legacyExposure });
    }
    let classicBody;
    let targetSource;
    if (contract.frozenConstants) {
      reviewer.frozenConstants({ source, currentPath, ...contract.frozenConstants });
      classicBody = source;
      targetSource = source;
      for (const name of Object.keys(contract.frozenConstants.bindings)) {
        const token = `const ${name}`;
        assert.equal(targetSource.split(token).length - 1, 1);
        targetSource = targetSource.replace(token, `export ${token}`);
      }
      const token = `class ${contract.frozenConstants.className}`;
      assert.equal(targetSource.split(token).length - 1, 1);
      targetSource = targetSource.replace(token, `export ${token}`);
      assert.deepEqual(exports, [...Object.keys(contract.frozenConstants.bindings),
        contract.frozenConstants.className].sort());
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
    restored = restored.replace(`export class ${contract.frozenConstants?.className ||
      contract.legacyExposure.symbol}`, `class ${contract.frozenConstants?.className ||
      contract.legacyExposure.symbol}`);
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
}

module.exports = { RepresentationOnlyReviewedEsmTarget };
