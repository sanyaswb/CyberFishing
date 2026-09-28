"use strict";

// Negative and positive fixtures of the reviewed prerequisite-transition extensions: Manifest updates
// (reclassification and blocker removal only, only for modules the transition edits) and global
// provider additions (the exact baseline changes by exactly the declared, observed providers).
const assert = require("node:assert/strict");
const { PrerequisiteManifestUpdatePlan } = require("./stage_three_prerequisites/lifecycle/manifest_update_plan");
const { PrerequisiteGlobalProviderAdditionPlan } = require("./stage_three_prerequisites/lifecycle/global_provider_addition_plan");
const { buildReviewEvidence } = require("./stage_three_prerequisites/lifecycle/review_evidence");

const clone = value => JSON.parse(JSON.stringify(value));
const MIXED = "mixed-responsibility-requires-decomposition";
const manifestEntry = (currentPath, blockers, extra = {}) => ({ currentPath, currentArea: "core/sample",
  observed: { legacyLoadOrder: 7, providers: { status: "verified", items: [] } },
  architecture: { migrationStatus: "classified", roles: ["domain-behavior"], targetBoundary: "game-domain",
    targetPath: `src/game/domain/sample/${currentPath.split("/").pop()}`, migrationWave: 3 },
  analysis: { blockers: { status: "verified", items: blockers } }, ...extra });
const MANIFEST = Object.freeze({ modules: [
  manifestEntry("src/core/sample/edited.js", ["legacy-global-contract", MIXED]),
  manifestEntry("src/core/sample/other.js", ["legacy-global-contract", MIXED]),
] });
const EDITED = { editedPaths: ["src/core/sample/edited.js"] };
const WAVES = Object.freeze([
  { order: 1, id: "pure-leaf", targetBoundaries: ["engine", "game-domain"] },
  { order: 3, id: "game-domain", targetBoundaries: ["game-domain"] },
  { order: 6, id: "presentation", targetBoundaries: ["game-presentation"] },
]);
const removal = (reason = "UI text moved to the injected presentation catalog.") => ({ blocker: MIXED, reason });

let cases = 0;
const accepts = (label, action) => { cases += 1; assert.doesNotThrow(action, label); };
const rejects = (label, action, pattern) => { cases += 1; assert.throws(action, pattern, label); };

// Manifest updates: a reviewed removal plus reclassification applies exactly and is recorded.
accepts("valid blocker removal and reclassification", () => {
  const plan = new PrerequisiteManifestUpdatePlan([{ currentPath: "src/core/sample/edited.js",
    architecture: { roles: ["presentation"], targetBoundary: "game-presentation",
      targetPath: "src/game/presentation/sample/edited.js" }, removedBlockers: [removal()] }], { ...EDITED, waves: WAVES });
  const next = plan.apply(clone(MANIFEST));
  const entry = next.modules[0];
  assert.deepEqual(entry.analysis.blockers.items, ["legacy-global-contract"]);
  assert.equal(entry.architecture.targetBoundary, "game-presentation");
  assert.equal(entry.architecture.migrationWave, 6, "the wave follows the boundary (its only wave)");
  assert.equal(entry.architecture.migrationStatus, "classified", "unreviewed classification fields stay");
  assert.deepEqual(next.modules[1], MANIFEST.modules[1], "other modules stay untouched");
  plan.verify(clone(MANIFEST), next);
  const [record] = plan.records(clone(MANIFEST), next);
  assert.deepEqual(record.before.blockers, ["legacy-global-contract", MIXED]);
  assert.deepEqual(record.after.blockers, ["legacy-global-contract"]);
  assert.equal(record.removedBlockers[0].reason, removal().reason);
});
rejects("unknown module", () => new PrerequisiteManifestUpdatePlan([{ currentPath: "src/core/sample/missing.js",
  removedBlockers: [removal()] }], { editedPaths: ["src/core/sample/missing.js"] }).apply(clone(MANIFEST)), /unknown module/u);
rejects("module outside the transition's source edits", () => new PrerequisiteManifestUpdatePlan([{
  currentPath: "src/core/sample/other.js", removedBlockers: [removal()] }], EDITED), /outside the transition/u);
rejects("adding a blocker through an unsupported field", () => new PrerequisiteManifestUpdatePlan([{
  currentPath: "src/core/sample/edited.js", addedBlockers: ["browser-api-coupling"] }], EDITED), /unsupported fields/u);
