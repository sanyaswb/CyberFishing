"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const vm = require("node:vm");
const espree = require("espree");
const { isInertLiteral } = require("./stage_three_inert_literal");

const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const position = node => `${node.loc.start.line}:${node.loc.start.column + 1}`;

class StageThreeReviewedEvaluationEffect {
  parse(source) {
    return espree.parse(source, { ecmaVersion: "latest", sourceType: "script", loc: true, range: true });
  }

  // Reviews top-level constants initialized by Object.freeze over inert literals (arrays of
  // string/numeric literals or plain objects with string literal values), followed by exactly one
  // class. Two numeric pairs keep the historical "frozen-literal-ranges" kind.
  frozenConstants({ source, currentPath, className, classNames = null, bindings }) {
    const tree = this.parse(source);
    const names = Object.keys(bindings);
    const classes = classNames || [className];
    assert(names.length > 0, `${currentPath}: frozen constants are required`);
    assert(classes.length > 0 && (!classNames || !className),
      `${currentPath}: name either one class or several classes`);
    assert.equal(tree.body.length, names.length + classes.length,
      `${currentPath}: expected ${names.length} constants and ${classes.length} classes`);
    let ranges = names.length === 2;
    for (let index = 0; index < names.length; index += 1) {
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
      const literal = call.arguments[0];
      if (literal.type === "ArrayExpression") {
        assert(literal.elements.every(isInertLiteral),
          `${currentPath}: constant array must contain string or numeric literals`);
        ranges &&= literal.elements.length === 2 && literal.elements.every(element =>
          element.type === "UnaryExpression" || typeof element.value === "number");
      } else {
        assert.equal(literal.type, "ObjectExpression", `${currentPath}: constant must be a literal`);
        ranges = false;
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
      assert.equal(position(call), bindings[expected].location);
    }
    classes.forEach((name, index) => {
      const declaration = tree.body[names.length + index];
      assert.equal(declaration.type, "ClassDeclaration");
      assert.equal(declaration.id.name, name);
      assert.equal(declaration.superClass, null, `${currentPath}: superclass requires review`);
    });
    const context = vm.createContext({});
    vm.runInContext(source, context, { filename: currentPath });
    assert.deepEqual(Object.getOwnPropertyNames(context), [], "Frozen constants created globals");
    for (const [name, contract] of Object.entries(bindings)) {
      assert.equal(vm.runInContext(`Object.isFrozen(${name})`, context), true);
      const value = vm.runInContext(name, context);
      assert.deepEqual(Array.isArray(value) ? Array.from(value) : { ...value }, contract.values);
    }
    return Object.freeze({ kind: ranges ? "frozen-literal-ranges" : "frozen-literal-constants",
      currentPath, sourceSha256: sha(source),
      ...(classNames ? { classNames } : { className }), bindings,
      topLevelStatementCount: names.length + classes.length,
      evaluationCount: 1, globalPropertiesAdded: [], otherTopLevelEffects: 0 });
  }

  // Reviews a class whose only evaluation-time effects are static fields initialized by
  // Object.freeze over string literal objects or string/numeric literal arrays. No other top-level code
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
        assert(literal.elements.every(isInertLiteral),
          `${currentPath}: static array must contain string or numeric literals`);
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

  // Reviews N class declarations followed by one exact `globalThis.X = X` per class. A class may
  // extend only a class declared earlier in the same module; evaluation must create exactly the
  // exposed globals.
  classFamily({ source, currentPath, classes, localSuperclasses = {}, exposures }) {
    const tree = this.parse(source);
    assert(classes.length > 1, `${currentPath}: a class family needs several classes`);
    assert.deepEqual(exposures.map(item => item.symbol).sort(), [...classes].sort(),
      `${currentPath}: every class needs exactly one reviewed exposure`);
    assert.equal(tree.body.length, classes.length + exposures.length,
      `${currentPath}: expected class declarations followed by global exposures`);
    for (const name of Object.keys(localSuperclasses)) assert(classes.includes(name));
    classes.forEach((name, index) => {
      const declaration = tree.body[index];
      assert.equal(declaration.type, "ClassDeclaration");
      assert.equal(declaration.id.name, name);
      const parent = localSuperclasses[name];
      if (parent) {
        assert.equal(declaration.superClass?.type, "Identifier");
        assert.equal(declaration.superClass.name, parent);
        const parentIndex = classes.indexOf(parent);
        assert(parentIndex >= 0 && parentIndex < index, `${currentPath}: superclass must be declared earlier`);
      } else {
        assert.equal(declaration.superClass, null, `${currentPath}: superclass requires review`);
      }
    });
    exposures.forEach(({ symbol, location }, index) => {
      const statement = tree.body[classes.length + index];
      assert.equal(statement.type, "ExpressionStatement");
      assert.equal(position(statement), location);
      const assignment = statement.expression;
      assert.equal(assignment.type, "AssignmentExpression");
      assert.equal(assignment.operator, "=");
      assert.equal(assignment.left.type, "MemberExpression");
      assert.equal(assignment.left.computed, false);
      assert.equal(assignment.left.object.type, "Identifier");
      assert.equal(assignment.left.object.name, "globalThis");
      assert.equal(assignment.left.property.name, symbol);
      assert.equal(assignment.right.type, "Identifier");
      assert.equal(assignment.right.name, symbol);
    });
    const context = vm.createContext({});
    vm.runInContext(source, context, { filename: currentPath });
    const evaluatedGlobalNames = Object.getOwnPropertyNames(context).sort();
    assert.deepEqual(evaluatedGlobalNames, [...classes].sort(),
      `${currentPath}: source evaluation changed unexpected globals`);
    for (const name of classes) {
      assert.equal(typeof context[name], "function");
      assert.equal(context[name].name, name);
      const parent = localSuperclasses[name];
      if (parent) assert.equal(Object.getPrototypeOf(context[name]), context[parent]);
    }
    return Object.freeze({ kind: "class-family-global-exposures", currentPath,
      sourceSha256: sha(source), classes, localSuperclasses, exposures,
      topLevelStatementCount: tree.body.length, evaluatedGlobalNames,
      evaluationCount: 1, otherTopLevelEffects: 0 });
  }

  // Reviews one class whose only static members are private fields initialized by
  // `new Set([...inert literals])`, optionally followed by one exact `globalThis.X = X`.
  privateStaticSets({ source, currentPath, className, bindings, exposure = null }) {
    const tree = this.parse(source);
    const names = Object.keys(bindings);
    assert(names.length > 0 && names.every(name => name.startsWith("#")),
      `${currentPath}: private static set bindings are required`);
    assert.equal(tree.body.length, exposure ? 2 : 1,
      `${currentPath}: expected one class${exposure ? " and one global exposure" : ""}`);
    const declaration = tree.body[0];
    assert.equal(declaration.type, "ClassDeclaration");
    assert.equal(declaration.id.name, className);
    assert.equal(declaration.superClass, null, `${currentPath}: superclass requires review`);
    const statics = declaration.body.body.filter(member => member.static);
    assert.deepEqual(statics.map(member => member.type), names.map(() => "PropertyDefinition"),
      `${currentPath}: unexpected static member or static block`);
    assert.deepEqual(statics.map(member => `#${member.key.name}`), names,
      `${currentPath}: static field order differs`);
    for (const member of statics) {
      assert.equal(member.key.type, "PrivateIdentifier", `${currentPath}: static set must be private`);
      assert.equal(member.computed, false);
      const creation = member.value;
      assert.equal(creation?.type, "NewExpression");
      assert.equal(creation.callee.type, "Identifier");
      assert.equal(creation.callee.name, "Set");
      assert.equal(creation.arguments.length, 1);
      const [literal] = creation.arguments;
      assert.equal(literal.type, "ArrayExpression");
      assert(literal.elements.every(isInertLiteral), `${currentPath}: set must contain literals`);
      const contract = bindings[`#${member.key.name}`];
      assert.equal(position(creation), contract.location);
      assert.deepEqual(literal.elements.map(element => element.type === "UnaryExpression"
        ? -element.argument.value : element.value), contract.values);
    }
    if (exposure) {
      const statement = tree.body[1];
      assert.equal(statement.type, "ExpressionStatement");
      assert.equal(position(statement), exposure.location);
      const assignment = statement.expression;
      assert.equal(assignment.type, "AssignmentExpression");
      assert.equal(assignment.operator, "=");
      assert.equal(assignment.left.type, "MemberExpression");
      assert.equal(assignment.left.computed, false);
      assert.equal(assignment.left.object.name, "globalThis");
      assert.equal(assignment.left.property.name, className);
      assert.equal(exposure.symbol, className);
      assert.equal(assignment.right.type, "Identifier");
      assert.equal(assignment.right.name, className);
    }
    const context = vm.createContext({});
    vm.runInContext(source, context, { filename: currentPath });
    assert.deepEqual(Object.getOwnPropertyNames(context), exposure ? [className] : [],
      `${currentPath}: source evaluation changed unexpected globals`);
    return Object.freeze({ kind: "private-static-literal-sets", currentPath, sourceSha256: sha(source),
      className, bindings, exposure, topLevelStatementCount: tree.body.length,
      evaluationCount: 1, globalPropertiesAdded: exposure ? [className] : [], otherTopLevelEffects: 0 });
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
