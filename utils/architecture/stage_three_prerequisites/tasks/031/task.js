"use strict";

const assert = require("node:assert/strict");
const vm = require("node:vm");
const espree = require("espree");
const eslintScope = require("eslint-scope");
const { LegacyScriptOrderReader } = require("../../../migration/legacy_script_order_reader");
const { StageThreeRuntimeScriptAliasResolver } = require("../../../migration/stage_three_runtime_script_alias_resolver");
const { CumulativeRuntimeLoadSlot } = require("../../../../build/compat_runtime/cumulative_runtime_load_slot");
const { CumulativeLiveActivationProbe } = require("../../../domain_batches/cumulative_live_activation_probe");
const { EXACT_TRANSPORT_GLOBAL } = require("../../../../build/compat_runtime/cumulative_runtime_contract");

const INDEX = "index.html";
const CONTRACT = "architecture/migration/stage_3_compatibility_runtime.json";
const RUNTIME = "dist/stage-3-compat-runtime/compat_runtime.iife.js";
const CORE = "src/core/core.js";
const SLOT_29 = "src/config/inventory/item_assembly_profile_config.js";
const SLOT_30 = "src/config/inventory/equipment_slot_config.js";
// Exact bytes: the classic tags end with CRLF, the runtime tag (like every generated tag) with LF.
const RUNTIME_TAG = `    <script src="${RUNTIME}"></script>\n`;
const CORE_TAG = `    <script src="${CORE}" data-legacy-slot="41"></script>\r\n`;
const SLOT_29_TAG = `    <script src="${SLOT_29}"></script>\r\n`;
// The ECMAScript globals the runtime bundle may name; globalThis only publishes the transport.
const BUILTINS = ["Array", "Boolean", "Error", "Infinity", "JSON", "Map", "Math", "NaN", "Number", "Object",
  "RangeError", "Set", "String", "Symbol", "TypeError", "WeakMap", "WeakSet", "globalThis"];

// Owner decision 2026-10-01 (batch 042 blocker): the single cumulative runtime tag moves from legacy slot 41
// (between core.js and the Vector2 activation, prerequisite 027) to immediately before legacy slot 30, the
// earliest slot of a Domain module (the equipment slot catalog of batch 042), so every Domain activation of
// the approved plan follows the runtime. Only the tag moves: the runtime bytes, the logical legacy order,
// every activation and bridge are unchanged. The runtime bundle reads no classic global (only ECMAScript
// builtins; globalThis once, to publish the transport), so evaluating it earlier changes no behaviour.
module.exports = Object.freeze({
  sequence: 31,
  slug: "cumulative-runtime-before-earliest-domain-slot",
  afterBatch: "041",
  backlogTaskId: "stage-3.22.prerequisite.equipment-decomposition",
  intent: "Move the single cumulative runtime tag in index.html from legacy slot 41 to immediately before legacy slot 30, the earliest Domain slot, so the equipment slot catalog activations of batch 042 follow the runtime; runtime bytes, logical legacy order, activations and bridges are unchanged and the runtime reads no classic global.",
  sourceEdits: Object.freeze([
    Object.freeze({ path: INDEX, replacements: Object.freeze([
      Object.freeze([CORE_TAG + RUNTIME_TAG, CORE_TAG]),
      Object.freeze([SLOT_29_TAG, SLOT_29_TAG + RUNTIME_TAG]),
    ]) }),
  ]),
  resolvedDebtIds: Object.freeze([]),
  expectedEdges: Object.freeze({ removed: Object.freeze([]), added: Object.freeze([]) }),
  // Focused parity: the same logical legacy order, the tag before the whole earliest Domain slot and before
  // every activation, a runtime bundle free of classic globals whose evaluation adds only the transport,
  // and no classic script that reads the transport.
  parity({ read, before, after }) {
    const contract = JSON.parse(read(CONTRACT));
    const aliases = new StageThreeRuntimeScriptAliasResolver().resolve(contract);
    const logical = html => new LegacyScriptOrderReader(null, { scriptAliases: aliases }).parse(html)
      .map(script => [script.legacyLoadOrder, script.currentPath, script.type]);
    assert.deepEqual(logical(after(INDEX)), logical(before(INDEX)), "the logical legacy order changed");
    assert.equal(after(INDEX).replace(RUNTIME_TAG, ""), before(INDEX).replace(RUNTIME_TAG, ""),
      "only the runtime tag moved");
    const load = html => CumulativeRuntimeLoadSlot.read({ html, aliases, runtimePath: RUNTIME });
    assert.deepEqual({ ...load(before(INDEX)) }, { slot: 41, firstPath: "src/core/math/vector2.js", precedesWholeSlot: false });
    const moved = load(after(INDEX));
    assert.deepEqual({ ...moved }, { slot: 30, firstPath: SLOT_30, precedesWholeSlot: true });
    assert.equal(moved.slot, CumulativeLiveActivationProbe.earliestDomainSlot(file => Buffer.from(read(file), "utf8")),
      "the runtime does not precede the earliest Domain slot");
    assert(contract.activationPositions.every(item => item.legacyScriptIndex >= moved.slot),
      "an activation precedes the runtime");
    // The runtime bundle names only ECMAScript builtins (eager and call-time references alike).
    const code = read(RUNTIME);
    const tree = espree.parse(code, { ecmaVersion: "latest", sourceType: "script", range: true });
    const free = [...new Set(eslintScope.analyze(tree, { ecmaVersion: 2022, sourceType: "script" })
      .globalScope.through.map(reference => reference.identifier.name))].sort();
    assert.deepEqual(free, BUILTINS, "the runtime reads a classic global");
    const context = vm.createContext({});
    vm.runInContext(code, context, { filename: RUNTIME });
    assert.deepEqual(Object.getOwnPropertyNames(context), [EXACT_TRANSPORT_GLOBAL], "runtime evaluation published more");
    // No loaded classic project script reads the transport (only the generated dist activation shims do).
    const classic = [...after(INDEX).matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>\s*<\/script>/giu)]
      .map(match => match[1].split("?")[0].replace(/^\.\//u, "")).filter(file => !file.startsWith("dist/"));
    const readers = classic.filter(file => read(file).includes(EXACT_TRANSPORT_GLOBAL));
    assert.deepEqual(readers, [], "a classic script reads the transport");
    return { logicalScripts: logical(after(INDEX)).length, runtimeSlot: moved.slot, freeGlobals: free.length,
      activations: contract.activationPositions.length, classicScripts: classic.length };
  },
});
