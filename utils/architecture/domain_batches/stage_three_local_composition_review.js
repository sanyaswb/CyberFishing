"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const espree = require("espree");
const estraverse = require("estraverse");

const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const position = node => `${node.loc.start.line}:${node.loc.start.column + 1}`;
const BUILT_INS = new Set(["Error"]);

// Proves a "review-constructor-injection-boundary" prerequisite for local composition: every
// `new X(...)` in the source constructs either a reviewed class declared in the same source (a
// default collaborator, e.g. `policy || new LocalPolicy()`) or a built-in Error. The composed classes
// move with their owner into the same ESM target, so no injection boundary crosses a module or layer.
class StageThreeLocalCompositionReview {
  review({ source, currentPath, composedClasses }) {
    assert(Array.isArray(composedClasses) && composedClasses.length > 0,
      `${currentPath}: reviewed local compositions are required`);
    const tree = espree.parse(source, { ecmaVersion: "latest", sourceType: "script", loc: true });
    const declared = new Set(tree.body.filter(node => node.type === "ClassDeclaration").map(node => node.id.name));
    const creations = [];
    estraverse.traverse(tree, {
      fallback: "iteration",
      enter(node) {
        if (node.type === "NewExpression") {
          assert.equal(node.callee.type, "Identifier", `${currentPath}: dynamic construction at ${position(node)}`);
          creations.push({ composed: node.callee.name, location: position(node) });
        }
      },
    });
    const local = creations.filter(item => !BUILT_INS.has(item.composed));
    for (const item of local) {
      assert(declared.has(item.composed), `${currentPath}: ${item.composed} is not declared in the source`);
    }
    assert.deepEqual([...new Set(local.map(item => item.composed))].sort(), [...composedClasses].sort(),
      `${currentPath}: reviewed local compositions differ`);
    return Object.freeze({ kind: "local-composition", currentPath, sourceSha256: sha(source),
      compositions: local.sort((left, right) =>
        `${left.composed}\0${left.location}`.localeCompare(`${right.composed}\0${right.location}`)),
      invariant: "same-module-owner-created-default-collaborators" });
  }
}

module.exports = { StageThreeLocalCompositionReview };
