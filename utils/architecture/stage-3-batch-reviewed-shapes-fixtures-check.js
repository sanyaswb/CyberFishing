"use strict";

// Batch 041 introduced two reviewed contract shapes of the shared Stage 3 batch tooling:
// topLevelFunctions (a pure top-level function exported beside the classes) and localCompositions
// (default collaborators constructed from classes of the same source). These fixtures prove that both
// accept only their exact reviewed facts and reject every wider source or profile.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { StageThreeBatchPreflightProfile } = require("./domain_batches/stage_three_batch_preflight_profile");
const { StageThreeReviewedTopLevelFunctions } = require("./domain_batches/stage_three_reviewed_top_level_functions");
const { StageThreeLocalCompositionReview } = require("./domain_batches/stage_three_local_composition_review");
const { RepresentationOnlyReviewedEsmTarget } = require("./domain_batches/stage_three_reviewed_representation_target");
const { PREFLIGHT_PROFILE } = require("./stage_three_batches/definitions/041/profile");

const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const CURRENT = "fixture/policy.js";
let cases = 0;
const rejects = (action, pattern, name) => { assert.throws(action, pattern, name); cases += 1; };
const accepts = (action, expected, name) => { assert.deepEqual(action(), expected, name); cases += 1; };

// Top-level functions: exact names, plain declarations only.
const functions = new StageThreeReviewedTopLevelFunctions();
const withHelper = "class Policy {}\n\nfunction helper(config) {\n  return config || null;\n}\n";
accepts(() => functions.review({ source: withHelper, currentPath: CURRENT, names: ["helper"] }),
  ["FunctionDeclaration@3:1"], "reviewed function location");
accepts(() => functions.review({ source: "class Policy {}\n", currentPath: CURRENT }), [], "class-only source");
rejects(() => functions.review({ source: withHelper, currentPath: CURRENT, names: [] }),
  /reviewed top-level functions differ/u, "unreviewed function");
rejects(() => functions.review({ source: withHelper, currentPath: CURRENT, names: ["other"] }),
  /reviewed top-level functions differ/u, "renamed function");
rejects(() => functions.review({ source: "async function helper() {}\n", currentPath: CURRENT, names: ["helper"] }),
  /must be a plain function/u, "async function");
rejects(() => functions.review({ source: "function* helper() {}\n", currentPath: CURRENT, names: ["helper"] }),
  /must be a plain function/u, "generator function");

// Local compositions: every construction is a reviewed class of the same source or a built-in Error.
const compositions = new StageThreeLocalCompositionReview();
const resolver = "class Reel {}\nclass Pole {}\nclass Resolver {\n  constructor({ reel = null, pole = null } = {}) {\n" +
  "    this.reel = reel || new Reel();\n    this.pole = pole || new Pole();\n  }\n" +
  "  fail() { throw new Error(\"x\"); }\n}\n";
const review = compositions.review({ source: resolver, currentPath: CURRENT, composedClasses: ["Pole", "Reel"] });
accepts(() => review.compositions, [{ composed: "Pole", location: "6:25" }, { composed: "Reel", location: "5:25" }],
  "local default collaborators");
accepts(() => [review.invariant, review.sourceSha256],
  ["same-module-owner-created-default-collaborators", sha(resolver)], "local composition invariant");
rejects(() => compositions.review({ source: resolver, currentPath: CURRENT, composedClasses: ["Reel"] }),
  /reviewed local compositions differ/u, "unlisted local composition");
rejects(() => compositions.review({ source: resolver, currentPath: CURRENT, composedClasses: [] }),
  /reviewed local compositions are required/u, "empty composition list");
rejects(() => compositions.review({ source: "class Resolver {\n  constructor() { this.x = new Imported(); }\n}\n",
  currentPath: CURRENT, composedClasses: ["Imported"] }), /Imported is not declared in the source/u, "imported class");
rejects(() => compositions.review({ source: "class A {}\nclass R {\n  constructor(f) { this.x = new (f())(); }\n}\n",
  currentPath: CURRENT, composedClasses: ["A"] }), /dynamic construction/u, "dynamic construction");

