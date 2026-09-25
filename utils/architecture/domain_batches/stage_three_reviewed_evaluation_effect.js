"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const vm = require("node:vm");
const espree = require("espree");

const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const position = node => `${node.loc.start.line}:${node.loc.start.column + 1}`;

class StageThreeReviewedEvaluationEffect {
  parse(source) {
    return espree.parse(source, { ecmaVersion: "latest", sourceType: "script", loc: true, range: true });
  }

  frozenConstants({ source, currentPath, className, bindings }) {
    const tree = this.parse(source);
    const names = Object.keys(bindings);
    assert.equal(names.length, 2);
    assert.equal(tree.body.length, 3, `${currentPath}: expected two constants and one class`);
    for (let index = 0; index < 2; index += 1) {
      const statement = tree.body[index];
      const expected = names[index];
      assert.equal(statement.type, "VariableDeclaration");
      assert.equal(statement.kind, "const");
      assert.equal(statement.declarations.length, 1);
      assert.equal(statement.declarations[0].id.name, expected);
      const call = statement.declarations[0].init;
      assert.equal(call.type, "CallExpression");
      assert.equal(call.callee.type, "MemberExpression");
      assert.equal(call.callee.object.name, "Object");
      assert.equal(call.callee.property.name, "freeze");
      assert.equal(call.arguments.length, 1);
      const array = call.arguments[0];
      assert.equal(array.type, "ArrayExpression");
      assert.equal(array.elements.length, 2);
      for (const element of array.elements) {
        assert(["Literal", "UnaryExpression"].includes(element.type), "Constant range must be numeric literals");
        if (element.type === "UnaryExpression") {
          assert.equal(element.operator, "-");
          assert.equal(element.argument.type, "Literal");
          assert.equal(typeof element.argument.value, "number");
        } else assert.equal(typeof element.value, "number");
      }
      assert.equal(position(call), bindings[expected].location);
    }
    assert.equal(tree.body[2].type, "ClassDeclaration");
    assert.equal(tree.body[2].id.name, className);
    const context = vm.createContext({});
    vm.runInContext(source, context, { filename: currentPath });
    assert.deepEqual(Object.getOwnPropertyNames(context), [], "Frozen constants created globals");
    for (const [name, contract] of Object.entries(bindings)) {
      assert.equal(vm.runInContext(`Object.isFrozen(${name})`, context), true);
      assert.deepEqual(Array.from(vm.runInContext(name, context)), contract.values);
    }
    return Object.freeze({ kind: "frozen-literal-ranges", currentPath, sourceSha256: sha(source),
      className, bindings, topLevelStatementCount: 3,
      evaluationCount: 1, globalPropertiesAdded: [], otherTopLevelEffects: 0 });
  }

