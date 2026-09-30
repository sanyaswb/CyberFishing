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

console.log(`Stage 3 batch reviewed-shape fixtures passed (${cases} cases).`);