rejects("removing a blocker that is not recorded", () => new PrerequisiteManifestUpdatePlan([{
  currentPath: "src/core/sample/edited.js", removedBlockers: [{ blocker: "browser-api-coupling", reason: "none" }] }],
EDITED).apply(clone(MANIFEST)), /is not recorded/u);
rejects("a re-observed Manifest that adds a blocker", () => {
  const plan = new PrerequisiteManifestUpdatePlan([{ currentPath: "src/core/sample/edited.js",
    removedBlockers: [removal()] }], EDITED);
  const next = plan.apply(clone(MANIFEST));
  next.modules[1].analysis.blockers.items.push("browser-api-coupling");
  plan.verify(clone(MANIFEST), next);
}, /blockers changed/u);
rejects("changing currentPath", () => new PrerequisiteManifestUpdatePlan([{ currentPath: "src/core/sample/edited.js",
  architecture: { currentPath: "src/core/sample/moved.js" } }], EDITED), /may only reclassify/u);
rejects("changing legacyLoadOrder", () => new PrerequisiteManifestUpdatePlan([{ currentPath: "src/core/sample/edited.js",
  legacyLoadOrder: 8, removedBlockers: [removal()] }], EDITED), /unsupported fields/u);
rejects("a re-observed Manifest that moves a legacy slot", () => {
  const plan = new PrerequisiteManifestUpdatePlan([{ currentPath: "src/core/sample/edited.js",
    removedBlockers: [removal()] }], EDITED);
  const next = plan.apply(clone(MANIFEST));
  next.modules[1].observed.legacyLoadOrder = 8;
  plan.verify(clone(MANIFEST), next);
}, /legacyLoadOrder changed/u);
rejects("changing the migration status or wave", () => new PrerequisiteManifestUpdatePlan([{
  currentPath: "src/core/sample/edited.js", architecture: { migrationWave: 6 } }], EDITED), /may only reclassify/u);
rejects("a re-observed Manifest that reclassifies another module", () => {
  const plan = new PrerequisiteManifestUpdatePlan([{ currentPath: "src/core/sample/edited.js",
    removedBlockers: [removal()] }], EDITED);
  const next = plan.apply(clone(MANIFEST));
  next.modules[1].architecture.targetBoundary = "game-presentation";
  plan.verify(clone(MANIFEST), next);
}, /classification changed/u);
rejects("a removal without a reason", () => new PrerequisiteManifestUpdatePlan([{ currentPath: "src/core/sample/edited.js",
  removedBlockers: [removal("  ")] }], EDITED), /needs a reason/u);
rejects("a duplicated removal", () => new PrerequisiteManifestUpdatePlan([{ currentPath: "src/core/sample/edited.js",
  removedBlockers: [removal(), removal()] }], EDITED), /missing or duplicated/u);
rejects("an update that changes nothing", () => new PrerequisiteManifestUpdatePlan([{
  currentPath: "src/core/sample/edited.js" }], EDITED), /changes nothing/u);
rejects("a reclassification to the current value", () => new PrerequisiteManifestUpdatePlan([{
  currentPath: "src/core/sample/edited.js", architecture: { targetBoundary: "game-domain" } }], EDITED)
  .apply(clone(MANIFEST)), /changes nothing/u);

// Derived migration waves and reclassification without edit.
const confirmedEdge = { target: "src/core/sample/dep.js", symbols: ["Dep"], resolution: "confirmed" };
const presentationEntry = (currentPath, dependencies) => {
  const entry = manifestEntry(currentPath, ["high-level-self-composition", "legacy-global-contract"]);
  entry.architecture = { migrationStatus: "classified", roles: ["presentation"], targetBoundary: "game-presentation",
    targetPath: `src/game/presentation/sample/${currentPath.split("/").pop()}`, migrationWave: 6 };
  entry.analysis.dependencies = { items: dependencies };
  return entry;
};
const RECLASSIFY = Object.freeze({ modules: [
  presentationEntry("src/core/sample/rule.js", [confirmedEdge]),
  presentationEntry("src/core/sample/leaf.js", []),
  presentationEntry("src/core/sample/edited.js", [confirmedEdge]),
] });
const toDomain = currentPath => ({ currentPath, architecture: { roles: ["domain-behavior"], targetBoundary: "game-domain",
  targetPath: `src/game/domain/sample/${currentPath.split("/").pop()}` } });

