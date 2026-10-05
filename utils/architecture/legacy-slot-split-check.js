"use strict";

// Split legacy slots: the live index.html splits exactly the reviewed slots, and the reader and the
// registry reject bad split metadata (unknown members, duplicated scripts, wrong member order,
// non-contiguous members, a split at the wrong logical slot, module scripts).
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { LegacyScriptOrderReader } = require("./migration/legacy_script_order_reader");
const { LegacySlotSplitRegistry, KIND } = require("./migration/legacy_slot_split_registry");
const { StageTwoRuntimeScriptAliasResolver } = require("./migration/stage_two_runtime_script_alias_resolver");
const { LegacyLoadOrderIndex } = require("./observation/resolution/legacy_load_order_index");
const { ProviderResolutionContract } = require("./observation/resolution/provider_resolution_contract");

const ROOT = path.resolve(__dirname, "../..");
const html = scripts => scripts.map(([source, slot, type]) => `<script src="${source}"` +
  `${slot ? ` data-legacy-slot="${slot}"` : ""}${type ? ` type="${type}"` : ""}></script>`).join("\n");
const registry = splits => new LegacySlotSplitRegistry({ schemaVersion: 1, kind: KIND,
  splits: splits.map(([slot, members]) => ({ slot, members, transition: "fixture" })) });
const read = (scripts, aliases = new Map()) => new LegacyScriptOrderReader(null, { scriptAliases: aliases }).parse(html(scripts));
const slots = scripts => read(scripts).map(script => `${script.currentPath}:${script.legacyLoadOrder}`);

// Historical documents: one slot per classic script.
assert.deepEqual(slots([["src/a.js"], ["src/b.js"], ["src/c.js"]]), ["src/a.js:1", "src/b.js:2", "src/c.js:3"]);
// A split slot shares its number; the following slots keep theirs.
const classic = [["src/a.js"], ["src/v.js", 2], ["src/core.js", 2], ["src/b.js"]];
assert.deepEqual(slots(classic), ["src/a.js:1", "src/v.js:2", "src/core.js:2", "src/b.js:3"]);
registry([[2, ["src/v.js", "src/core.js"]]]).assertMatches(read(classic));
// An eager reader can use a declaration in an earlier member of its reviewed split slot.
const loadIndex = new LegacyLoadOrderIndex(read(classic));
const resolution = new ProviderResolutionContract(require("../../architecture/module_architecture.json")
  .migrationManifest.observationContract.resolutionModel);
const assessment = (providerPath, consumerPath) => resolution.assessLoadOrder({providerPath,consumerPath,
  providerLoadOrder:loadIndex.get(providerPath),consumerLoadOrder:loadIndex.get(consumerPath),executionPhase:"eager",
  providerSlotMemberIndex:loadIndex.memberIndex(providerPath),consumerSlotMemberIndex:loadIndex.memberIndex(consumerPath)});
assert.equal(assessment("src/v.js","src/core.js"),"eligible");
assert.equal(assessment("src/core.js","src/v.js"),"ineligible");
assert.equal(resolution.assessLoadOrder({providerPath:"src/v.js",consumerPath:"src/core.js",providerLoadOrder:2,
  consumerLoadOrder:2,executionPhase:"eager"}),"ineligible", "a same-slot number alone proves no physical order");
// An infrastructure script aliased away between two members keeps them contiguous.
const runtime = new Map([["dist/runtime.js", null]]);
const spanning = [["src/a.js"], ["src/core.js", 2], ["dist/runtime.js"], ["src/v.js", 2], ["src/b.js"]];
assert.deepEqual(read(spanning, runtime).map(script => `${script.currentPath}:${script.legacyLoadOrder}`),
  ["src/a.js:1", "src/core.js:2", "src/v.js:2", "src/b.js:3"]);
registry([[2, ["src/core.js", "src/v.js"]]]).assertMatches(read(spanning, runtime));

const rejects = (action, pattern) => assert.throws(action, pattern);
rejects(() => registry([]).assertMatches(read(classic)), /split without a reviewed record/u);
rejects(() => registry([[2, ["src/core.js", "src/v.js"]]]).assertMatches(read(classic)), /members differ/u);
rejects(() => registry([[2, ["src/v.js", "src/x.js"]]]).assertMatches(read(classic)), /members differ/u);
rejects(() => registry([[2, ["src/v.js", "src/core.js"]], [5, ["src/p.js", "src/q.js"]]]).assertMatches(read(classic)),
  /Reviewed split of legacy slot 5 is missing/u);
rejects(() => read([["src/a.js"], ["src/v.js", 3], ["src/core.js", 3]]), /starts at logical slot 2/u);
rejects(() => read([["src/a.js"], ["src/v.js", 2], ["src/b.js"], ["src/core.js", 2]]), /not contiguous/u);
rejects(() => read([["src/a.js"], ["src/v.js", 2, "module"]]), /Only classic scripts/u);
rejects(() => read([["src/a.js"], ["src/v.js", "x"]]), /Invalid data-legacy-slot/u);
rejects(() => registry([[2, ["src/v.js", "src/core.js"]]]).assertMatches(read([...classic, ["src/a.js"]])),
  /Duplicated physical script/u);
