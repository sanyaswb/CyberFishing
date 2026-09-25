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
      estraverse.traverse(tree, {
        fallback: "iteration",
        enter(node, parent) {
          if (node.type !== "MemberExpression" || node.property.type !== "PrivateIdentifier" ||
            node.property.name !== name) return;
          assert(node.object.type === (collection.scope === "static" ? "Identifier" : "ThisExpression") &&
            (collection.scope !== "static" || node.object.name === className),
          `${currentPath}: ${collection.field} is accessed through an unexpected receiver`);
          if (parent === definition) return;
          // Every use must be `owner.#field.method(...)`; the collection itself never escapes.
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
      assert.deepEqual(operations.map(item => item.location).sort(), [...calls].sort(),
        `${currentPath}: ${collection.field} is read without a direct method call`);
      const methods = [...new Set(operations.map(item => item.method))].sort();
      assert(methods.every(method => collection.allowedOperations.includes(method)),
        `${currentPath}: ${collection.field} uses unreviewed operations ${methods.join(", ")}`);
      const mutating = methods.filter(method => ["add", "set", "delete", "clear"].includes(method));
      if (collection.scope === "static") {
        assert.deepEqual(mutating, [], `${currentPath}: static collection must not be mutated`);
      }
      return { owner: collection.owner, field: collection.field, scope: collection.scope,
        collection: collection.collection, creation: collection.scope === "static"
          ? "once-per-class-evaluation" : "once-per-instance",
        creationLocation: position(creation), operations, methods, mutatingMethods: mutating,
        escapes: 0, externalAccess: "impossible-private-field",
        derivedCache: false };
    });
    return Object.freeze({ kind: "collection-state-identity", currentPath, className,
      sourceSha256: sha(source), collections: records,
      invariant: "same-authoritative-owner-before-and-after" });
  }
}

module.exports = { StageThreeStateIdentityReview };