accepts("reclassification without edit derives the boundary's own wave and pins the source hash", () => {
  const plan = new PrerequisiteManifestUpdatePlan([toDomain("src/core/sample/rule.js"), toDomain("src/core/sample/edited.js")],
    { ...EDITED, reclassifiedWithoutEdit: ["src/core/sample/rule.js"], waves: WAVES });
  const next = plan.apply(clone(RECLASSIFY));
  assert.equal(next.modules[0].architecture.migrationWave, 3, "a non-leaf Domain rule gets the game-domain wave");
  assert.equal(next.modules[0].architecture.targetBoundary, "game-domain");
  assert.equal(next.modules[2].architecture.migrationWave, 3);
  plan.verify(clone(RECLASSIFY), next);
  const records = plan.records(clone(RECLASSIFY), next, { sourceSha256: () => "a".repeat(64) });
  assert.equal(records[0].unchangedSourceSha256, "a".repeat(64), "the unchanged source is pinned");
  assert(!("unchangedSourceSha256" in records[1]), "an edited module records no pinned source");
  assert.equal(records[0].before.architecture.migrationWave, 6);
});
rejects("a task that sets the migration wave", () => new PrerequisiteManifestUpdatePlan([{ ...toDomain("src/core/sample/edited.js"),
  architecture: { ...toDomain("src/core/sample/edited.js").architecture, migrationWave: 3 } }], { ...EDITED, waves: WAVES }),
/may only reclassify/u);
rejects("a dependency leaf whose boundary several waves allow", () => new PrerequisiteManifestUpdatePlan(
  [toDomain("src/core/sample/leaf.js")], { editedPaths: [], reclassifiedWithoutEdit: ["src/core/sample/leaf.js"],
    waves: WAVES }).apply(clone(RECLASSIFY)), /not derivable/u);
rejects("a boundary change without policy waves", () => new PrerequisiteManifestUpdatePlan(
  [toDomain("src/core/sample/edited.js")], EDITED).apply(clone(RECLASSIFY)), /needs the policy waves/u);
rejects("an unedited module that is not listed", () => new PrerequisiteManifestUpdatePlan(
  [toDomain("src/core/sample/rule.js")], { ...EDITED, waves: WAVES }), /outside the transition/u);
rejects("a blocker removal from a module reclassified without edit", () => new PrerequisiteManifestUpdatePlan([{
  ...toDomain("src/core/sample/rule.js"), removedBlockers: [removal()] }],
{ ...EDITED, reclassifiedWithoutEdit: ["src/core/sample/rule.js"], waves: WAVES }), /only from modules the transition edits/u);
rejects("an edited module listed as reclassified without edit", () => new PrerequisiteManifestUpdatePlan(
  [toDomain("src/core/sample/edited.js")], { ...EDITED, reclassifiedWithoutEdit: ["src/core/sample/edited.js"], waves: WAVES }),
/not reclassified without edit/u);
rejects("a listed module without an update", () => new PrerequisiteManifestUpdatePlan([toDomain("src/core/sample/edited.js")],
  { ...EDITED, reclassifiedWithoutEdit: ["src/core/sample/rule.js"], waves: WAVES }), /has no update/u);

// Blocker removal from approved modules the transition does not edit, on recorded evidence.
const REVIEWED = { editedPaths: ["src/core/sample/edited.js"], reviewedWithoutEdit: ["src/core/sample/other.js"] };
const POLICY = { targetBoundaries: [{ id: "game-domain", allowedDependencies: ["engine", "game-domain"] },
  { id: "game-presentation", allowedDependencies: ["game-domain"] }, { id: "dev", allowedDependencies: [] }] };
const evidenceManifest = (mutate = () => {}) => {
  const document = clone(MANIFEST);
  const dependency = manifestEntry("src/core/sample/dep.js", []);
  document.modules.push(dependency);
  document.modules[1].analysis.dependencies = { items: [{ target: "src/core/sample/dep.js", symbols: ["Dep"],
    resolution: "confirmed" }], unresolved: [], ambiguous: [] };
  document.modules[1].observed.environment = { browserApis: [], dynamicConstructs: [] };
  mutate(document);
  return document;
};
const evidence = (manifest, debts = []) => buildReviewEvidence({ currentPath: "src/core/sample/other.js", manifest,
  policy: POLICY, debtRegistry: { debts }, sourceSha256: "b".repeat(64) });