  // Reviews a class whose only evaluation-time effects are static fields initialized by
  // Object.freeze over string literals (arrays or plain objects). No other top-level code
  // is allowed, and evaluation must not create globals.
  frozenStaticFields({ source, currentPath, className, bindings }) {
    const tree = this.parse(source);
    const names = Object.keys(bindings);
    assert(names.length > 0, `${currentPath}: frozen static fields are required`);
    assert.equal(tree.body.length, 1, `${currentPath}: expected exactly one class declaration`);
    const declaration = tree.body[0];
    assert.equal(declaration.type, "ClassDeclaration");
    assert.equal(declaration.id.name, className);
    assert.equal(declaration.superClass, null, `${currentPath}: superclass requires review`);
    const statics = declaration.body.body.filter(member => member.static);
    assert.deepEqual(statics.map(member => member.type), names.map(() => "PropertyDefinition"),
      `${currentPath}: unexpected static member or static block`);
    assert.deepEqual(statics.map(member => member.key.name), names,
      `${currentPath}: static field order differs`);
    for (const member of statics) {
      assert.equal(member.computed, false);
      assert.equal(member.key.type, "Identifier");
      const call = member.value;
      assert.equal(call?.type, "CallExpression");
      assert.equal(call.callee.type, "MemberExpression");
      assert.equal(call.callee.object.name, "Object");
      assert.equal(call.callee.property.name, "freeze");
      assert.equal(call.arguments.length, 1);
      const literal = call.arguments[0];
      if (literal.type === "ArrayExpression") {
        assert(literal.elements.every(element => element?.type === "Literal" &&
          typeof element.value === "string"), `${currentPath}: static array must contain string literals`);
      } else {
        assert.equal(literal.type, "ObjectExpression", `${currentPath}: static value must be a literal`);
        for (const property of literal.properties) {
          assert.equal(property.type, "Property");
          assert.equal(property.kind, "init");
          assert.equal(property.computed, false);
          assert.equal(property.method, false);
          assert.equal(property.key.type, "Identifier");
          assert.equal(property.value.type, "Literal");
          assert.equal(typeof property.value.value, "string");
        }
      }
      assert.equal(position(call), bindings[member.key.name].location);
    }
    const context = vm.createContext({});
    vm.runInContext(source, context, { filename: currentPath });
    assert.deepEqual(Object.getOwnPropertyNames(context), [], "Frozen static fields created globals");
    for (const [name, contract] of Object.entries(bindings)) {
      assert.equal(vm.runInContext(`Object.isFrozen(${className}.${name})`, context), true);
      const value = vm.runInContext(`${className}.${name}`, context);
      assert.deepEqual(Array.isArray(value) ? Array.from(value) : { ...value }, contract.values);
    }
    return Object.freeze({ kind: "frozen-literal-static-fields", currentPath, sourceSha256: sha(source),
      className, bindings, topLevelStatementCount: 1,
      evaluationCount: 1, globalPropertiesAdded: [], otherTopLevelEffects: 0 });
  }

  windowExposure({ source, currentPath, symbol, location }) {
    const tree = this.parse(source);
    assert.equal(tree.body.length, 2, `${currentPath}: expected class and guarded window assignment`);
    const [declaration, guard] = tree.body;
    assert.equal(declaration.type, "ClassDeclaration");
    assert.equal(declaration.id.name, symbol);
    assert.equal(guard.type, "IfStatement");
    assert.equal(guard.alternate, null);
    const test = guard.test;
    assert.equal(test.type, "BinaryExpression");
    assert.equal(test.operator, "!==");
    assert.equal(test.left.type, "UnaryExpression");
    assert.equal(test.left.operator, "typeof");
    assert.equal(test.left.argument.name, "window");
    assert.equal(test.right.type, "Literal");
    assert.equal(test.right.value, "undefined");
    assert.equal(guard.consequent.type, "BlockStatement");
    assert.equal(guard.consequent.body.length, 1);
    const statement = guard.consequent.body[0];
    assert.equal(statement.type, "ExpressionStatement");
    assert.equal(position(statement), location);
    const assignment = statement.expression;
    assert.equal(assignment.type, "AssignmentExpression");
    assert.equal(assignment.operator, "=");
    assert.equal(assignment.left.type, "MemberExpression");
    assert.equal(assignment.left.computed, false);
    assert.equal(assignment.left.object.name, "window");
    assert.equal(assignment.left.property.name, symbol);
    assert.equal(assignment.right.name, symbol);
    const withoutWindow = vm.createContext({});
    vm.runInContext(source, withoutWindow, { filename: currentPath });
    assert.deepEqual(Object.getOwnPropertyNames(withoutWindow), []);
    const withWindow = vm.createContext({ window: {} });
    vm.runInContext(source, withWindow, { filename: currentPath });
    assert.deepEqual(Object.keys(withWindow.window), [symbol]);
    assert.strictEqual(withWindow.window[symbol], vm.runInContext(symbol, withWindow));
    return Object.freeze({ kind: "guarded-window-class-exposure", currentPath,
      sourceSha256: sha(source), symbol, location,
      guardLocation: position(guard), assignmentTarget: `window.${symbol}`,
      evaluationCount: 1, globalPropertiesAddedWithoutWindow: [],
      windowPropertiesAdded: [symbol], otherTopLevelEffects: 0 });
  }
}

module.exports = { StageThreeReviewedEvaluationEffect };
