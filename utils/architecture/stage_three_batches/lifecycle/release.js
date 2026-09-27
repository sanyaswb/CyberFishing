"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ControlledMetadataTransaction } = require("../../domain_batches/controlled_metadata_transaction");
const { StageThreeApprovedPlanSource } = require("../../domain_batches/stage_three_approved_plan_source");
const { StageThreeRetirementView } = require("../../domain_batches/stage_three_retirement_view");
const { CHECK_DEFINITIONS } = require("../../../testing/suites/check_manifest");
const { StageThreeBatchReleaseTransition, RELEASE_PATHS, STATE } = require("./release_transition");
const { sha, serialize } = require("./planning");

const MANIFEST = "architecture/migration/module_migration_manifest.json";
const REGISTRY = "architecture/guards/migration_bridge_registry.json";
const RUNTIME = "architecture/migration/stage_3_compatibility_runtime.json";
const VERSION = "src/config/project_version.js";

const reader = root => {
  const read = file => fs.readFileSync(path.join(root, file));
  return { read, json: file => JSON.parse(read(file)) };
};

// Stage 3.N.9: exact reversible release metadata for one batch (package, lockfile, project version,
// index version query, changelog and execution state). Informational documents are not included.
class StageThreeBatchReleaseProjection {
  constructor(definition) { this.definition = definition; }

  run(root) {
    const { read } = reader(root);
    const context = this.definition.context;
    const release = this.definition.release;
    const paths = context.paths;
    assert(!fs.existsSync(path.join(root, paths.releaseTransition)), "Release transition already published");
    const acceptance = JSON.parse(read(paths.acceptance));
    const browser = JSON.parse(read(paths.browser));
    assert.equal(acceptance.verdict, "eligible-for-release-closure");
    assert.equal(browser.supplements.sha256, sha(read(paths.acceptance)));
    assert.equal(browser.status, "passed");
    assert.equal(browser.console.errors, 0);
    assert.equal(browser.console.warnings, 0);
    for (const evidence of [acceptance.completes, ...acceptance.protectedEvidence]) {
      assert.equal(sha(read(evidence.path)), evidence.sha256, `Stale acceptance: ${evidence.path}`);
    }
    const { fromRelease: from, toRelease: to } = context;
    const edits = new Map(RELEASE_PATHS.map(file => [file, []]));
    const add = (file, fromText, toText, count = 1) => edits.get(file).push({ from: fromText, to: toText, count });
    add("package.json", `  "version": "${from}",`, `  "version": "${to}",`);
    add("package-lock.json", `  "version": "${from}",`, `  "version": "${to}",`, 2);
    const state = JSON.parse(read(STATE));
    const approved = new StageThreeApprovedPlanSource({ read }).load(state).document;
    assert.equal(approved.batches[context.completedBefore].id, acceptance.batchId);
    assert.equal(state.activeBatchId, acceptance.batchId);
    const completed = { ...state, releaseVersion: to,
      completedBatchIds: approved.batches.slice(0, context.order).map(batch => batch.id), activeBatchId: null };
    delete completed.activeBatchPhase;
    add(STATE, read(STATE).toString().trimEnd(), serialize(completed).toString().trimEnd());
    add("index.html", `    <script src="${VERSION}?v=${from}"></script>`, `    <script src="${VERSION}?v=${to}"></script>`);
    const versionText = read(VERSION).toString();
    add(VERSION, `const CURRENT_PROJECT_VERSION = "${from}";`, `const CURRENT_PROJECT_VERSION = "${to}";`);
    const oldCodename = versionText.match(/  codename: "([a-z0-9-]+)",/u)?.[1];
    assert(oldCodename && oldCodename !== release.codename, "Project version codename is missing or unchanged");
    add(VERSION, `  codename: "${oldCodename}",`, `  codename: "${release.codename}",`);
    const oldDate = versionText.match(/  updatedAt: "(\d{4}-\d{2}-\d{2})",/u)?.[1];
    assert(oldDate, "Project version date missing");
    const newDate = acceptance.recordedAt.slice(0, 10);
    if (oldDate !== newDate) add(VERSION, `  updatedAt: "${oldDate}",`, `  updatedAt: "${newDate}",`);
    const oldNotes = versionText.match(/  notes: Object\.freeze\(\[[\s\S]*?  \]\),/u)?.[0];
    assert(oldNotes, "Project version notes missing");
    const eol = oldNotes.includes("\r\n") ? "\r\n" : "\n";
    add(VERSION, oldNotes, ["  notes: Object.freeze([",
      ...release.notes.map(note => `    ${JSON.stringify(note)},`), "  ]),"].join(eol));
    const changelog = [`## v${to} - ${release.title}`, "", "### Changed", "", ...release.changelog, "", ""].join("\n");
    add("CHANGELOG.md", "# CyberFishing changelog\n\n", `# CyberFishing changelog\n\n${changelog}`);
    const transition = {
      schemaVersion: 1, kind: context.kind("release-transition"), batchId: acceptance.batchId,
      fromRelease: from, toRelease: to,
      acceptance: { path: paths.acceptance, sha256: sha(read(paths.acceptance)) },
      browserProof: { path: paths.browser, sha256: sha(read(paths.browser)) },
      records: [],
    };
    const writes = [], validator = new StageThreeBatchReleaseTransition(root, this.definition);
    for (const [file, operations] of edits) {
      const before = read(file);
      let after = before.toString();
      for (const operation of operations) {
        after = StageThreeBatchReleaseTransition.replace(after, operation.from, operation.to, operation.count);
      }
      const nextBytes = Buffer.from(after);
      validator.validateDelta(file, before, nextBytes);
      transition.records.push({ path: file, beforeSha256: sha(before), afterSha256: sha(nextBytes), edits: operations });
      writes.push({ path: file, beforeSha256: sha(before), after: nextBytes });
    }
    validator.validate(transition);
    for (const item of transition.records) {
      const projected = writes.find(write => write.path === item.path);
      assert.deepEqual(validator.reverse(projected.after, item), read(item.path));
    }
    return { transition, writes };
  }
}