// Representation: a reviewed function becomes a named export; an unreviewed one is refused.
const representation = new RepresentationOnlyReviewedEsmTarget();
const project = contract => representation.project({ source: withHelper, currentPath: CURRENT,
  targetPath: "fixture/target.js", exports: ["Policy", "helper"], sourceSha256: sha(withHelper), contract,
  targetEvaluation: null, imports: [] });
accepts(() => project({ topLevelFunctions: ["helper"] }).targetSource,
  "export class Policy {}\n\nexport function helper(config) {\n  return config || null;\n}\n", "function export");
rejects(() => project({}), /only plain class declarations/u, "unreviewed function export");

// Profile validation: the shapes name unique identifiers and never combine with a reviewed effect.
const LANDING = "src/core/fishing/landing_policy.js";
const deepFreeze = value => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value)) deepFreeze(item);
  }
  return value;
};
const withContract = patch => {
  const { executionProfile, ...rest } = PREFLIGHT_PROFILE;
  const definition = structuredClone(rest);
  Object.assign(definition.reviewedContracts[LANDING], patch);
  return () => new StageThreeBatchPreflightProfile(deepFreeze({ ...definition, executionProfile }));
};
accepts(() => withContract({})().value.reviewedContracts[LANDING].topLevelFunctions, ["resolveFightPhysicsConfig"],
  "reviewed batch 041 profile");
rejects(withContract({ topLevelFunctions: [] }), /topLevelFunctions must name unique/u, "empty function list");
rejects(withContract({ topLevelFunctions: ["a", "a"] }), /topLevelFunctions must name unique/u, "duplicate function");
rejects(withContract({ topLevelFunctions: ["not-a-name"] }), /topLevelFunctions must name unique/u, "invalid function name");
rejects(withContract({ legacyExposure: { symbol: "LandingPolicy", location: "1:1" } }),
  /topLevelFunctions combine only with effect-free classes/u, "function shape with an exposure");
rejects(withContract({ localCompositions: [] }), /localCompositions must name unique/u, "empty composition list");
rejects(withContract({ localCompositions: ["Reel", "Reel"] }), /localCompositions must name unique/u,
  "duplicate composition");

// Batch 042: frozenDataConstants accepts only top-level deeply frozen data tables with exact values.
const { StageThreeReviewedFrozenDataConstants } = require("./domain_batches/stage_three_reviewed_frozen_data_constants");
const data = new StageThreeReviewedFrozenDataConstants();
const table = "const Ids = Object.freeze({\n  A: \"a\",\n  B: \"b\",\n});\n\nconst ALL = Object.freeze([...[], Ids.A, Ids.B]);\n";
const dataSource = "const Ids = Object.freeze({\n  A: \"a\",\n  B: \"b\",\n});\n\nconst MAIN = Object.freeze([Ids.A]);\n\n" +
  "const ALL = Object.freeze([...MAIN, Ids.B]);\n\nconst CONFIG = Object.freeze({\n  [Ids.A]: Object.freeze({ id: Ids.A, " +
  "locked: true, size: -1, types: Object.freeze([\"x\"]) }),\n});\n";
const dataBindings = { Ids: { location: "1:13", values: { A: "a", B: "b" } }, MAIN: { location: "6:14", values: ["a"] },
  ALL: { location: "8:13", values: ["a", "b"] },
  CONFIG: { location: "10:16", values: { a: { id: "a", locked: true, size: -1, types: ["x"] } } } };
const reviewData = (source, bindings = dataBindings) => () => data.review({ source, currentPath: CURRENT, bindings });
accepts(() => reviewData(dataSource)().freezeCallLocations, ["10:16", "11:12", "11:70", "1:13", "6:14", "8:13"],
  "reviewed nested freeze locations");
rejects(reviewData(dataSource.replace("Object.freeze([\"x\"])", "[\"x\"]")), /not a reviewed frozen data table/u,
  "unfrozen nested table");
rejects(reviewData(dataSource.replace("[...MAIN, Ids.B]", "[...OTHER, Ids.B]")), /not a reviewed frozen data table/u,
  "spread of an unknown binding");
rejects(reviewData(dataSource.replace("Ids.B]", "Ids.C]")), /ALL is not a deeply frozen data table/u, "unresolved read");
rejects(reviewData(dataSource.replace("[Ids.A]: Object", "[later.A]: Object")), /not a reviewed frozen data table/u,
  "computed key of an unknown binding");
