"use strict";

const assert = require("node:assert/strict");
const espree = require("espree");

// Reviewed pure top-level functions of a classic Domain source. A plain function declaration has no
// evaluation effect: it only binds its name (in a classic script, the global-function provider). The
// batch source observer lists it among top-level statements; this review names exactly those
// statements so an effect-free source may carry the reviewed functions beside its classes.
class StageThreeReviewedTopLevelFunctions {
  review({ source, currentPath, names = [] }) {
    const tree = espree.parse(source, { ecmaVersion: "latest", sourceType: "script", loc: true });
    const declarations = tree.body.filter(node => node.type === "FunctionDeclaration");
    assert.deepEqual(declarations.map(node => node.id.name).sort(), [...names].sort(),
      `${currentPath}: reviewed top-level functions differ`);
    for (const node of declarations) {
      assert(!node.async && !node.generator, `${currentPath}: ${node.id.name} must be a plain function`);
    }
    return declarations.map(node => `FunctionDeclaration@${node.loc.start.line}:${node.loc.start.column + 1}`);
  }
}

module.exports = { StageThreeReviewedTopLevelFunctions };