// Verifies the published release: reversible metadata, completed state, versions and topology.
class StageThreeBatchReleaseCheck {
  constructor(definition) { this.definition = definition; }

  run(root) {
    const { read, json } = reader(root);
    const context = this.definition.context;
    const execution = this.definition.execution;
    const release = this.definition.release;
    const transition = new StageThreeBatchReleaseTransition(root, this.definition);
    const record = transition.validate(json(context.paths.releaseTransition));
    assert.deepEqual(record.records.map(item => item.path), RELEASE_PATHS);
    for (const item of record.records) transition.reverse(read(item.path), item);
    const state = json(STATE);
    const approved = new StageThreeApprovedPlanSource({ read }).load(state).document;
    assert.equal(state.releaseVersion, context.toRelease);
    assert.deepEqual(state.completedBatchIds, approved.batches.slice(0, context.order).map(item => item.id));
    assert.equal(state.completedBatchIds[context.order - 1], this.definition.id);
    assert.deepEqual(state.continuationPlan, execution.continuationPlan);
    assert.equal(state.activeBatchId, null);
    assert(!Object.hasOwn(state, "activeBatchPhase"));
    assert.equal(state.compatibilityRuntimeActivated, true);
    const pkg = json("package.json"), lock = json("package-lock.json");
    assert.equal(pkg.version, context.toRelease);
    assert.equal(lock.version, pkg.version);
    assert.equal(lock.packages[""].version, pkg.version);
    const version = read(VERSION).toString();
    assert(version.includes(`const CURRENT_PROJECT_VERSION = "${context.toRelease}";`));
    assert(version.includes(`codename: "${release.codename}"`));
    assert.equal(read("index.html").toString().split(`${VERSION}?v=${context.toRelease}`).length - 1, 1);
    assert(read("CHANGELOG.md").toString()
      .startsWith(`# CyberFishing changelog\n\n## v${context.toRelease} - ${release.title}\n`));
    const runtime = json(RUNTIME);
    const registry = json(REGISTRY);
    const topology = execution.expectedTopology;
    assert.equal(StageThreeRetirementView.activationModuleCount(runtime), topology.afterProjectModuleCount);
    assert.deepEqual((runtime.retiredActivations || []).filter(item => item.retiredBy === this.definition.id)
      .map(item => item.activation.id).sort(), [...(execution.expectedRetiredActivationIds || [])].sort());
    assert.equal(runtime.activationPositions.length, topology.afterActivationCount);
    assert.equal(registry.bridges.length, topology.afterBridgeCount);
    const browser = json(context.paths.browser), acceptance = json(context.paths.acceptance);
    assert.equal(browser.status, "passed");
    assert.deepEqual([browser.console.errors, browser.console.warnings], [0, 0]);
    assert.equal(browser.supplements.sha256, sha(read(context.paths.acceptance)));
    assert.equal(acceptance.verdict, "eligible-for-release-closure");
    for (const item of acceptance.protectedEvidence) {
      if (item.path !== STATE && item.path !== "index.html") {
        assert.equal(sha(read(item.path)), item.sha256, `Release altered evidence: ${item.path}`);
      }
    }
    return { status: "passed", releaseFiles: record.records.length, topology: {
      modules: topology.afterProjectModuleCount, activations: topology.afterActivationCount,
      bridges: topology.afterBridgeCount } };
  }
}

