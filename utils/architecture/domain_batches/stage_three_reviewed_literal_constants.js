"use strict";

const assert = require("node:assert/strict");
const espree = require("espree");

// Reviewed top-level literal constants of a classic Domain source (batch 045: the persisted loadout
// default name). `const NAME = <string, finite number or boolean literal>` evaluates nothing beyond
// binding its name; the batch source observer lists it among top-level statements, and this review
// names exactly those statements so an effect-free source may carry them beside its classes.
class StageThreeReviewedLiteralConstants {
  review({ source, currentPath, names = [] }) {
    const tree = espree.parse(source, { ecmaVersion: "latest", sourceType: "script", loc: true });
    const declarations = tree.body.filter(node => node.type === "VariableDeclaration");
    assert(declarations.every(node => node.kind === "const" && node.declarations.length === 1 &&
      node.declarations[0].id.type === "Identifier"), `${currentPath}: only single const literal bindings are reviewed`);
    assert.deepEqual(declarations.map(node => node.declarations[0].id.name).sort(), [...names].sort(),
      `${currentPath}: reviewed literal constants differ`);
    for (const node of declarations) {
      const init = node.declarations[0].init;
      assert(init?.type === "Literal" && (typeof init.value === "string" || typeof init.value === "boolean" ||
        (typeof init.value === "number" && Number.isFinite(init.value))),
      `${currentPath}: ${node.declarations[0].id.name} must be a string, number or boolean literal`);
    }
    return declarations.map(node => `VariableDeclaration@${node.loc.start.line}:${node.loc.start.column + 1}`);
  }
}

module.exports = { StageThreeReviewedLiteralConstants };
