"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const vm = require("node:vm");
const espree = require("espree");

class StageThreeGlobalExposureReview {
  review({ source, currentPath, symbol, location }) {
    assert.equal(typeof source, "string");
    const tree = espree.parse(source, { ecmaVersion: "latest", sourceType: "script", loc: true });
    assert.equal(tree.body.length, 2, `${currentPath}: only class and global exposure are allowed`);
    const [declaration, statement] = tree.body;
    assert.equal(declaration.type, "ClassDeclaration");
    assert.equal(declaration.id?.name, symbol);
    assert.equal(statement.type, "ExpressionStatement");
    assert.equal(`${statement.loc.start.line}:${statement.loc.start.column + 1}`, location);
    const assignment = statement.expression;
    assert.equal(assignment.type, "AssignmentExpression");
    assert.equal(assignment.operator, "=");
    assert.equal(assignment.left.type, "MemberExpression");
    assert.equal(assignment.left.computed, false);
    assert.equal(assignment.left.object.type, "Identifier");
    assert.equal(assignment.left.object.name, "globalThis");
    assert.equal(assignment.left.property.type, "Identifier");
    assert.equal(assignment.left.property.name, symbol);
    assert.equal(assignment.right.type, "Identifier");
    assert.equal(assignment.right.name, symbol);
    const context = vm.createContext({});
    vm.runInContext(source, context, { filename: currentPath });
    assert.deepEqual(Object.getOwnPropertyNames(context), [symbol],
      `${currentPath}: source evaluation changed unexpected globals`);
    assert.equal(typeof context[symbol], "function");
    assert.equal(context[symbol].name, symbol);
    const descriptor = Object.getOwnPropertyDescriptor(context, symbol);
    assert.equal(descriptor.value, context[symbol]);
    return Object.freeze({
      currentPath, symbol, location,
      sourceSha256: crypto.createHash("sha256").update(source).digest("hex"),
      topLevelStatements: ["class-declaration", "global-this-assignment"],
      assignmentTarget: `globalThis.${symbol}`,
      evaluatedGlobalNames: [symbol],
      evaluationCount: 1,
      otherTopLevelEffects: 0,
    });
  }
}

module.exports = { StageThreeGlobalExposureReview };
