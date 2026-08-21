const fs = require("node:fs");
const path = require("node:path");
const espree = require("espree");
const estraverse = require("estraverse");

class EsmFixtureGraphInspector {
  constructor({ fixtureRoot }) { this.fixtureRoot = path.resolve(fixtureRoot); }

  inspect(entryPath) {
    const pending = [path.resolve(entryPath)];
    const visited = new Set();
    const mechanisms = new Set();
    let namedExports = 0;
    while (pending.length > 0) {
      const currentPath = pending.shift();
      if (visited.has(currentPath)) continue;
      this.#assertInsideFixture(currentPath);
      const source = fs.readFileSync(currentPath, "utf8");
      const tree = espree.parse(source, { ecmaVersion: "latest", sourceType: "module", loc: true, range: true });
      estraverse.traverse(tree, {
        enter: (node) => {
          if (node.type === "ImportDeclaration") this.#registerDependency(node.source, "static-import", currentPath, pending, mechanisms);
          if ((node.type === "ExportNamedDeclaration" || node.type === "ExportAllDeclaration") && node.source) this.#registerDependency(node.source, "re-export", currentPath, pending, mechanisms);
          if (node.type === "ImportExpression") this.#registerDependency(node.source, "dynamic-import", currentPath, pending, mechanisms);
          if (node.type === "ExportNamedDeclaration") namedExports += 1;
          if (node.type === "ExportDefaultDeclaration" || node.type === "ExportAllDeclaration") throw new Error(`${currentPath}: fixture permits named exports only`);
          if (node.type === "AssignmentExpression" && this.#isGlobalTarget(node.left)) throw new Error(`${currentPath}: fixture cannot export through window/globalThis`);
        },
      });
      visited.add(currentPath);
    }
    if (!mechanisms.has("static-import") || !mechanisms.has("dynamic-import")) throw new Error("ESM fixture graph must cover static and dynamic imports");
    if (namedExports === 0) throw new Error("ESM fixture graph must cover named exports");
    return Object.freeze({ files: [...visited].sort(), mechanisms: [...mechanisms].sort(), namedExports });
  }

  #registerDependency(sourceNode, mechanism, importer, pending, mechanisms) {
    const specifier = this.#readStaticSpecifier(sourceNode);
    if (!specifier) throw new Error(`${importer}: dynamic import must use a static literal`);
    if (!specifier.startsWith(".") || !specifier.endsWith(".js")) throw new Error(`${importer}: fixture imports must be relative with explicit .js`);
    const target = path.resolve(path.dirname(importer), specifier);
    this.#assertInsideFixture(target);
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) throw new Error(`${importer}: fixture dependency is missing: ${specifier}`);
    mechanisms.add(mechanism);
    pending.push(target);
  }

  #readStaticSpecifier(node) {
    if (node?.type === "Literal" && typeof node.value === "string") return node.value;
    if (node?.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0].value.cooked;
    return null;
  }

  #assertInsideFixture(candidate) {
    const relative = path.relative(this.fixtureRoot, candidate);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`ESM fixture graph escaped its boundary: ${candidate}`);
  }

  #isGlobalTarget(node) {
    return node?.type === "MemberExpression" && node.object?.type === "Identifier" && ["window", "globalThis"].includes(node.object.name);
  }
}

module.exports = { EsmFixtureGraphInspector };