rejects(reviewData(dataSource.replace("size: -1", "size: Date.now()")), /not a reviewed frozen data table/u,
  "call inside a table");
rejects(reviewData(`${dataSource}globalThis.CONFIG = CONFIG;\n`), /expected exactly 4 frozen data constants/u,
  "extra top-level statement");
rejects(reviewData(dataSource.replace("const MAIN", "let MAIN")), /one const declaration per statement/u, "mutable binding");
rejects(reviewData(dataSource, { ...dataBindings, MAIN: { location: "6:14", values: ["b"] } }),
  /reviewed constant value differs: MAIN/u, "wrong reviewed value");
rejects(reviewData(table, { ALL: dataBindings.ALL, Ids: dataBindings.Ids }), /reviewed constant order differs/u,
  "reordered bindings");
accepts(() => new RepresentationOnlyReviewedEsmTarget().project({ source: dataSource, currentPath: CURRENT,
  targetPath: "fixture/target.js", exports: ["ALL", "CONFIG", "Ids", "MAIN"], sourceSha256: sha(dataSource),
  contract: { frozenDataConstants: { bindings: dataBindings } }, targetEvaluation: null, imports: [] }).targetSource,
dataSource.replace(/^const /gmu, "export const "), "frozen data constant exports");

// The cumulative evaluation gate accepts a frozen data table only over earlier bindings of the module.
const { StageThreeReviewedFrozenDataConstants: Grammar } = require("./domain_batches/stage_three_reviewed_frozen_data_constants");
const espree = require("espree");
const initOf = source => espree.parse(source, { ecmaVersion: "latest", sourceType: "module" }).body[0].declaration.declarations[0].init;
accepts(() => Grammar.freezeCalls(initOf("export const A = Object.freeze([...B, C.D, true]);"), new Set(["B", "C"])).length, 1,
  "gate table over earlier bindings");
accepts(() => Grammar.freezeCalls(initOf("export const A = Object.freeze([...B]);"), new Set()), null, "gate table over a later binding");
accepts(() => Grammar.freezeCalls(initOf("export const A = Object.freeze({ k: B.c() });"), new Set(["B"])), null,
  "gate table with a call");

// Batch 045: literalConstants names exact top-level const literal bindings beside the classes.
const { StageThreeReviewedLiteralConstants } = require("./domain_batches/stage_three_reviewed_literal_constants");
const literals = new StageThreeReviewedLiteralConstants();
const withName = "const NAME = \"Kit\";\n\nclass Loadout {}\n";
accepts(() => literals.review({ source: withName, currentPath: CURRENT, names: ["NAME"] }), ["VariableDeclaration@1:1"],
  "reviewed literal constant");
rejects(() => literals.review({ source: withName, currentPath: CURRENT, names: [] }), /literal constants differ/u,
  "unreviewed literal constant");
rejects(() => literals.review({ source: "const NAME = make();\nclass L {}\n", currentPath: CURRENT, names: ["NAME"] }),
  /must be a string, number or boolean literal/u, "computed constant");
rejects(() => literals.review({ source: "let NAME = \"x\";\nclass L {}\n", currentPath: CURRENT, names: ["NAME"] }),
  /only single const literal bindings/u, "mutable binding");
accepts(() => new RepresentationOnlyReviewedEsmTarget().project({ source: withName, currentPath: CURRENT,
  targetPath: "fixture/target.js", exports: ["Loadout", "NAME"], sourceSha256: sha(withName),
  contract: { literalConstants: ["NAME"] }, targetEvaluation: null, imports: [] }).targetSource,
"export const NAME = \"Kit\";\n\nexport class Loadout {}\n", "literal constant export");
rejects(() => new RepresentationOnlyReviewedEsmTarget().project({ source: withName, currentPath: CURRENT,
  targetPath: "fixture/target.js", exports: ["Loadout", "NAME"], sourceSha256: sha(withName), contract: {},
  targetEvaluation: null, imports: [] }), /only plain class declarations/u, "unreviewed constant export");

console.log(`Stage 3 batch reviewed-shape fixtures passed (${cases} cases).`);
