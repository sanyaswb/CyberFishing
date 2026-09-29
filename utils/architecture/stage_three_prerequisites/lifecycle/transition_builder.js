"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { ArchitecturePolicy } = require("../../core/architecture_policy");
const { LiveObservationSnapshot } = require("../../observation/persistence/live_observation_snapshot");
const { ArchitectureGuardSnapshotBuilder } = require("../../guards/corpus/architecture_guard_snapshot_builder");
const { ArchitectureGuardEngine } = require("../../guards/architecture_guard_engine");
const { StageThreePrerequisiteLedger, KIND } = require("../core/prerequisite_ledger");
const { PrerequisiteManifestUpdatePlan } = require("./manifest_update_plan");
const { PrerequisiteGlobalProviderAdditionPlan } = require("./global_provider_addition_plan");
const { buildReviewEvidence } = require("./review_evidence");
const { PrerequisiteGlobalProviderRemovalPlan } = require("./global_provider_removal_plan");
const { PrerequisiteGlobalProviderReplacementPlan } = require("./global_provider_replacement_plan");

const MANIFEST = "architecture/migration/module_migration_manifest.json";
const KNOWN_DEBT = "architecture/guards/known_debt_registry.json";
const STATE = "architecture/migration/stage_3_execution_state.json";
const BACKLOG = "architecture/migration/stage_3_22/prerequisite_backlog.json";
const POLICY = "architecture/module_architecture.json";
const BRIDGES = "architecture/guards/migration_bridge_registry.json";
const BASELINE = "architecture/guards/global_provider_baseline.json";
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const canonical = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

