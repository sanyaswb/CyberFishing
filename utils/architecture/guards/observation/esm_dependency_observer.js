const fs = require("node:fs");
const path = require("node:path");
const espree = require("espree");
const estraverse = require("estraverse");
const eslintScope = require("eslint-scope");
const { EsmDependencyObservation, immutableRecord } = require("../core/guard_models");

class RelativeProjectSpecifierResolver {
  constructor(projectRoot) { this.projectRoot = projectRoot; }
  resolve(source, specifier) {
    if (/^(?:https?:|data:|blob:)/.test(specifier)) return { status: "external-url", target: null };
    if (specifier.startsWith("/") || specifier.startsWith("#")) return { status: "unsupported-specifier", target: null };
    if (!specifier.startsWith(".")) return { status: "external-package", target: null };
    const sourceAbsolute = path.resolve(this.projectRoot, source);
    const targetAbsolute = path.resolve(path.dirname(sourceAbsolute), specifier);
    const relative = path.relative(this.projectRoot, targetAbsolute).replaceAll("\\", "/");
    if (relative.startsWith("../") || path.isAbsolute(relative)) return { status: "unsupported-specifier", target: null };
    if (!fs.existsSync(targetAbsolute) || !fs.statSync(targetAbsolute).isFile()) return { status: "missing-project", target: relative };
    return { status: "confirmed-project", target: relative };
  }
}

class EsmDependencyObserver {
  constructor({ projectRoot, resolver = new RelativeProjectSpecifierResolver(projectRoot) }) {
    this.projectRoot = projectRoot;
    this.resolver = resolver;
  }

  observeFile(sourcePath, sourceText = null) {
    const text = sourceText ?? fs.readFileSync(path.resolve(this.projectRoot, sourcePath), "utf8");
    const parsed = this.#parse(text);
    if (parsed.status === "failed") return immutableRecord({ source: sourcePath, status: "failed", hasEsmSyntax: false, observations: [], exports: [], globalAssignments: [], externalIdentifiers: [], globalMemberReads: [], issues: [parsed.issue] });
    const observations = [];
    const exports = [];
    const globalAssignments = [];
    const globalMemberReads = [];
    const assignmentTargetRanges = new Set();
    let hasEsmSyntax = false;
    estraverse.traverse(parsed.tree, {
      enter: (node) => {
        if (["ImportDeclaration", "ExportNamedDeclaration", "ExportDefaultDeclaration", "ExportAllDeclaration", "ImportExpression"].includes(node.type)) hasEsmSyntax = true;
        if (node.type === "ImportDeclaration") {
          const mechanism = node.specifiers.length === 0 ? "side-effect-import" : "static-import";
          observations.push(this.#observation(sourcePath, node.source, mechanism));
        } else if ((node.type === "ExportNamedDeclaration" || node.type === "ExportAllDeclaration") && node.source) {
          observations.push(this.#observation(sourcePath, node.source, "re-export"));
        } else if (node.type === "ImportExpression") {
          observations.push(this.#observation(sourcePath, node.source, "dynamic-import"));
        }
        if (node.type === "ExportDefaultDeclaration") exports.push({ kind: "default", location: this.#location(node) });
        if (node.type === "ExportAllDeclaration") exports.push({ kind: "barrel", location: this.#location(node) });
        if (node.type === "ExportNamedDeclaration") exports.push({ kind: "named", location: this.#location(node) });
        if (node.type === "AssignmentExpression" && this.#isGlobalMember(node.left)) {
          assignmentTargetRanges.add(node.left.range.join(":"));
          globalAssignments.push({ symbol: this.#memberName(node.left), mechanism: node.left.object.name === "window" ? "window-property" : "global-this-property", location: this.#location(node) });
        }
        if (this.#isGlobalMember(node) && !assignmentTargetRanges.has(node.range.join(":"))) globalMemberReads.push({ identifier: this.#memberName(node), location: this.#location(node) });
      },
      fallback: "iteration",
    });
    const scopeManager = eslintScope.analyze(parsed.tree, { ecmaVersion: 2026, sourceType: parsed.sourceType, optimistic: true, ignoreEval: false, nodejsScope: false });
    const externalIdentifiers = [...new Set(scopeManager.globalScope.through.map((reference) => reference.identifier.name))].sort();
    const status = observations.some((item) => ["dynamic-unresolved", "unsupported-specifier"].includes(item.resolutionStatus)) ? "partial" : "verified";
    return immutableRecord({ source: sourcePath, status, hasEsmSyntax, observations: observations.sort(this.#compareObservation), exports, globalAssignments, externalIdentifiers, globalMemberReads, issues: [] });
  }

  #parse(text) {
    const options = { ecmaVersion: "latest", loc: true, range: true };
    try { return { status: "parsed", sourceType: "script", tree: espree.parse(text, { ...options, sourceType: "script" }) }; }
    catch (scriptError) {
      try { return { status: "parsed", sourceType: "module", tree: espree.parse(text, { ...options, sourceType: "module" }) }; }
      catch (moduleError) { return { status: "failed", issue: { code: "parse-failure", message: moduleError.message, line: moduleError.lineNumber || null, column: moduleError.column || null } }; }
    }
  }

  #observation(source, node, mechanism) {
    const literal = this.#literalSpecifier(node);
    const specifier = literal.value;
    let resolution = literal.static ? this.resolver.resolve(source, specifier) : { status: "dynamic-unresolved", target: null };
    return new EsmDependencyObservation({
      source, specifier, resolvedTarget: resolution.target, mechanism,
      resolutionStatus: resolution.status, location: this.#location(node),
      specifierKind: !literal.static ? "dynamic" : specifier.startsWith(".") ? "relative" : /^(?:https?:|data:|blob:)/.test(specifier) ? "url" : "bare",
      hasExplicitJsExtension: literal.static && specifier.endsWith(".js"),
    });
  }

  #literalSpecifier(node) {
    if (node?.type === "Literal" && typeof node.value === "string") return { static: true, value: node.value };
    if (node?.type === "TemplateLiteral" && node.expressions.length === 0) return { static: true, value: node.quasis[0].value.cooked };
    return { static: false, value: "<dynamic>" };
  }
  #isGlobalMember(node) { return node?.type === "MemberExpression" && !node.computed && node.object?.type === "Identifier" && ["window", "globalThis"].includes(node.object.name); }
  #memberName(node) { return node.property?.name || "<dynamic>"; }
  #location(node) { return node?.loc ? { line: node.loc.start.line, column: node.loc.start.column + 1 } : null; }
  #compareObservation(a, b) { return [a.source, a.location?.line || 0, a.location?.column || 0, a.mechanism].join("\u0000").localeCompare([b.source, b.location?.line || 0, b.location?.column || 0, b.mechanism].join("\u0000")); }
}

module.exports = { EsmDependencyObserver, RelativeProjectSpecifierResolver };
