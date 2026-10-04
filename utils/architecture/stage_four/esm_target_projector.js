"use strict";

const crypto = require("node:crypto");
const path = require("node:path");
const espree = require("espree");
const eslintScope = require("eslint-scope");
const { ModuleEvaluationEffectObserver } = require("../../build/compat_runtime/cumulative_side_effect_gate");

const LANGUAGE_BUILTINS = Object.freeze(["Array", "Boolean", "Date", "Error", "Float32Array", "Infinity", "JSON", "Map", "Math",
  "NaN", "Number", "Object", "Promise", "RangeError", "Reflect", "Set", "String", "Symbol", "TypeError", "WeakMap",
  "WeakSet", "isFinite", "isNaN", "parseFloat", "parseInt", "undefined"]);
// Identifiers no non-platform target may name (browser, DEV, raw config, transport); member names are allowed.
const FORBIDDEN_OUTSIDE_PLATFORM = Object.freeze(["window", "globalThis", "self", "document", "localStorage",
  "sessionStorage", "navigator", "CONFIG", "__CYBER_FISHING_COMPAT_RUNTIME__"]);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

// Boundary-aware classic → ESM projection (Stage 4): the target is the classic source with one `export `
// token before each exported top-level declaration and an import header; removing exactly those must give
// the classic bytes back. Stage 3 projectors stay untouched (they hard-code the Domain rules).
class StageFourEsmTargetProjector {
  project({ source, currentPath, targetPath, boundary, exports, imports = [], allowedGlobals = [] }) {
    const eol = source.includes("\r\n") ? "\r\n" : "\n";
    const tree = espree.parse(source, { ecmaVersion: "latest", sourceType: "script", range: true });
    const insertions = [];
    const providerMechanisms = [];
    for (const name of exports) {
      const nodes = tree.body.filter((node) => this.#declares(node, name));
      if (nodes.length !== 1) throw new Error(`${currentPath}: export ${name} needs exactly one top-level declaration`);
      insertions.push(nodes[0].range[0]);
      providerMechanisms.push(`${name}:${nodes[0].type === "FunctionDeclaration" ? "global-function" : "global-lexical"}`);
    }
    // A top-level exposure of an export (`globalThis.X = X;` or `if (typeof window !== "undefined") { window.X = X; }`)
    // moves into the activation shim, which writes the same object to the same global property.
    const exposures = [];
    for (const node of tree.body) {
      if (this.#isDeclaration(node)) continue;
      const exposure = this.#exposure(node, exports);
      if (!exposure) throw new Error(`${currentPath}: top-level ${node.type} is not a declaration (move it before migrating)`);
      let start = node.range[0];
      let end = node.range[1];
      const after = /^\r?\n/u.exec(source.slice(end));
      if (after) end += after[0].length;
      const blank = /(\r?\n)\r?\n$/u.exec(source.slice(0, start));
      if (blank) start -= blank[0].length - blank[1].length;
      exposures.push({ ...exposure, start, end });
    }
    const edits = [...insertions.map((offset) => ({ start: offset, end: offset, text: "export " })),
      ...exposures.map((item) => ({ start: item.start, end: item.end, text: "" }))].sort((left, right) => right.start - left.start);
    let body = source;
    for (const edit of edits) body = `${body.slice(0, edit.start)}${edit.text}${body.slice(edit.end)}`;
    let classicBody = source;
    for (const item of [...exposures].sort((left, right) => right.start - left.start)) {
      classicBody = `${classicBody.slice(0, item.start)}${classicBody.slice(item.end)}`;
    }
    const header = this.#header(targetPath, imports, eol);
    const targetSource = header + body;
    this.#assertRestores({ targetSource, header, source: classicBody, currentPath });
    const analysis = this.#analyze({ targetSource, targetPath, boundary, exports, imports, allowedGlobals });
    const evaluation = new ModuleEvaluationEffectObserver().observe({ modulePath: targetPath, source: targetSource });
    if (evaluation.classification === "unsafe") throw new Error(`${targetPath}: unsafe module evaluation`);
    return Object.freeze({ currentPath, targetPath, targetSource, sourceSha256: sha256(source),
      targetSha256: sha256(targetSource), analysis, evaluation, providerMechanisms,
      exposures: exposures.map(({ symbol, mechanism, text }) => ({ symbol, mechanism, text })) });
  }

  #exposure(node, exports) {
    const assignment = (statement, objects) => {
      const expression = statement?.type === "ExpressionStatement" ? statement.expression : null;
      return expression?.type === "AssignmentExpression" && expression.operator === "=" &&
        expression.left.type === "MemberExpression" && !expression.left.computed &&
        objects.includes(expression.left.object.name) && expression.right.type === "Identifier" &&
        expression.left.property.name === expression.right.name && exports.includes(expression.right.name)
        ? { symbol: expression.right.name, object: expression.left.object.name } : null;
    };
    const direct = assignment(node, ["globalThis"]);
    if (direct) return { symbol: direct.symbol, mechanism: "global-this-property", text: "globalThis" };
    const test = node.type === "IfStatement" && !node.alternate ? node.test : null;
    const guarded = test?.type === "BinaryExpression" && test.operator === "!==" && test.left.type === "UnaryExpression" &&
      test.left.operator === "typeof" && test.left.argument.name === "window" && test.right.value === "undefined" &&
      node.consequent.type === "BlockStatement" && node.consequent.body.length === 1
      ? assignment(node.consequent.body[0], ["window"]) : null;
    return guarded ? { symbol: guarded.symbol, mechanism: "window-property", text: "window-guarded" } : null;
  }

  #header(targetPath, imports, eol) {
    const byModule = new Map();
    for (const item of imports) {
      let specifier = path.posix.relative(path.posix.dirname(targetPath), item.from);
      if (!specifier.startsWith(".")) specifier = `./${specifier}`;
      byModule.set(specifier, [...(byModule.get(specifier) || []), item.symbol].sort());
    }
    const lines = [...byModule.entries()].map(([specifier, symbols]) =>
      `import { ${symbols.join(", ")} } from ${JSON.stringify(specifier)};`).sort((left, right) =>
      left.slice(9).localeCompare(right.slice(9)));
    return lines.length > 0 ? `${lines.join(eol)}${eol}${eol}` : "";
  }