accepts("a reviewed module drops its blocker on recorded evidence", () => {
  const plan = new PrerequisiteManifestUpdatePlan([{ currentPath: "src/core/sample/other.js", removedBlockers: [removal()] }],
    REVIEWED);
  const next = plan.apply(evidenceManifest());
  assert.deepEqual(next.modules[1].analysis.blockers.items, ["legacy-global-contract"]);
  const [record] = plan.records(evidenceManifest(), next, { reviewEvidence: () => evidence(next) });
  assert.equal(record.reviewEvidence.sourceSha256, "b".repeat(64), "the source hash is pinned");
  assert.deepEqual(record.reviewEvidence.dependencies, [{ target: "src/core/sample/dep.js", targetBoundary: "game-domain" }]);
});
rejects("a reviewed module that is also reclassified", () => new PrerequisiteManifestUpdatePlan([{
  currentPath: "src/core/sample/other.js", architecture: { targetBoundary: "game-presentation" },
  removedBlockers: [removal()] }], { ...REVIEWED, waves: WAVES }), /only removes reviewed blockers/u);
rejects("a reviewed module without a blocker removal", () => new PrerequisiteManifestUpdatePlan([{
  currentPath: "src/core/sample/other.js", architecture: { targetBoundary: "game-presentation" } }],
{ ...REVIEWED, waves: WAVES }), /only removes reviewed blockers/u);
rejects("an edited module listed as reviewed without edit", () => new PrerequisiteManifestUpdatePlan([{
  currentPath: "src/core/sample/edited.js", removedBlockers: [removal()] }],
{ editedPaths: ["src/core/sample/edited.js"], reviewedWithoutEdit: ["src/core/sample/edited.js"] }), /not reviewed without edit/u);
rejects("a module both reclassified and reviewed without edit", () => new PrerequisiteManifestUpdatePlan([{
  currentPath: "src/core/sample/other.js", removedBlockers: [removal()] }],
{ editedPaths: [], reviewedWithoutEdit: ["src/core/sample/other.js"], reclassifiedWithoutEdit: ["src/core/sample/other.js"] }),
/either reclassified or reviewed/u);
rejects("evidence with a forbidden dependency", () => evidence(evidenceManifest(document => {
  document.modules[2].architecture.targetBoundary = "game-presentation";
})), /forbidden dependency/u);
rejects("evidence with a DEV dependency", () => evidence(evidenceManifest(document => {
  document.modules[2].architecture.targetBoundary = "dev";
})), /forbidden dependency/u);
rejects("evidence with a browser API", () => evidence(evidenceManifest(document => {
  document.modules[1].observed.environment.browserApis = ["console"];
})), /browser APIs/u);
rejects("evidence with an unresolved dependency", () => evidence(evidenceManifest(document => {
  document.modules[1].analysis.dependencies.unresolved = [{ symbol: "Hidden" }];
})), /unresolved dependencies/u);
rejects("evidence with remaining known debt", () => evidence(evidenceManifest(),
  [{ id: "debt-x", source: "src/core/sample/other.js" }]), /known architecture debt/u);

// Global provider additions: the exact baseline changes by exactly the declared, observed providers.
const CREATED = { createdPaths: ["src/config/sample/a.js", "src/config/sample/b.js"] };
const addition = (currentPath, symbol) => ({ currentPath, symbol, mechanism: "global-lexical",
  availability: "program-init", removalCondition: "Removed when its classic consumers migrate to ESM (Stage 5)." });
const BASELINE = Object.freeze({ schemaVersion: 1, providers: [
  { currentPath: "src/app/x.js", symbol: "X", mechanism: "global-lexical", availability: "program-init" },
  { currentPath: "src/core/y.js", symbol: "Y", mechanism: "global-lexical", availability: "program-init" },
] });
const provided = (...entries) => ({ modules: entries.map(([currentPath, symbol]) => ({ currentPath,
  observed: { providers: { items: [{ symbol, mechanism: "global-lexical", availability: "program-init" }] } } })) });