class StageThreeBatchReleasePublisher {
  constructor(definition) { this.definition = definition; }

  run(root, { failureInjector = null } = {}) {
    const projected = new StageThreeBatchReleaseProjection(this.definition).run(root);
    const { read, json } = reader(root);
    const runtime = json(RUNTIME);
    const outputPaths = [runtime.output.directory + runtime.output.runtimeFile,
      ...runtime.activationPositions.map(item => runtime.output.directory + item.shimFile)];
    const protectedPaths = [MANIFEST, REGISTRY, RUNTIME, ...outputPaths,
      ...this.definition.execution.expectedTargets.map(item => item.targetPath)];
    const protectedBefore = protectedPaths.map(file => ({ file, sha256: sha(read(file)) }));
    const writes = [
      ...projected.writes.map(item => ({ relativePath: item.path, bytes: item.after })),
      { relativePath: this.definition.context.paths.releaseTransition, bytes: serialize(projected.transition) },
    ];
    new ControlledMetadataTransaction({ projectRoot: root, failureInjector }).commit(writes, () => {
      new StageThreeBatchReleaseCheck(this.definition).run(root);
      for (const item of protectedBefore) {
        assert.equal(sha(read(item.file)), item.sha256, `Release changed runtime/source: ${item.file}`);
      }
      for (const item of writes) assert.deepEqual(read(item.relativePath), item.bytes);
    });
    return projected.transition;
  }
}

// Post-release regression evidence: the pre-release fresh install/build and suites still match.
class StageThreeBatchReleaseRegression {
  constructor(definition) { this.definition = definition; }

  run(root) {
    const { read, json } = reader(root);
    const context = this.definition.context;
    const output = context.paths.releaseRegression;
    assert(!fs.existsSync(path.join(root, output)), "Release regression attempt is immutable");
    const release = new StageThreeBatchReleaseCheck(this.definition).run(root);
    const transitionSha256 = sha(read(context.paths.releaseTransition));
    const automated = json(context.paths.automatedAcceptance);
    const acceptance = json(context.paths.acceptance);
    assert.equal(automated.status, "automated-pass-awaiting-browser");
    assert.equal(acceptance.completes.sha256, sha(read(context.paths.automatedAcceptance)));
    assert.deepEqual(automated.suites.full, { passedChecks: CHECK_DEFINITIONS.length, failedChecks: 0 });
    const fresh = automated.freshInstall;
    assert.equal(fresh.status, "passed");
    assert.equal(fresh.lockfileChanged, false);
    assert.equal(fresh.sourceBytesUnchanged, true);
    assert.equal(fresh.temporaryWorkspaceRemoved, true);
    assert.deepEqual(fresh.steps.map(step => step.id), ["npm-ci", "cumulative-build"]);
    for (const step of fresh.steps) assert.equal(step.exitCode, 0);
    for (const item of fresh.runtimeOutput) {
      assert.equal(sha(read(item.path)), item.sha256, `Generated runtime drift: ${item.path}`);
    }
    const report = {
      schemaVersion: 1, kind: context.kind("release-regression"),
      batchId: this.definition.id, releaseVersion: context.toRelease,
      recordedAt: new Date().toISOString(), status: "passed",
      releaseTransition: { path: context.paths.releaseTransition, sha256: transitionSha256 },
      automatedAcceptance: { path: context.paths.automatedAcceptance, sha256: sha(read(context.paths.automatedAcceptance)) },
      preReleaseSuites: automated.suites,
      verifiedTopology: release.topology,
      node: fresh.node, npm: fresh.npm,
      lockfileSha256: sha(read("package-lock.json")),
      lockfileChanged: false,
      sourceCopy: { sourceBytesUnchanged: fresh.sourceBytesUnchanged },
      temporaryWorkspaceRemoved: fresh.temporaryWorkspaceRemoved,
      generatedOutputCopied: fresh.generatedOutputCopied,
      runtimeOutput: fresh.runtimeOutput,
      steps: fresh.steps,
    };
    const bytes = serialize(report);
    new ControlledMetadataTransaction({ projectRoot: root }).commit([{ relativePath: output, bytes }],
      () => assert.deepEqual(read(output), bytes));
    return report;
  }
}

// Release closure: the immutable record of the completed batch and its batch-only rollback.
class StageThreeBatchReleaseFinalizer {
  constructor(definition) { this.definition = definition; }

