"use strict";

// Review queue 049 added two collection replacement rules and the `size` read to the state-identity review:
// `transactional-swap` (a complete local collection installed with rollback), `rebuilt-index` (a derived index
// reset by the first statement of its rebuild method). These fixtures prove that each accepts only its exact
// shape and that the earlier `atomic-local` rule is unchanged.
const assert = require("node:assert/strict");
const { StageThreeStateIdentityReview } = require("./domain_batches/stage_three_state_identity_review");

const review = new StageThreeStateIdentityReview();
const CURRENT = "fixture/store.js";
let cases = 0;
const items = (replacement, operations = ["get", "has", "set", "size", "values"]) => ({ owner: "Store#items",
  field: "#items", scope: "instance", collection: "Map", allowedOperations: operations, replacement });
const index = { owner: "Store#index", field: "#index", scope: "instance", collection: "Map",
  allowedOperations: ["get", "set"], replacement: "rebuilt-index" };
const run = (source, collections) => review.review({ source, currentPath: CURRENT, className: "Store", collections });
const accepts = (source, collections, name) => { assert.doesNotThrow(() => run(source, collections), name); cases += 1; };
const rejects = (source, collections, pattern, name) => {
  assert.throws(() => run(source, collections), pattern, name);
  cases += 1;
};

const store = ({ swap = null, rebuild = null, size = "    return this.#items.size;\n" } = {}) =>
  "class Store {\n  #items = new Map();\n  #index = new Map();\n" +
  "  get size() {\n" + size + "  }\n" +
  "  get(id) { return this.#items.get(id) || null; }\n" +
  "  restore(snapshot) {\n" + (swap || "    const replacement = new Map();\n" +
    "    for (const item of snapshot) replacement.set(item.id, item);\n" +
    "    const previous = this.#items;\n    this.#items = replacement;\n" +
    "    try {\n      this.#rebuild();\n    } catch (error) {\n      this.#items = previous;\n" +
    "      this.#rebuild();\n      throw error;\n    }\n") + "  }\n" +
  "  #rebuild() {\n" + (rebuild || "    this.#index = new Map();\n" +
    "    for (const item of this.#items.values()) this.#index.set(item.parent, item);\n") + "  }\n}\n";

const valid = store();
accepts(valid, [items("transactional-swap"), index], "swap with rollback and rebuilt index");
const proof = run(valid, [items("transactional-swap"), index]).collections;
assert.deepEqual(proof.map(item => item.replacements.map(record => record.visibility)),
  [["complete-local-collection-swapped-with-rollback"], ["derived-index-reset-by-first-statement-of-rebuild"]]);
cases += 1;
rejects(valid, [items(undefined), index], /escapes its owner/u, "swap without a reviewed rule");
rejects(valid, [items("atomic-local"), index], /escapes its owner/u, "swap reviewed as atomic-local");
rejects(valid, [items("transactional-swap", ["get", "has", "set", "values"]), index], /read without a direct method call/u,
  "size read without the reviewed size operation");
rejects(store({ size: "    this.#items.size = 0;\n    return 0;\n" }), [items("transactional-swap"), index],
  /read without a direct method call|escapes/u, "size assignment");
const swap = body => store({ swap: body });
rejects(swap("    const replacement = new Map();\n    this.#items = replacement;\n"), [items("transactional-swap"), index],
  /does not save the previous collection/u, "swap without rollback");
rejects(swap("    const replacement = new Map();\n    const previous = this.#items;\n    this.#items = replacement;\n" +
  "    try {\n      this.#rebuild();\n    } catch (error) {\n      this.#rebuild();\n      this.#items = previous;\n" +
  "      throw error;\n    }\n"), [items("transactional-swap"), index], /does not first restore/u, "late restore");
rejects(swap("    const replacement = new Map();\n    const previous = this.#items;\n    this.#items = replacement;\n" +
  "    try {\n      this.#rebuild();\n    } catch (error) {\n      this.#items = previous;\n    }\n"),
[items("transactional-swap"), index], /does not rethrow/u, "swallowed error");
rejects(swap("    const replacement = new Map();\n    const previous = this.#items;\n    previous.clear();\n" +
  "    this.#items = replacement;\n    try {\n      this.#rebuild();\n    } catch (error) {\n" +
  "      this.#items = previous;\n      throw error;\n    }\n"), [items("transactional-swap"), index],
/does not install a local collection next/u, "statement between save and install");
rejects(swap("    const replacement = new Map();\n    const previous = this.#items;\n    this.#items = replacement;\n" +
  "    try {\n      this.#rebuild();\n    } catch (error) {\n      this.#items = previous;\n      throw error;\n    }\n" +
  "    return previous;\n"), [items("transactional-swap"), index], /final try|escapes/u, "previous returned");
rejects(swap("    const replacement = new Map([[1, 2]]);\n    const previous = this.#items;\n    this.#items = replacement;\n" +
  "    try {\n      this.#rebuild();\n    } catch (error) {\n      this.#items = previous;\n      throw error;\n    }\n"),
[items("transactional-swap"), index], /not a new empty Map/u, "prefilled local");
rejects(swap("    const replacement = new Map();\n    globalThis.leak = replacement;\n    const previous = this.#items;\n" +
  "    this.#items = replacement;\n    try {\n      this.#rebuild();\n    } catch (error) {\n" +
  "      this.#items = previous;\n      throw error;\n    }\n"), [items("transactional-swap"), index],
/escapes or is shadowed/u, "escaping local");
rejects(swap("    const replacement = new Map();\n    const previous = this.#items;\n    this.#items = replacement;\n" +
  "    try {\n      this.#rebuild();\n    } catch (error) {\n      this.#items = previous;\n      throw error;\n    }\n" +
  "    this.#items = new Map();\n"), [items("transactional-swap"), index], /final try|reassigned outside/u,
"second reassignment");
const rebuild = body => store({ rebuild: body });
rejects(rebuild("    const seen = 1;\n    this.#index = new Map();\n"), [items("transactional-swap"), index],
  /not the first statement/u, "late index reset");
rejects(rebuild("    this.#index = new Map([[1, 2]]);\n"), [items("transactional-swap"), index],
  /not a new empty Map/u, "prefilled index reset");
rejects(rebuild("    this.#index = this.#items;\n"), [items("transactional-swap"), index],
  /not a new empty Map|escapes|read without/u, "index aliasing the store");
rejects(valid, [items("transactional-swap"), { ...index, replacement: undefined }], /escapes its owner/u,
  "index reset without a reviewed rule");
rejects(valid, [items("transactional-swap"), { ...index, replacement: "unknown" }], /unknown replacement rule/u,
  "unknown rule");

// atomic-local is unchanged.
const atomic = "class Store {\n  #items = new Map();\n  get(id) { return this.#items.get(id); }\n" +
  "  restore(snapshot) {\n    const replacement = new Map();\n    for (const item of snapshot) replacement.set(item.id, item);\n" +
  "    this.#items = replacement;\n  }\n}\n";
accepts(atomic, [items("atomic-local", ["get", "set"])], "atomic-local replacement");
rejects(atomic, [items("transactional-swap", ["get", "set"])], /does not save the previous collection/u,
  "atomic replacement reviewed as a swap");

console.log(`Stage 3 state-identity replacement fixtures passed (${cases} cases).`);