rejects(() => registry([[2, ["src/v.js", "src/v.js"]]]), /duplicated member/u);
rejects(() => registry([[2, ["src/v.js"]]]), /at least two members/u);

// Removed slots retain the exact identities of all surviving scripts; invalid positions fail.
const tombstone = '<!-- retired-legacy-slot 2: src/removed.js -->';
const removalHtml = html([["src/a.js"]])+"\n"+tombstone+"\n"+html([["src/c.js"]]);
const removalReader = new LegacyScriptOrderReader(null);
assert.deepEqual(removalReader.parse(removalHtml).map(script => [script.currentPath,script.legacyLoadOrder]),
  [["src/a.js",1],["src/c.js",3]]);
for (const invalid of [removalHtml.replace("slot 2:","slot 3:"),removalHtml.replace(tombstone,tombstone+"\n"+tombstone),
  removalHtml.replace(tombstone,html([["src/b.js"]])+"\n"+tombstone)])
  assert.throws(() => removalReader.parse(invalid),/Retired legacy slot/u);

// Selection follows the reviewed policy even when production has become a native module document.
const selectionRoot = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "cyber-legacy-source-"));
const selectionPolicy = source => ({ migrationManifest: { legacyLoadOrder: { source } } });
const selectionPolicyPath = path.join(selectionRoot, "architecture/module_architecture.json");
let rejectedSelections = 0;
const rejectSelection = (action, pattern) => { assert.throws(action, pattern); rejectedSelections += 1; };
try {
  fs.mkdirSync(path.dirname(selectionPolicyPath));
  fs.writeFileSync(selectionPolicyPath, JSON.stringify(selectionPolicy("dev.html")));
  fs.writeFileSync(path.join(selectionRoot, "index.html"), html([["src/entrypoints/game.entry.js", null, "module"]]));
  fs.writeFileSync(path.join(selectionRoot, "dev.html"), html([["src/legacy/a.js"], ["src/legacy/b.js"]]));
  assert.equal(LegacyScriptOrderReader.sourcePath(selectionRoot), path.join(selectionRoot, "dev.html"));
  assert.deepEqual(new LegacyScriptOrderReader(LegacyScriptOrderReader.sourcePath(selectionRoot)).read()
    .map(script => script.currentPath), ["src/legacy/a.js", "src/legacy/b.js"]);
  assert.equal(LegacyScriptOrderReader.sourcePath(selectionRoot, selectionPolicy("index.html")),
    path.join(selectionRoot, "index.html"), "an explicit historical policy preserves its original source");
  for (const source of [undefined, "../index.html", "other.html", "index.html?v=1", path.resolve(selectionRoot, "index.html")]) {
    rejectSelection(() => LegacyScriptOrderReader.sourcePath(selectionRoot, selectionPolicy(source)), /Unreviewed/u);
  }
  rejectSelection(() => LegacyScriptOrderReader.sourcePath(selectionRoot, {}), /Unreviewed/u);
  fs.unlinkSync(path.join(selectionRoot, "dev.html"));
  rejectSelection(() => LegacyScriptOrderReader.sourcePath(selectionRoot), /Selected.*missing/u);
  fs.mkdirSync(path.join(selectionRoot, "dev.html"));
  rejectSelection(() => LegacyScriptOrderReader.sourcePath(selectionRoot), /Selected.*missing/u);
  fs.unlinkSync(selectionPolicyPath);
  rejectSelection(() => LegacyScriptOrderReader.sourcePath(selectionRoot), /ENOENT/u);
} finally {
  assert.equal(path.dirname(selectionRoot), fs.realpathSync(os.tmpdir()));
  assert(path.basename(selectionRoot).startsWith("cyber-legacy-source-"));
  fs.rmSync(selectionRoot, { recursive: true, force: true });
}

// The live document splits exactly the reviewed slots.
const live = new LegacyScriptOrderReader(LegacyScriptOrderReader.sourcePath(ROOT), {
  scriptAliases: new StageTwoRuntimeScriptAliasResolver().loadProject(ROOT),
}).read();
const result = LegacySlotSplitRegistry.load(ROOT).assertMatches(live);
const logicalSlots = new Set(live.filter(script => script.type === "classic").map(script => script.legacyLoadOrder)).size;
console.log(`Legacy slot splits passed: ${result.splitSlots} reviewed split slot(s) with ${result.members} members, ` +
  `${logicalSlots} logical classic slots; 11 invalid split and ${rejectedSelections} invalid selection fixtures rejected; 3 invalid tombstone positions rejected.`);