  run(root) {
    const { read, json } = reader(root);
    const context = this.definition.context;
    const paths = context.paths;
    assert(!fs.existsSync(path.join(root, paths.releaseClosure)), "Release closure must not be rewritten");
    const reference = file => ({ path: file, sha256: sha(read(file)) });
    const verified = new StageThreeBatchReleaseCheck(this.definition).run(root);
    const accepted = json(paths.acceptance);
    const browser = json(paths.browser);
    const regression = json(paths.releaseRegression);
    const transition = json(paths.releaseTransition);
    const plan = json(paths.executionPlan);
    const approved = new StageThreeApprovedPlanSource({ read }).load(json(STATE)).document;
    assert.equal(accepted.verdict, "eligible-for-release-closure");
    assert.equal(browser.supplements.sha256, sha(read(paths.acceptance)));
    assert.deepEqual([browser.console.errors, browser.console.warnings], [0, 0]);
    assert.equal(regression.status, "passed");
    assert.equal(regression.releaseVersion, context.toRelease);
    assert.equal(regression.lockfileChanged, false);
    assert.equal(regression.sourceCopy.sourceBytesUnchanged, true);
    assert.equal(regression.temporaryWorkspaceRemoved, true);
    assert.deepEqual(regression.steps.map(step => step.id), ["npm-ci", "cumulative-build"]);
    for (const step of regression.steps) assert.equal(step.exitCode, 0);
    assert.equal(regression.automatedAcceptance.sha256, sha(read(paths.automatedAcceptance)));
    assert.deepEqual(regression.preReleaseSuites.full, { passedChecks: CHECK_DEFINITIONS.length, failedChecks: 0 });
    for (const output of regression.runtimeOutput) assert.equal(sha(read(output.path)), output.sha256);
    assert.deepEqual(transition.records.map(item => item.path), RELEASE_PATHS);
    const next = approved.batches[context.order];
    const closure = {
      schemaVersion: 1, kind: "cyber-fishing-stage-3-batch-release-closure",
      status: "verified", batchId: accepted.batchId,
      releaseVersion: context.toRelease, previousReleaseVersion: context.fromRelease,
      releasePublicationAllowed: true, completedBatchCount: context.order,
      completedDomainModuleCount: approved.batches.slice(0, context.order)
        .reduce((count, batch) => count + batch.modules.length, 0),
      runtimeTopology: verified.topology,
      acceptance: {
        automatedEvidence: reference(paths.automatedAcceptance),
        historicalSummary: reference(paths.acceptance),
        browserProof: reference(paths.browser),
        browserGate: browser.gate,
      },
      releaseTransition: reference(paths.releaseTransition),
      releaseEvidence: [...RELEASE_PATHS.map(reference), ...[MANIFEST, REGISTRY, RUNTIME].map(reference)],
      rollback: {
        atomic: plan.rollback.atomic,
        partialRollbackAllowed: plan.rollback.partialRollbackAllowed,
        fromRelease: plan.rollback.fromRelease,
        toRelease: plan.rollback.toRelease,
        removeBatchId: plan.rollback.removeBatchId,
        preserveCompletedBatchIds: plan.rollback.preserveCompletedBatchIds,
        restoreTopology: plan.rollback.restoreTopology,
        baselineEvidenceReference: reference(paths.executionPlan),
      },
      finalRegression: {
        status: "passed", evidence: reference(paths.releaseRegression),
        preReleaseSuites: regression.preReleaseSuites,
        node: regression.node, npm: regression.npm,
        lockfileSha256: regression.lockfileSha256,
        lockfileChanged: false, generatedRuntimeByteEquality: true,
        steps: regression.steps.map(item => ({
          id: item.id, exitCode: item.exitCode, passedChecks: item.passedChecks,
          durationMs: item.durationMs, stdoutSha256: item.stdoutSha256, stderrSha256: item.stderrSha256,
        })),
      },
      nextStage: next
        ? `Stage ${context.next().stage}.0 — Batch ${context.next().number} Preflight (${next.id})`
        : "Stage 3 approved continuation prefix complete — post-prefix review",
    };
    const bytes = serialize(closure);
    new ControlledMetadataTransaction({ projectRoot: root }).commit([{ relativePath: paths.releaseClosure, bytes }],
      () => assert.deepEqual(read(paths.releaseClosure), bytes));
    new StageThreeBatchReleaseCheck(this.definition).run(root);
    return closure;
  }
}

module.exports = {
  StageThreeBatchReleaseProjection, StageThreeBatchReleaseCheck, StageThreeBatchReleasePublisher,
  StageThreeBatchReleaseRegression, StageThreeBatchReleaseFinalizer,
};