// Builds one prerequisite transition from the tree it applies to: the exact source edits, the
// observation facts re-derived from the edited sources, the known debts the edits resolve, a clean
// architecture-guard run and the task's focused parity. The builder never writes the project; it
// returns the record (with every before-image) and the after-bytes of every changed file.
class StageThreePrerequisiteTransitionBuilder {
  constructor(root, task) {
    this.root = path.resolve(root);
    this.task = task;
  }

  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }
  // Bytes of a file before the transition, or null when the transition creates it.
  beforeBytes(file) { return fs.existsSync(path.join(this.root, file)) ? this.bytes(file) : null; }
  json(file) { return JSON.parse(this.bytes(file)); }

  build() {
    const task = this.task;
    const recorded = new StageThreePrerequisiteLedger(this.root).records();
    assert.equal(recorded.length + 1, task.sequence, "prerequisite transitions are recorded in sequence");
    const state = this.json(STATE);
    assert.equal(state.activeBatchId, null, "a prerequisite transition requires no active batch");
    assert(state.completedBatchIds.at(-1).includes(`.batch-${task.afterBatch}-`),
      `a prerequisite recorded after batch ${task.afterBatch} follows its completed release`);
    const backlog = this.json(BACKLOG).tasks.find(item => item.id === task.backlogTaskId);
    assert(backlog, `unknown backlog task: ${task.backlogTaskId}`);
    const after = new Map();
    for (const edit of task.sourceEdits) {
      let text = this.bytes(edit.path).toString("utf8");
      // Each anchor occurs exactly `count` times (default once) with the file's line endings.
      for (const [from, to, count = 1] of edit.replacements) {
        const variants = [from, from.replaceAll("\n", "\r\n")].filter(variant => text.split(variant).length === count + 1);
        assert.equal(new Set(variants).size, 1, `source edit anchor does not occur exactly ${count} time(s): ${edit.path}`);
        text = text.replaceAll(variants[0], () => (variants[0] === from ? to : to.replaceAll("\n", "\r\n")));
      }
      after.set(edit.path, Buffer.from(text, "utf8"));
    }
    // Optional: files the transition creates (exact bytes derived from the tree it applies to).
    for (const created of task.createdFiles || []) {
      assert(!fs.existsSync(path.join(this.root, created.path)), `created file already exists: ${created.path}`);
      after.set(created.path, Buffer.from(created.bytes({ read: file => this.bytes(file).toString("utf8") }), "utf8"));
    }
    // Optional: files the transition deletes, each explicitly listed; the record keeps its full
    // before-image, so rollback restores it byte-for-byte.
    const deletedPaths = [...(task.deletedFiles || [])];
    for (const file of deletedPaths) {
      assert(fs.existsSync(path.join(this.root, file)), `deleted file does not exist: ${file}`);
      assert(!after.has(file), `a deleted file is also edited or created: ${file}`);
      after.set(file, null);
    }
    // Optional: reviewed metadata the transition changes (derived from the tree and the edits).
    const metadata = task.metadataWrites ? task.metadataWrites({ read: file => this.bytes(file).toString("utf8"),
      exists: file => fs.existsSync(path.join(this.root, file)), after: file => after.get(file)?.toString("utf8") }) : new Map();
    for (const [file, bytes] of metadata) after.set(file, Buffer.from(bytes, "utf8"));
    // Optional: reviewed reclassification / blocker removal of Manifest entries whose sources this
    // transition edits, and reviewed global providers of the files it creates (exact baseline delta).
    const updates = task.manifestUpdates ? new PrerequisiteManifestUpdatePlan(task.manifestUpdates,
      { editedPaths: task.sourceEdits.map(edit => edit.path), reclassifiedWithoutEdit: task.reclassifiedWithoutEdit || [],
        reviewedWithoutEdit: task.reviewedWithoutEdit || [], waves: this.json(POLICY).migration.waves }) : null;
    for (const file of [...(task.reclassifiedWithoutEdit || []), ...(task.reviewedWithoutEdit || [])]) {
      assert(!after.has(file), `a module reclassified without edit is written by the transition: ${file}`);
    }
    const additions = task.globalProviderAdditions ? new PrerequisiteGlobalProviderAdditionPlan(
      task.globalProviderAdditions, { createdPaths: (task.createdFiles || []).map(created => created.path) }) : null;
    const removals = task.globalProviderRemovals ? new PrerequisiteGlobalProviderRemovalPlan(
      task.globalProviderRemovals, { editedPaths: task.sourceEdits.map(edit => edit.path) }) : null;
    assert(!(additions && removals), "a transition either adds or removes global providers");
    const replacements = task.globalProviderReplacements ? new PrerequisiteGlobalProviderReplacementPlan(
      task.globalProviderReplacements, { editedPaths: task.sourceEdits.map(edit => edit.path), deletedPaths,
        createdPaths: (task.createdFiles || []).map(created => created.path) }) : null;
    assert(!(replacements && (additions || removals)), "global provider replacements are the only baseline change");
    if (replacements) {
      assert(!metadata.has(BASELINE), "global provider replacements own the baseline write");
      after.set(BASELINE, canonical(replacements.apply(this.json(BASELINE))));
    }
    if (additions) {
      assert(!metadata.has(BASELINE), "global provider additions own the baseline write");
      after.set(BASELINE, canonical(additions.apply(this.json(BASELINE))));
    }
    if (removals) {
      assert(!metadata.has(BASELINE), "global provider removals own the baseline write");
      after.set(BASELINE, canonical(removals.apply(this.json(BASELINE))));
    }
    const workspace = this.#workspace(after);
    try {
      const policyDocument = this.json(POLICY);
      const policy = ArchitecturePolicy.load(path.join(this.root, POLICY));
      const oldManifest = this.json(MANIFEST);
      // Optional: reviewed classification of modules the transition creates; the observation of the
      // edited workspace supplies their observed facts and dependencies.
      // A deleted file's Manifest entry leaves with it.
      const kept = { ...oldManifest, modules: oldManifest.modules.filter(module => !deletedPaths.includes(module.currentPath)) };
      assert.equal(oldManifest.modules.length - kept.modules.length, deletedPaths.length,
        "every deleted file has exactly one Manifest entry");
      const seeded = task.manifestEntries ? { ...kept, modules: [...kept.modules,
        ...task.manifestEntries.map(entry => ({ currentPath: entry.currentPath, currentArea: entry.currentArea,
          observed: { legacyLoadOrder: entry.legacyLoadOrder }, architecture: entry.architecture,
          analysis: { blockers: entry.blockers } }))] } : kept;
      const manifest = new LiveObservationSnapshot().build({ projectRoot: workspace, policy,
        manifest: updates ? updates.apply(seeded) : seeded });
      if (updates) updates.verify(oldManifest, manifest);
      if (additions) additions.verify(this.json(BASELINE), JSON.parse(after.get(BASELINE)), manifest);
      if (removals) removals.verify(this.json(BASELINE), JSON.parse(after.get(BASELINE)), manifest);
      if (replacements) replacements.verify(this.json(BASELINE), JSON.parse(after.get(BASELINE)), manifest);
      const debt = this.json(KNOWN_DEBT);
      for (const id of task.resolvedDebtIds) assert(debt.debts.some(item => item.id === id), `unknown debt: ${id}`);
      const nextDebt = { ...debt, debts: debt.debts.filter(item => !task.resolvedDebtIds.includes(item.id)) };
      const guards = registry => new ArchitectureGuardEngine({ projectRoot: workspace }).run(new ArchitectureGuardSnapshotBuilder({
        projectRoot: workspace, policy: policyDocument, manifest, bridgeRegistry: this.json(BRIDGES),
        globalBaseline: after.has(BASELINE) ? JSON.parse(after.get(BASELINE)) : this.json(BASELINE),
        debtRegistry: registry }).build());
      // With the old registry exactly the resolved debts become stale; with the new one nothing fails.
      const stale = guards(debt).diagnostics.filter(item => item.status === "FAIL");
      assert.deepEqual(stale.map(item => item.rule), task.resolvedDebtIds.map(() => "stale-known-debt"),
        "the edits must resolve exactly the declared debts");
      assert(task.resolvedDebtIds.every(id => stale.some(item => item.message.includes(id))));
      const result = guards(nextDebt);
      assert.equal(result.failureCount, 0, JSON.stringify(result.diagnostics.filter(item => item.status === "FAIL")));
      const edges = document => new Set(document.modules.flatMap(module => module.analysis.dependencies.items
        .filter(edge => edge.resolution === "confirmed")
        .map(edge => `${module.currentPath}\u0000${edge.target}\u0000${[...edge.symbols].sort().join(",")}`)));
      const oldEdges = edges(oldManifest), newEdges = edges(manifest);
      const removed = [...oldEdges].filter(edge => !newEdges.has(edge)).sort(compare);
      const added = [...newEdges].filter(edge => !oldEdges.has(edge)).sort(compare);
      assert.deepEqual({ removed, added }, { removed: [...task.expectedEdges.removed], added: [...task.expectedEdges.added] },
        "the confirmed-edge delta differs from the task");
      after.set(MANIFEST, canonical(manifest));
      after.set(KNOWN_DEBT, canonical(nextDebt));
      // The re-observed Manifest is written only when an observed fact changed (a text injection that
      // reads an already observed provider changes none); its contents are verified above either way.
      const manifestChanged = !after.get(MANIFEST).equals(this.beforeBytes(MANIFEST));
      const changed = [...after].filter(([file, bytes]) => bytes === null ||
        !bytes.equals(this.beforeBytes(file) ?? Buffer.alloc(0)) || this.beforeBytes(file) === null);
      assert.deepEqual(changed.map(([file]) => file).sort(),
        [...task.sourceEdits.map(edit => edit.path), ...(task.createdFiles || []).map(created => created.path),
          ...deletedPaths, ...metadata.keys(), ...(additions || removals || replacements ? [BASELINE] : []), ...(manifestChanged ? [MANIFEST] : []),
          ...(task.resolvedDebtIds.length > 0 ? [KNOWN_DEBT] : [])].sort(),
        "unexpected transition write set");
      const parity = task.parity({ read: file => this.bytes(file).toString("utf8"),
        before: file => this.bytes(file).toString("utf8"), after: file => after.get(file).toString("utf8"),
        workspace });
      const record = {
        schemaVersion: 1,
        kind: KIND,
        sequence: task.sequence,
        slug: task.slug,
        afterBatch: task.afterBatch,
        afterRelease: state.releaseVersion,
        backlogTask: { path: BACKLOG, sha256: sha(this.bytes(BACKLOG)), id: backlog.id, kind: backlog.kind,
          graphChanging: backlog.graphChanging },
        intent: task.intent,
        inputs: [STATE, POLICY, BRIDGES, BASELINE].map(file => ({ path: file, sha256: sha(this.bytes(file)) })),
        sourceEdits: task.sourceEdits.map(edit => ({ path: edit.path, beforeSha256: sha(this.bytes(edit.path)),
          afterSha256: sha(after.get(edit.path)) })),
        resolvedDebtIds: [...task.resolvedDebtIds],
        ...(updates ? { manifestUpdates: updates.records(oldManifest, manifest,
          { sourceSha256: file => sha(this.bytes(file)),
            reviewEvidence: file => buildReviewEvidence({ currentPath: file, manifest, policy: policyDocument,
              debtRegistry: nextDebt, sourceSha256: sha(this.bytes(file)) }) }) } : {}),
        ...(additions ? { globalProviderAdditions: additions.records() } : {}),
        ...(removals ? { globalProviderRemovals: removals.records() } : {}),
        ...(replacements ? { globalProviderReplacements: replacements.records() } : {}),
        ...(deletedPaths.length > 0 ? { deletedFiles: [...deletedPaths] } : {}),
        dependencyObservation: { removedEdges: removed, addedEdges: added, confirmedEdgeDelta: added.length - removed.length },
        guards: { failureCount: result.failureCount, knownDebtCount: result.knownDebtCount },
        parity,
        graphReview: { trigger: backlog.graphReviewRepeatCondition.trigger, status: "pending-repeated-graph-review" },
        behaviorChange: "none",
        writes: changed.map(([file, bytes]) => {
          const before = this.beforeBytes(file);
          return { path: file, beforeSha256: before === null ? null : sha(before), afterSha256: bytes === null ? null : sha(bytes),
            beforeBase64: before === null ? null : before.toString("base64") };
        }).sort((left, right) => compare(left.path, right.path)),
      };
      StageThreePrerequisiteLedger.validate(record);
      return { record, bytes: canonical(record), after: new Map(changed) };
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  }

  // Temporary copy of the observed inputs with the edited sources.
  #workspace(after) {
    const temporary = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "cyber-prerequisite-"));
    const copy = relative => {
      for (const entry of fs.readdirSync(path.join(this.root, relative), { withFileTypes: true })) {
        const child = `${relative}/${entry.name}`;
        if (entry.isDirectory()) copy(child);
        else if (entry.isFile()) {
          fs.mkdirSync(path.dirname(path.join(temporary, child)), { recursive: true });
          fs.copyFileSync(path.join(this.root, child), path.join(temporary, child));
        }
      }
    };
    for (const directory of ["src", "architecture"]) copy(directory);
    for (const file of ["index.html", "package.json"]) fs.copyFileSync(path.join(this.root, file), path.join(temporary, file));
    for (const [file, bytes] of after) {
      if (bytes === null) {
        fs.rmSync(path.join(temporary, file), { force: true });
        continue;
      }
      fs.mkdirSync(path.dirname(path.join(temporary, file)), { recursive: true });
      fs.writeFileSync(path.join(temporary, file), bytes);
    }
    return temporary;
  }
}

module.exports = { StageThreePrerequisiteTransitionBuilder, MANIFEST, KNOWN_DEBT };