  #assertRestores({ targetSource, header, source, currentPath }) {
    if (!targetSource.startsWith(header)) throw new Error(`${currentPath}: import header is not a prefix`);
    const restored = targetSource.slice(header.length).replace(/^(\uFEFF?)export (?=(class|const|let|function) )/gmu, "$1");
    if (restored !== source) throw new Error(`${currentPath}: target differs beyond export tokens and imports`);
  }

  #analyze({ targetSource, targetPath, boundary, exports, imports, allowedGlobals }) {
    const tree = espree.parse(targetSource, { ecmaVersion: "latest", sourceType: "module", tokens: true, range: true });
    const exported = tree.body.filter((node) => node.type === "ExportNamedDeclaration")
      .flatMap((node) => node.declaration.id ? [node.declaration.id.name]
        : node.declaration.declarations.map((item) => item.id.name)).sort();
    if (JSON.stringify(exported) !== JSON.stringify([...exports].sort())) {
      throw new Error(`${targetPath}: exports differ: ${exported.join(", ")}`);
    }
    const allowed = new Set([...LANGUAGE_BUILTINS, ...allowedGlobals]);
    const freeGlobals = [...new Set(eslintScope.analyze(tree, { ecmaVersion: 2022, sourceType: "module" })
      .globalScope.through.map((reference) => reference.identifier.name))].sort();
    const unexpected = freeGlobals.filter((name) => !allowed.has(name));
    if (unexpected.length > 0) throw new Error(`${targetPath}: reads classic or browser globals: ${unexpected.join(", ")}`);
    if (boundary !== "platform") {
      const forbidden = tree.tokens.filter((token, index) => token.type === "Identifier" &&
        FORBIDDEN_OUTSIDE_PLATFORM.includes(token.value) && tree.tokens[index - 1]?.value !== "." &&
        !(token.value === "CONFIG" && boundary === "game-config" && exports.includes("CONFIG")));
      if (forbidden.length > 0) throw new Error(`${targetPath}: names ${forbidden.map((token) => token.value).join(", ")}`);
    }
    return Object.freeze({ exports: exported, importCount: imports.length, freeGlobals });
  }

  #declares(node, name) {
    if (node.type === "ClassDeclaration" || node.type === "FunctionDeclaration") return node.id?.name === name;
    return node.type === "VariableDeclaration" && node.declarations.length === 1 &&
      node.declarations[0].id.type === "Identifier" && node.declarations[0].id.name === name;
  }

  #isDeclaration(node) {
    return ["ClassDeclaration", "FunctionDeclaration", "VariableDeclaration"].includes(node.type);
  }
}

module.exports = { LANGUAGE_BUILTINS, StageFourEsmTargetProjector };
