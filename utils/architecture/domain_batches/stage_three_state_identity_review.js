"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const espree = require("espree");
const estraverse = require("estraverse");

const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const position = node => `${node.loc.start.line}:${node.loc.start.column + 1}`;

// Proves the state-identity invariant for collection state flagged by the domain audit as
// "collection-state-requires-cache-review". Each reviewed collection must be a private class
// field created exactly once (per class evaluation for static fields, per instance for instance
// fields) whose every access is a direct method call from an allowed set. The collection never
// escapes its owner, so a representation-only ESM migration keeps the same authoritative owner.
// A collection reviewed with `replacement: "atomic-local"` may also be replaced as a whole, but
// only by the final statement of an instance method that assigns a complete `const` collection of
// the same type created empty in that method and read there only through direct method calls.
class StageThreeStateIdentityReview {
  review({ source, currentPath, className, collections }) {
    assert(Array.isArray(collections) && collections.length > 0,
      `${currentPath}: reviewed collections are required`);
    const tree = espree.parse(source, { ecmaVersion: "latest", sourceType: "script", loc: true, range: true });
    const declaration = tree.body.find(node => node.type === "ClassDeclaration" && node.id.name === className);
    assert(declaration, `${currentPath}: class ${className} is missing`);
    const records = collections.map(collection => {
      assert(collection.field.startsWith("#"), `${currentPath}: reviewed collection must be private`);
      const name = collection.field.slice(1);
      const expectedOwner = collection.scope === "static"
        ? `${className}.${name}` : `${className}#${name}`;
      assert.equal(collection.owner, expectedOwner, `${currentPath}: collection owner differs`);
      const definitions = declaration.body.body.filter(member => member.type === "PropertyDefinition" &&
        member.key.type === "PrivateIdentifier" && member.key.name === name);
      assert.equal(definitions.length, 1, `${currentPath}: ${collection.field} must be declared once`);
      const [definition] = definitions;
      assert.equal(definition.static, collection.scope === "static", `${currentPath}: scope differs`);
      const creation = definition.value;
      assert.equal(creation?.type, "NewExpression", `${currentPath}: ${collection.field} must be created in place`);
      assert.equal(creation.callee.type, "Identifier");
      assert.equal(creation.callee.name, collection.collection);
      const operations = [];
      const iterations = [];
      const replacements = [];
      assert([undefined, "atomic-local", "transactional-swap", "rebuilt-index"].includes(collection.replacement),
        `${currentPath}: unknown replacement rule for ${collection.field}`);
      const swaps = new Map();
      estraverse.traverse(tree, {
        fallback: "iteration",
        enter(node, parent) {
          if (node.type !== "MemberExpression" || node.property.type !== "PrivateIdentifier" ||
            node.property.name !== name) return;
          assert(node.object.type === (collection.scope === "static" ? "Identifier" : "ThisExpression") &&
            (collection.scope !== "static" || node.object.name === className),
          `${currentPath}: ${collection.field} is accessed through an unexpected receiver`);
          if (parent === definition) return;
          if (parent?.type === "AssignmentExpression" && parent.left === node &&
            collection.replacement === "atomic-local") {
            replacements.push(atomicLocalReplacement({ ancestors: this.parents(), assignment: parent,
              declaration, collection, currentPath }));
            return;
          }
          // Review queue 049 (owner-approved evidence rules): a transactional swap with rollback and a
          // derived index reset by the first statement of its rebuild method.
          if (collection.replacement === "transactional-swap" &&
            ((parent?.type === "AssignmentExpression" && parent.left === node) ||
              (parent?.type === "VariableDeclarator" && parent.init === node))) {
            const swap = transactionalSwap({ ancestors: this.parents(), declaration, collection, currentPath });
            swaps.set(swap.method, swap);
            return;
          }
          if (collection.replacement === "rebuilt-index" && parent?.type === "AssignmentExpression" &&
            parent.left === node) {
            replacements.push(rebuiltIndex({ ancestors: this.parents(), assignment: parent, declaration, collection,
              currentPath }));
            return;
          }
          // `for (... of owner.#field)` reads the collection in place without exposing it.
          if (parent?.type === "ForOfStatement" && parent.right === node) {
            operations.push({ method: "iterate", location: position(node) });
            iterations.push(position(node));
            return;
          }
          // Every other use must be `owner.#field.method(...)`; the collection never escapes.
          assert(parent?.type === "MemberExpression" && parent.object === node && !parent.computed &&
            parent.property.type === "Identifier", `${currentPath}: ${collection.field} escapes its owner`);
          operations.push({ method: parent.property.name, location: position(node) });
        },
      });
      // A second traversal records which call sites the member reads belong to.
      const calls = [];
      estraverse.traverse(tree, {
        fallback: "iteration",
        enter(node) {
          if (node.type === "CallExpression" && node.callee.type === "MemberExpression" &&
            node.callee.object.type === "MemberExpression" &&
            node.callee.object.property.type === "PrivateIdentifier" &&
            node.callee.object.property.name === name) calls.push(position(node.callee.object));
        },
      });
      // `owner.#field.size` (review queue 049) reads a number and never exposes the collection; it is
      // accepted only for Map/Set collections that list `size` among their reviewed operations.
      if (collection.allowedOperations.includes("size") && ["Map", "Set"].includes(collection.collection)) {
        estraverse.traverse(tree, {
          fallback: "iteration",
          enter(node, parent) {
            if (node.type === "MemberExpression" && !node.computed && node.property.type === "Identifier" &&
              node.property.name === "size" && node.object.type === "MemberExpression" &&
              node.object.property.type === "PrivateIdentifier" && node.object.property.name === name &&
              !(parent?.type === "CallExpression" && parent.callee === node) &&
              !(parent?.type === "AssignmentExpression" && parent.left === node)) calls.push(position(node.object));
          },
        });
      }
      assert.deepEqual(operations.map(item => item.location).sort(), [...calls, ...iterations].sort(),
        `${currentPath}: ${collection.field} is read without a direct method call`);
      const methods = [...new Set(operations.map(item => item.method))].sort();
      assert(methods.every(method => collection.allowedOperations.includes(method)),
        `${currentPath}: ${collection.field} uses unreviewed operations ${methods.join(", ")}`);
      const mutating = methods.filter(method => ["add", "set", "delete", "clear"].includes(method));
      if (collection.scope === "static") {
        assert.deepEqual(mutating, [], `${currentPath}: static collection must not be mutated`);
      }
      replacements.push(...swaps.values());
      if (collection.replacement !== undefined) {
        assert.equal(collection.scope, "instance", `${currentPath}: only instance collections may be replaced`);
        assert(replacements.length > 0, `${currentPath}: ${collection.field} declares an unused replacement rule`);
      }
      return { owner: collection.owner, field: collection.field, scope: collection.scope,
        collection: collection.collection, creation: collection.scope === "static"
          ? "once-per-class-evaluation" : "once-per-instance",
        creationLocation: position(creation), operations, methods, mutatingMethods: mutating,
        escapes: 0, externalAccess: "impossible-private-field",
        derivedCache: false,
        ...(collection.replacement !== undefined ? { replacement: collection.replacement, replacements } : {}) };
    });
    return Object.freeze({ kind: "collection-state-identity", currentPath, className,
      sourceSha256: sha(source), collections: records,
      invariant: "same-authoritative-owner-before-and-after" });
  }
}