const TWO = [addition("src/config/sample/a.js", "A_CATALOG"), addition("src/config/sample/b.js", "B_CATALOG")];
const OBSERVED = provided(["src/config/sample/a.js", "A_CATALOG"], ["src/config/sample/b.js", "B_CATALOG"]);

accepts("valid additions change the baseline by exactly two sorted entries", () => {
  const plan = new PrerequisiteGlobalProviderAdditionPlan(TWO, CREATED);
  const next = plan.apply(clone(BASELINE));
  assert.deepEqual(next.providers.map(provider => provider.symbol), ["X", "A_CATALOG", "B_CATALOG", "Y"]);
  assert(next.providers.every(provider => !("removalCondition" in provider)), "the baseline keeps its schema");
  plan.verify(clone(BASELINE), next, OBSERVED);
  assert(plan.records().every(record => record.removalCondition), "the record keeps each removal condition");
});
rejects("a third declared but unobserved global", () => {
  const plan = new PrerequisiteGlobalProviderAdditionPlan([...TWO, addition("src/config/sample/b.js", "C_EXTRA")], CREATED);
  plan.verify(clone(BASELINE), plan.apply(clone(BASELINE)), OBSERVED);
}, /other globals/u);
rejects("an observed but undeclared global of a created file", () => {
  const plan = new PrerequisiteGlobalProviderAdditionPlan(TWO.slice(0, 1), CREATED);
  plan.verify(clone(BASELINE), plan.apply(clone(BASELINE)),
    provided(["src/config/sample/a.js", "A_CATALOG"], ["src/config/sample/a.js", "A_HIDDEN"]));
}, /other globals/u);
rejects("a third baseline entry beyond the reviewed additions", () => {
  const plan = new PrerequisiteGlobalProviderAdditionPlan(TWO, CREATED);
  const next = plan.apply(clone(BASELINE));
  next.providers.push({ currentPath: "src/app/z.js", symbol: "Z", mechanism: "global-lexical", availability: "program-init" });
  plan.verify(clone(BASELINE), next, OBSERVED);
}, /other entries/u);
rejects("a changed foreign baseline entry", () => {
  const plan = new PrerequisiteGlobalProviderAdditionPlan(TWO, CREATED);
  const next = plan.apply(clone(BASELINE));
  next.providers.find(provider => provider.symbol === "Y").availability = "deferred";
  plan.verify(clone(BASELINE), next, OBSERVED);
}, /changed or removed/u);
rejects("a removed foreign baseline entry", () => {
  const plan = new PrerequisiteGlobalProviderAdditionPlan(TWO, CREATED);
  const next = plan.apply(clone(BASELINE));
  next.providers = next.providers.filter(provider => provider.symbol !== "X");
  plan.verify(clone(BASELINE), next, OBSERVED);
}, /changed or removed/u);
rejects("an addition that re-declares an approved provider", () => new PrerequisiteGlobalProviderAdditionPlan([
  { ...addition("src/config/sample/a.js", "A_CATALOG") }], CREATED).apply({ ...clone(BASELINE),
  providers: [...clone(BASELINE.providers), { currentPath: "src/config/sample/a.js", symbol: "A_CATALOG",
    mechanism: "global-lexical", availability: "program-init" }] }), /already in the baseline/u);
rejects("an addition for a file the transition does not create", () => new PrerequisiteGlobalProviderAdditionPlan([
  addition("src/app/x.js", "X2")], CREATED), /outside the files/u);
rejects("an addition without a removal condition", () => new PrerequisiteGlobalProviderAdditionPlan([
  { ...addition("src/config/sample/a.js", "A_CATALOG"), removalCondition: "" }], CREATED), /removal condition/u);
rejects("an addition with extra fields", () => new PrerequisiteGlobalProviderAdditionPlan([
  { ...addition("src/config/sample/a.js", "A_CATALOG"), approvedBy: "anyone" }], CREATED), /needs exactly/u);
rejects("a duplicated addition", () => new PrerequisiteGlobalProviderAdditionPlan([TWO[0], TWO[0]], CREATED),
  /duplicated/u);
rejects("an unsupported mechanism", () => new PrerequisiteGlobalProviderAdditionPlan([
  { ...addition("src/config/sample/a.js", "A_CATALOG"), mechanism: "window-property" }], CREATED), /invalid mechanism/u);

console.log(`Stage 3 prerequisite transition fixtures PASS: ${cases} cases (Manifest updates and global provider additions).`);
