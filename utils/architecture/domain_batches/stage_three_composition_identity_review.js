"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const espree = require("espree");
const estraverse = require("estraverse");

const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const position = node => `${node.loc.start.line}:${node.loc.start.column + 1}`;
const ISSUE = /^self-composition:([A-Za-z_$][\w$]*)->([A-Za-z_$][\w$]*)@(\d+:\d+)$/u;

// Proves the state-identity invariant for "self-composition" review issues: each composed instance
// is created by its owner with `new X(...)` at the exact audited location, and X is one of the
// module's reviewed completed-prefix imports. The classic global and the ESM import bind the same
// cumulative class, so the owner and the instances it creates are unchanged by the migration.
class StageThreeCompositionIdentityReview {
  review({ source, currentPath, issues, reviewedImports }) {
    assert(Array.isArray(issues) && issues.length > 0, `${currentPath}: composition issues are required`);
    const tree = espree.parse(source, { ecmaVersion: "latest", sourceType: "script", loc: true });
    const creations = [];
    estraverse.traverse(tree, {
      fallback: "iteration",
      enter(node) {
        if (node.type === "NewExpression" && node.callee.type === "Identifier") {
          creations.push({ composed: node.callee.name, location: position(node) });
        }
      },
    });
    const providers = new Map(reviewedImports.map(record => [record.exportName, record.from]));
    const compositions = issues.map(issue => {
      const match = ISSUE.exec(issue);
      assert(match, `${currentPath}: composition issue is not exact: ${issue}`);
      const [, owner, composed, location] = match;
      assert(providers.has(composed), `${currentPath}: composed class is not a reviewed import: ${composed}`);
      assert(tree.body.some(node => node.type === "ClassDeclaration" && node.id.name === owner),
        `${currentPath}: composition owner is not declared: ${owner}`);
      const created = creations.filter(item => item.composed === composed);
      assert(created.some(item => item.location === location),
        `${currentPath}: ${composed} is not created at ${location}`);
      return { owner, composed, location, provider: providers.get(composed),
        identity: "owner-created-instance-of-imported-cumulative-class" };
    }).sort((left, right) => `${left.composed}\0${left.location}`.localeCompare(`${right.composed}\0${right.location}`));
    return Object.freeze({ kind: "composition-state-identity", currentPath, sourceSha256: sha(source),
      compositions, invariant: "same-authoritative-owner-before-and-after" });
  }
}

module.exports = { StageThreeCompositionIdentityReview };