// The only accepted reassignment: `this.#field = local;` as the final statement of an instance
// method whose body declares `const local = new <Collection>();` once and reads it only through
// direct method calls. The replacement is complete before it becomes visible, a throw while it is
// built leaves the previous collection in place, and neither collection ever escapes.
function atomicLocalReplacement({ ancestors, assignment, declaration, collection, currentPath }) {
  const fail = message => assert.fail(`${currentPath}: ${collection.field} ${message}`);
  const [method, fn, body, statement] = ancestors.slice(-5, -1);
  if (assignment.operator !== "=" || statement?.type !== "ExpressionStatement" ||
    body?.type !== "BlockStatement" || fn?.type !== "FunctionExpression" ||
    method?.type !== "MethodDefinition" || !declaration.body.body.includes(method) || method.static) {
    fail("escapes its owner");
  }
  if (body.body.at(-1) !== statement) fail("replacement is not the final statement of its method");
  if (assignment.right.type !== "Identifier") fail("replacement is not a local collection");
  const local = assignment.right.name;
  const creations = body.body.filter(item => item.type === "VariableDeclaration" && item.kind === "const" &&
    item.declarations.some(declarator => declarator.id.type === "Identifier" && declarator.id.name === local));
  if (creations.length !== 1 || creations[0].declarations.length !== 1) fail("replacement local is not one const");
  const [declarator] = creations[0].declarations;
  const creation = declarator.init;
  if (creation?.type !== "NewExpression" || creation.callee.type !== "Identifier" ||
    creation.callee.name !== collection.collection || creation.arguments.length !== 0) {
    fail(`replacement is not a new empty ${collection.collection}`);
  }
  const localOperations = [];
  estraverse.traverse(fn, {
    fallback: "iteration",
    enter(node, parent) {
      if (node.type !== "Identifier" || node.name !== local) return;
      if (parent?.type === "MemberExpression" && parent.property === node && !parent.computed) return;
      if (parent?.type === "Property" && parent.key === node && !parent.computed && !parent.shorthand) return;
      if (parent === declarator && declarator.id === node) return;
      if (parent === assignment && assignment.right === node) return;
      const call = this.parents().at(-2);
      if (parent?.type === "MemberExpression" && parent.object === node && !parent.computed &&
        parent.property.type === "Identifier" && call?.type === "CallExpression" && call.callee === parent) {
        localOperations.push(parent.property.name);
        return;
      }
      fail(`replacement local ${local} escapes or is shadowed at ${position(node)}`);
    },
  });
  const operations = [...new Set(localOperations)].sort();
  if (!operations.every(operation => collection.allowedOperations.includes(operation))) {
    fail(`replacement local uses unreviewed operations ${operations.join(", ")}`);
  }
  return { method: method.key.type === "PrivateIdentifier" ? `#${method.key.name}` : method.key.name,
    location: position(assignment), local, creationLocation: position(creation), operations,
    visibility: "complete-local-collection-assigned-by-final-statement" };
}

