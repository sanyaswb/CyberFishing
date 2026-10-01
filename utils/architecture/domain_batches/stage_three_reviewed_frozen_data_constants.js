"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const vm = require("node:vm");
const espree = require("espree");
const { isInertLiteral } = require("./stage_three_inert_literal");

const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const position = node => `${node.loc.start.line}:${node.loc.start.column + 1}`;

// Reviews a classic data source made only of top-level `const NAME = Object.freeze(...)` bindings
// (no class, no function, no other statement). Every array or object literal is the direct argument
// of an Object.freeze call, so evaluation creates deeply frozen tables. Values are inert literals
// (strings, finite numbers, booleans), reads `Earlier.PROP` of an earlier binding of the same source,
// array spreads of an earlier binding, and computed keys only as `Earlier.PROP`. Evaluation must
// create no global property and reproduce the exact reviewed values.
class StageThreeReviewedFrozenDataConstants {
  // The Object.freeze call nodes of one frozen data table initializer, outermost first, or null when
  // the initializer leaves the reviewed grammar. `declared` holds the earlier bindings of the module.
  static freezeCalls(init, declared) {
    const calls = [];
    const earlierRead = node => node?.type === "MemberExpression" && node.computed === false &&
      node.optional === false && node.object.type === "Identifier" && declared.has(node.object.name) &&
      node.property.type === "Identifier";
    const value = node => node?.type === "CallExpression" ? frozen(node) : earlierRead(node) ||
      isInertLiteral(node) || (node?.type === "Literal" && typeof node.value === "boolean");
    const frozen = node => {
      if (!(node?.type === "CallExpression" && node.optional === false &&
        node.callee.type === "MemberExpression" && node.callee.computed === false &&
        node.callee.object.type === "Identifier" && node.callee.object.name === "Object" &&
        node.callee.property.type === "Identifier" && node.callee.property.name === "freeze" &&
        node.arguments.length === 1)) return false;
      calls.push(node);
      const literal = node.arguments[0];
      if (literal.type === "ArrayExpression") {
        return literal.elements.every(element => element !== null && (element.type === "SpreadElement"
          ? element.argument.type === "Identifier" && declared.has(element.argument.name) : value(element)));
      }
      return literal.type === "ObjectExpression" && literal.properties.every(property =>
        property.type === "Property" && property.kind === "init" && property.method === false &&
        property.shorthand === false && (property.computed ? earlierRead(property.key)
          : property.key.type === "Identifier") && value(property.value));
    };
    return frozen(init) ? calls : null;
  }

  review({ source, currentPath, bindings }) {
    const names = Object.keys(bindings || {});
    assert(names.length > 0, `${currentPath}: frozen data constants are required`);
    const tree = espree.parse(source, { ecmaVersion: "latest", sourceType: "script", loc: true });
    assert.equal(tree.body.length, names.length,
      `${currentPath}: expected exactly ${names.length} frozen data constants`);
    const declared = new Set();
    const freezeCalls = [];
    tree.body.forEach((statement, index) => {
      assert(statement.type === "VariableDeclaration" && statement.kind === "const" &&
        statement.declarations.length === 1 && statement.declarations[0].id.type === "Identifier",
      `${currentPath}: expected one const declaration per statement`);
      const declaration = statement.declarations[0];
      assert.equal(declaration.id.name, names[index], `${currentPath}: reviewed constant order differs`);
      assert.equal(position(declaration.init), bindings[names[index]].location,
        `${currentPath}: reviewed constant location differs: ${names[index]}`);
      const calls = StageThreeReviewedFrozenDataConstants.freezeCalls(declaration.init, declared);
      assert(calls, `${currentPath}: ${names[index]} is not a reviewed frozen data table`);
      freezeCalls.push(...calls.map(position));
      declared.add(declaration.id.name);
    });
    const context = vm.createContext({});
    vm.runInContext(source, context, { filename: currentPath });
    assert.deepEqual(Object.getOwnPropertyNames(context), [], `${currentPath}: frozen data constants created globals`);
    // Copies a deeply frozen table into this realm; any unresolved read (undefined) is refused.
    const plain = (item, name) => {
      if (["string", "number", "boolean"].includes(typeof item)) return item;
      assert(item !== null && typeof item === "object" && Object.isFrozen(item),
        `${currentPath}: ${name} is not a deeply frozen data table`);
      return Array.isArray(item) ? Array.from(item, element => plain(element, name))
        : Object.fromEntries(Object.entries(item).map(([key, element]) => [key, plain(element, name)]));
    };
    for (const name of names) {
      assert.deepEqual(plain(vm.runInContext(name, context), name), bindings[name].values,
        `${currentPath}: reviewed constant value differs: ${name}`);
    }
    return Object.freeze({ kind: "frozen-data-constants", currentPath, sourceSha256: sha(source), bindings,
      freezeCallLocations: [...freezeCalls].sort(), topLevelStatementCount: names.length,
      evaluationCount: 1, globalPropertiesAdded: [], otherTopLevelEffects: 0 });
  }
}

module.exports = { StageThreeReviewedFrozenDataConstants };
