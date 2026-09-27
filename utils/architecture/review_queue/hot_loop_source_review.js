"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const espree = require("espree");
const eslintScope = require("eslint-scope");
const { StageThreeBatchSourceObserver } = require("../domain_batches/stage_three_batch_source_observer");

const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const position = node => `${node.loc.start.line}:${node.loc.start.column + 1}`;
const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

// Language built-ins a Domain method may read without a compatibility lookup.
const BUILTINS = new Set(["Array", "Boolean", "Error", "Infinity", "JSON", "Map", "Math", "NaN", "Number",
  "Object", "RangeError", "Set", "String", "Symbol", "TypeError", "WeakMap", "WeakSet", "isFinite",
  "isNaN", "parseFloat", "parseInt", "undefined"]);
// Time sources other than the caller's deltaTime.
const WALL_CLOCK = new Set(["Date", "performance", "setTimeout", "setInterval", "requestAnimationFrame",
  "cancelAnimationFrame", "queueMicrotask"]);
// Names that reach the browser realm or the compatibility transport instead of a module binding.
const REALM_LOOKUPS = new Set(["window", "globalThis", "self", "__CYBER_FISHING_COMPAT_RUNTIME__"]);

// Static hot-loop review of one classic Domain source: for every class member it records the exact
// body fingerprint and allocation sites (the migration must keep both unchanged), every free
// identifier with its member, every non-deltaTime time source, every realm lookup and every typeof availability check of an
// unresolved (global) name.
class StageThreeHotLoopSourceReview {
  constructor({ observer = new StageThreeBatchSourceObserver() } = {}) {
    this.observer = observer;
  }

  // `sourceType: "module"` reviews the exported class of an ESM target the same way, so its member
  // fingerprints and allocation sites compare directly with the classic record.
  review({ source, currentPath, className, sourceType = "script" }) {
    const tree = espree.parse(source, { ecmaVersion: "latest", sourceType, loc: true, range: true });
    const declaration = tree.body.map(node => (node.type === "ExportNamedDeclaration" ? node.declaration : node))
      .find(node => node?.type === "ClassDeclaration" && node.id.name === className);
    assert(declaration, `${currentPath}: class ${className} is missing`);
    const observed = this.observer.observe(sourceType === "script" ? source
      : source.slice(declaration.range[0], declaration.range[1]), currentPath);
    const allocations = new Map(observed.methods.map(method => [`${method.kind}\0${method.name}`, method.allocations]));
    const memberName = key => key.type === "PrivateIdentifier" ? `#${key.name}` : key.name;
    const members = declaration.body.body.map(member => ({
      node: member,
      name: memberName(member.key),
      kind: member.type === "MethodDefinition" ? member.kind : "field",
      isStatic: member.static === true,
    }));
    const enclosing = node => members.find(member =>
      member.node.range[0] <= node.range[0] && node.range[1] <= member.node.range[1]) || null;
    const scope = eslintScope.analyze(tree, { ecmaVersion: 2022, sourceType });
    const free = [];
    const unresolved = new Set(scope.globalScope.through.map(reference => reference.identifier));
    for (const reference of scope.globalScope.through) {
      const identifier = reference.identifier;
      const member = enclosing(identifier);
      if (!member || identifier.name === className) continue;
      free.push({ name: identifier.name, member: member.name, kind: member.kind, location: position(identifier) });
    }
    const typeofLookups = [];
    const visit = (node, parent) => {
      if (!node || typeof node.type !== "string") return;
      if (node.type === "UnaryExpression" && node.operator === "typeof" && unresolved.has(node.argument)) {
        const member = enclosing(node);
        if (member) typeofLookups.push({ name: node.argument.name, member: member.name, location: position(node) });
      }
      for (const [key, value] of Object.entries(node)) {
        if (key === "parent" || key === "loc" || key === "range") continue;
        if (Array.isArray(value)) value.forEach(child => visit(child, node));
        else if (value && typeof value.type === "string") visit(value, node);
      }
    };
    visit(declaration, null);
    const byName = names => free.filter(item => names.has(item.name));
    const composition = free.filter(item => !BUILTINS.has(item.name) && !WALL_CLOCK.has(item.name) &&
      !REALM_LOOKUPS.has(item.name));
    const hotMembers = members.filter(member => member.kind === "method" || member.kind === "get" ||
      member.kind === "set");
    const record = {
      currentPath,
      className,
      sourceSha256: sha(source),
      members: members.map(member => ({
        name: member.name,
        kind: member.kind,
        static: member.isStatic,
        bodySha256: sha(source.slice(member.node.range[0], member.node.range[1])),
        ...(member.kind === "field" ? {} : {
          parameters: member.node.value.params.length,
          allocations: allocations.get(`${member.kind}\0${member.name}`),
        }),
      })),
      freeIdentifiers: free.sort((left, right) => compare(`${left.member}\0${left.location}`,
        `${right.member}\0${right.location}`)),
      wallClockReads: byName(WALL_CLOCK),
      realmLookups: byName(REALM_LOOKUPS),
      typeofLookups,
      forbiddenReads: [...observed.forbiddenReads],
      classProviderReads: composition,
      hotMemberProviderReads: composition.filter(item => hotMembers.some(member => member.name === item.member)),
      allocationTotals: observed.allocationTotals,
    };
    record.proofs = {
      noWallClockTimeSource: record.wallClockReads.length === 0,
      noRealmOrTransportLookupInClass: record.realmLookups.length === 0 && record.forbiddenReads.length === 0,
      noTypeofAvailabilityLookupInClass: record.typeofLookups.length === 0,
      classProvidersOnlyOutsideHotMembers: record.hotMemberProviderReads.length === 0,
    };
    return record;
  }
}

module.exports = { StageThreeHotLoopSourceReview, BUILTINS, WALL_CLOCK, REALM_LOOKUPS };