// The enclosing instance method of a field access and its function node.
function enclosingMethod(ancestors, declaration) {
  const index = ancestors.findLastIndex(node => node.type === "MethodDefinition");
  const method = ancestors[index];
  if (!method || method.static || !declaration.body.body.includes(method) || ancestors[index + 1] !== method.value) {
    return null;
  }
  return method;
}

const isField = (node, name) => node?.type === "MemberExpression" && node.object.type === "ThisExpression" &&
  node.property.type === "PrivateIdentifier" && node.property.name === name;
const methodName = method => method.key.type === "PrivateIdentifier" ? `#${method.key.name}` : method.key.name;

// Uses of a local identifier inside `fn`: `allowed(node, parent)` accepts the declaration and the reviewed
// reads; every other use must be a direct method call. Returns the called method names.
function localUses({ fn, local, allowed, fail }) {
  const operations = [];
  estraverse.traverse(fn, {
    fallback: "iteration",
    enter(node, parent) {
      if (node.type !== "Identifier" || node.name !== local) return;
      if (parent?.type === "MemberExpression" && parent.property === node && !parent.computed) return;
      if (parent?.type === "Property" && parent.key === node && !parent.computed && !parent.shorthand) return;
      if (allowed(node, parent)) return;
      const call = this.parents().at(-2);
      if (parent?.type === "MemberExpression" && parent.object === node && !parent.computed &&
        parent.property.type === "Identifier" && call?.type === "CallExpression" && call.callee === parent) {
        operations.push(parent.property.name);
        return;
      }
      fail(`local ${local} escapes or is shadowed at ${position(node)}`);
    },
  });
  return [...new Set(operations)].sort();
}

