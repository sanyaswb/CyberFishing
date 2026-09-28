"use strict";

const assert = require("node:assert/strict");

// Evidence for removing reviewed blockers from a module the transition does not edit (owner decision
// 2026-09-28): the facts come from the re-observed Manifest, the architecture policy and the known-debt
// registry after the transition. Every confirmed dependency targets a boundary the module's target
// boundary may depend on (never DEV), no browser API or dynamic construct is observed, and no known
// architecture debt remains recorded for the module.
function buildReviewEvidence({ currentPath, manifest, policy, debtRegistry, sourceSha256 }) {
  const byPath = new Map(manifest.modules.map(module => [module.currentPath, module]));
  const module = byPath.get(currentPath);
  assert(module, `reviewed module is not in the Manifest: ${currentPath}`);
  const boundary = module.architecture?.targetBoundary;
  const rule = (policy.targetBoundaries || []).find(item => item.id === boundary);
  assert(rule, `reviewed module has no known target boundary: ${currentPath}`);
  const allowed = new Set([boundary, ...(rule.allowedDependencies || [])]);
  const dependencies = (module.analysis?.dependencies?.items || [])
    .filter(edge => edge.resolution === "confirmed")
    .map(edge => ({ target: edge.target, targetBoundary: byPath.get(edge.target)?.architecture?.targetBoundary ?? null }));
  for (const dependency of dependencies) {
    assert(dependency.targetBoundary && dependency.targetBoundary !== "dev" && allowed.has(dependency.targetBoundary),
      `reviewed module has a forbidden dependency: ${currentPath} -> ${dependency.target} (${dependency.targetBoundary})`);
  }
  const unresolved = [...(module.analysis?.dependencies?.unresolved || []), ...(module.analysis?.dependencies?.ambiguous || [])];
  assert.equal(unresolved.length, 0, `reviewed module has unresolved dependencies: ${currentPath}`);
  const environment = module.observed?.environment || {};
  assert.equal((environment.browserApis || []).length, 0, `reviewed module uses browser APIs: ${currentPath}`);
  assert.equal((environment.dynamicConstructs || []).length, 0, `reviewed module uses dynamic constructs: ${currentPath}`);
  const debts = (debtRegistry.debts || []).filter(debt => debt.source === currentPath).map(debt => debt.id);
  assert.equal(debts.length, 0, `reviewed module still has known architecture debt: ${currentPath} ${debts.join(", ")}`);
  assert.match(sourceSha256, /^[a-f0-9]{64}$/u, "reviewed module needs its source hash");
  return { sourceSha256, targetBoundary: boundary, dependencies: dependencies.sort((left, right) =>
    (left.target < right.target ? -1 : left.target > right.target ? 1 : 0)), browserApis: [], knownDebtIds: [] };
}

module.exports = { buildReviewEvidence };
