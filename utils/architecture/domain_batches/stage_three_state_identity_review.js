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
      assert([undefined, "atomic-local"].includes(collection.replacement),
        `${currentPath}: unknown replacement rule for ${collection.field}`);
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
      assert.deepEqual(operations.map(item => item.location).sort(), [...calls, ...iterations].sort(),
        `${currentPath}: ${collection.field} is read without a direct method call`);
      const methods = [...new Set(operations.map(item => item.method))].sort();
      assert(methods.every(method => collection.allowedOperations.includes(method)),
        `${currentPath}: ${collection.field} uses unreviewed operations ${methods.join(", ")}`);
      const mutating = methods.filter(method => ["add", "set", "delete", "clear"].includes(method));
      if (collection.scope === "static") {
        assert.deepEqual(mutating, [], `${currentPath}: static collection must not be mutated`);
      }
      if (collection.replacement === "atomic-local") {
        assert.equal(collection.scope, "instance", `${currentPath}: only instance collections may be replaced`);
        assert(replacements.length > 0, `${currentPath}: ${collection.field} declares an unused replacement rule`);
      }
      return { owner: collection.owner, field: collection.field, scope: collection.scope,
        collection: collection.collection, creation: collection.scope === "static"
          ? "once-per-class-evaluation" : "once-per-instance",
        creationLocation: position(creation), operations, methods, mutatingMethods: mutating,
        escapes: 0, externalAccess: "impossible-private-field",
        derivedCache: false,
        ...(collection.replacement === "atomic-local" ? { replacement: "atomic-local", replacements } : {}) };
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

module.exports = { StageThreeStateIdentityReview };