// `transactional-swap`: inside one instance method, `const previous = this.#field;` is directly followed by
// `this.#field = local;` (a complete `const local = new <Collection>()` built earlier in that method and read
// only through direct method calls) and by a final `try` whose `catch (error)` starts with
// `this.#field = previous;` and ends with `throw error;`. `previous` is read only by that restore, so the
// owner holds either the old or the new complete collection and neither escapes the method.
function transactionalSwap({ ancestors, declaration, collection, currentPath }) {
  const fail = message => assert.fail(`${currentPath}: ${collection.field} ${message}`);
  const name = collection.field.slice(1);
  const method = enclosingMethod(ancestors, declaration);
  if (!method) fail("escapes its owner");
  const fn = method.value;
  const body = fn.body.body;
  const saveIndex = body.findIndex(statement => statement.type === "VariableDeclaration" &&
    statement.kind === "const" && statement.declarations.length === 1 &&
    statement.declarations[0].id.type === "Identifier" && isField(statement.declarations[0].init, name));
  if (saveIndex < 0) fail("swap does not save the previous collection in one const");
  const [saved] = body[saveIndex].declarations;
  const previous = saved.id.name;
  const install = body[saveIndex + 1];
  const tryStatement = body[saveIndex + 2];
  if (install?.type !== "ExpressionStatement" || install.expression.type !== "AssignmentExpression" ||
    install.expression.operator !== "=" || !isField(install.expression.left, name) ||
    install.expression.right.type !== "Identifier") fail("swap does not install a local collection next");
  const local = install.expression.right.name;
  if (tryStatement?.type !== "TryStatement" || body.at(-1) !== tryStatement || tryStatement.finalizer ||
    tryStatement.handler?.param?.type !== "Identifier") fail("swap is not followed by a final try/catch");
  const handler = tryStatement.handler;
  const [restore] = handler.body.body;
  const rethrow = handler.body.body.at(-1);
  if (restore?.type !== "ExpressionStatement" || restore.expression.type !== "AssignmentExpression" ||
    restore.expression.operator !== "=" || !isField(restore.expression.left, name) ||
    restore.expression.right.type !== "Identifier" || restore.expression.right.name !== previous) {
    fail("catch does not first restore the previous collection");
  }
  if (rethrow?.type !== "ThrowStatement" || rethrow.argument.type !== "Identifier" ||
    rethrow.argument.name !== handler.param.name) fail("catch does not rethrow the caught error");
  const creations = body.slice(0, saveIndex).filter(statement => statement.type === "VariableDeclaration" &&
    statement.kind === "const" && statement.declarations.some(declarator => declarator.id.type === "Identifier" &&
      declarator.id.name === local));
  if (creations.length !== 1 || creations[0].declarations.length !== 1) fail("swap local is not one earlier const");
  const [declarator] = creations[0].declarations;
  const creation = declarator.init;
  if (creation?.type !== "NewExpression" || creation.callee.type !== "Identifier" ||
    creation.callee.name !== collection.collection || creation.arguments.length !== 0) {
    fail(`swap local is not a new empty ${collection.collection}`);
  }
  const operations = localUses({ fn, local, fail, allowed: (node, parent) =>
    (parent === declarator && declarator.id === node) || (parent === install.expression && parent.right === node) });
  if (!operations.every(operation => collection.allowedOperations.includes(operation))) {
    fail(`swap local uses unreviewed operations ${operations.join(", ")}`);
  }
  const previousOperations = localUses({ fn, local: previous, fail, allowed: (node, parent) =>
    (parent === saved && saved.id === node) || (parent === restore.expression && parent.right === node) });
  if (previousOperations.length > 0) fail(`previous collection ${previous} is read`);
  // The only field accesses this rule accepts in the method: save, install and restore.
  const accepted = new Set([saved.init, install.expression.left, restore.expression.left]);
  const node = ancestors.at(-1).type === "VariableDeclarator" ? ancestors.at(-1).init : ancestors.at(-1).left;
  if (!accepted.has(node)) fail(`is reassigned outside its reviewed swap at ${position(node)}`);
  return { method: methodName(method), location: position(install.expression), local, previous,
    creationLocation: position(creation), operations, restoreLocation: position(restore.expression),
    visibility: "complete-local-collection-swapped-with-rollback" };
}

// `rebuilt-index`: `this.#field = new <Collection>();` (no arguments) is the first statement of an instance
// method that rebuilds the derived index; every other use is a direct method call.
function rebuiltIndex({ ancestors, assignment, declaration, collection, currentPath }) {
  const fail = message => assert.fail(`${currentPath}: ${collection.field} ${message}`);
  const method = enclosingMethod(ancestors, declaration);
  const statement = ancestors.at(-2);
  if (!method || assignment.operator !== "=" || statement?.type !== "ExpressionStatement" ||
    method.value.body.body[0] !== statement) fail("index reset is not the first statement of its method");
  const creation = assignment.right;
  if (creation?.type !== "NewExpression" || creation.callee.type !== "Identifier" ||
    creation.callee.name !== collection.collection || creation.arguments.length !== 0) {
    fail(`index reset is not a new empty ${collection.collection}`);
  }
  return { method: methodName(method), location: position(assignment), creationLocation: position(creation),
    visibility: "derived-index-reset-by-first-statement-of-rebuild" };
}

module.exports = { StageThreeStateIdentityReview };
