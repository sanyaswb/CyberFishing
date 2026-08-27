"use strict";

const crypto = require("node:crypto");
const espree = require("espree");
const estraverse = require("estraverse");
const { immutableRecord } = require("../guards/core/guard_models");

const FORBIDDEN_IDENTIFIERS = Object.freeze(new Set([
  "CONFIG",
  "window",
  "globalThis",
  "document",
  "localStorage",
  "sessionStorage",
  "Audio",
  "AudioContext",
  "CanvasRenderingContext2D",
  "__CYBER_FISHING_COMPAT_RUNTIME__",
]));

class RepresentationOnlyNamedEsmTarget {
  project({ source, currentPath, targetPath, exportName, sourceSha256 }) {
    this.#require(typeof source === "string", "classic source is required");
    this.#require(this.#sha256(source) === sourceSha256,
      `classic source fingerprint differs: ${currentPath}`);
    const declaration = `class ${exportName}`;
    this.#require(source.split(declaration).length - 1 === 1,
      `classic class declaration is not exact: ${currentPath}#${exportName}`);
    const targetSource = source.replace(declaration, `export class ${exportName}`);
    const validation = this.validate({
      source: targetSource,
      classicSource: source,
      currentPath,
      targetPath,
      exportName,
    });
    return immutableRecord({
      currentPath,
      targetPath,
      exportName,
      sourceSha256,
      targetSha256: this.#sha256(targetSource),
      targetSource,
      validation,
    });
  }

  validate({ source, classicSource, currentPath, targetPath, exportName }) {
    let tree;
    try {
      tree = espree.parse(source, {
        ecmaVersion: "latest",
        sourceType: "module",
        comment: true,
      });
    } catch (error) {
      throw new Error(`Representation target is not valid ESM: ${targetPath}: ${error.message}`);
    }
    const imports = tree.body.filter((node) => node.type === "ImportDeclaration");
    const exports = tree.body.filter((node) => node.type.startsWith("Export"));
    this.#require(imports.length === 0, `${targetPath} must remain dependency-free`);
    this.#require(exports.length === 1, `${targetPath} must have one direct named export`);
    this.#require(
      exports[0].type === "ExportNamedDeclaration" &&
      exports[0].source === null &&
      exports[0].declaration?.type === "ClassDeclaration" &&
      exports[0].declaration.id?.name === exportName,
      `${targetPath} named export differs from ${exportName}`,
    );
    const forbidden = new Set();
    let dynamicImportCount = 0;
    estraverse.traverse(tree, {
      fallback: "iteration",
      enter(node) {
        if (node.type === "ImportExpression") dynamicImportCount += 1;
        if (node.type === "Identifier" && FORBIDDEN_IDENTIFIERS.has(node.name)) {
          forbidden.add(node.name);
        }
      },
    });
    this.#require(dynamicImportCount === 0, `${targetPath} must not use dynamic import`);
    this.#require(forbidden.size === 0,
      `${targetPath} contains forbidden dependencies: ${[...forbidden].sort().join(", ")}`);
    const restoredClassic = source.replace(`export class ${exportName}`, `class ${exportName}`);
    this.#require(restoredClassic === classicSource,
      `${targetPath} changes behavior beyond the export token`);
    this.#require(!source.includes("__CYBER_FISHING_COMPAT_RUNTIME__"),
      `${targetPath} reads compatibility transport`);
    return immutableRecord({
      representation: "classic-class-declaration-to-named-esm-export-only",
      importCount: 0,
      exportCount: 1,
      dynamicImportCount: 0,
      forbiddenDependencyCount: 0,
      behaviorDelta: "none",
      stateOwnershipDelta: "none",
      allocationDelta: "none",
      currentPath,
      targetPath,
      exportName,
    });
  }

  #sha256(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
  }

  #require(condition, message) {
    if (!condition) throw new Error(`Stage 3 representation target failed: ${message}`);
  }
}

module.exports = { RepresentationOnlyNamedEsmTarget };
