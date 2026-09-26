"use strict";

// Stage 3.22 audit-only release v0.24.59.
//   node utils/architecture/publish-stage-3-22-release.js --dry-run   projection only, no writes
//   node utils/architecture/publish-stage-3-22-release.js             rollback rehearsal, then publish
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { StageThreePatchReleaseTransition } = require("./domain_batches/stage_three_patch_release_transition");
const { PostFreezeReleaseTransition, PROFILE, KIND, VERSION_FILE, REFACTOR_TASK, RELEASE_PATHS, STATE } =
  require("./post_freeze/post_freeze_release_transition");
const { PostFreezeReleaseDocuments } = require("./post_freeze/post_freeze_release_documents");
const { ARTIFACTS, INPUTS, HISTORICAL } = require("./post_freeze/post_freeze_paths");
const { sha256, serialize } = require("./post_freeze/post_freeze_workspace");
const { REVIEW_ARTIFACTS } = require("./stage-3-22-post-freeze-review");
const { Stage322ReleaseCheck } = require("./stage-3-22-release-check");

const PROJECT_ROOT = path.resolve(__dirname, "../..");

class Stage322ReleaseProjection {
  run(root = PROJECT_ROOT) {
    const read = file => fs.readFileSync(path.join(root, file));
    const json = file => JSON.parse(read(file));
    assert(!fs.existsSync(path.join(root, ARTIFACTS.releaseTransition)), "Stage 3.22 release already published");
    const acceptance = json(ARTIFACTS.acceptance);
    assert.equal(acceptance.status, "accepted");
    assert.equal(acceptance.releaseClosureAllowed, true);
    for (const item of acceptance.artifacts) {
      assert.equal(sha256(read(item.path)), item.sha256, `Stale acceptance: ${item.path}`);
    }
    const documents = new PostFreezeReleaseDocuments({ approved: json(ARTIFACTS.approvedPrefix),
      backlog: json(ARTIFACTS.prerequisiteBacklog), graph: json(ARTIFACTS.graphReview), acceptance });
    const edits = new Map(RELEASE_PATHS.map(file => [file, []]));
    const add = (file, from, to, count = 1) => edits.get(file).push({ from, to, count });
    const from = PROFILE.fromRelease, to = PROFILE.toRelease;
    add("package.json", `  "version": "${from}",`, `  "version": "${to}",`);
    add("package-lock.json", `  "version": "${from}",`, `  "version": "${to}",`, 2);
    const state = json(STATE);
    add(STATE, read(STATE).toString().trimEnd(),
      serialize({ ...state, releaseVersion: to }).toString().trimEnd());
    add("index.html", `    <script src="${VERSION_FILE}?v=${from}"></script>`,
      `    <script src="${VERSION_FILE}?v=${to}"></script>`);
    const version = read(VERSION_FILE).toString();
    add(VERSION_FILE, `const CURRENT_PROJECT_VERSION = "${from}";`, `const CURRENT_PROJECT_VERSION = "${to}";`);
    const codename = version.match(/  codename: "([a-z0-9-]+)",/u)?.[1];
    assert(codename, "Project version codename missing");
    add(VERSION_FILE, `  codename: "${codename}",`, `  codename: "${PROFILE.codename}",`);
    const oldDate = version.match(/  updatedAt: "(\d{4}-\d{2}-\d{2})",/u)?.[1];
    assert(oldDate, "Project version date missing");
    const newDate = acceptance.recordedAt.slice(0, 10);
    if (oldDate !== newDate) add(VERSION_FILE, `  updatedAt: "${oldDate}",`, `  updatedAt: "${newDate}",`);
    const oldNotes = version.match(/  notes: Object\.freeze\(\[[\s\S]*?  \]\),/u)?.[0];
    assert(oldNotes, "Project version notes missing");
    add(VERSION_FILE, oldNotes, documents.projectVersionNotes(oldNotes.includes("\r\n") ? "\r\n" : "\n"));
    add("CHANGELOG.md", "# CyberFishing changelog\n\n", `# CyberFishing changelog\n\n${documents.changelog()}`);
    const task = read(REFACTOR_TASK).toString();
    add(REFACTOR_TASK, task, documents.refactorTask(task));
    const validator = new PostFreezeReleaseTransition(root);
    const records = [];
    const writes = [];
    for (const [file, operations] of edits) {
      const before = read(file);
      let after = before.toString();
      for (const operation of operations) {
        after = StageThreePatchReleaseTransition.replace(after, operation.from, operation.to, operation.count);
      }
      const next = Buffer.from(after);
      validator.validateDelta(file, before, next);
      records.push({ path: file, beforeSha256: sha256(before), afterSha256: sha256(next),
        beforeBase64: before.toString("base64"), edits: operations });
      writes.push({ relativePath: file, bytes: next });
    }
    const transition = {
      schemaVersion: 1,
      kind: KIND,
      stage: PROFILE.stage,
      fromRelease: from,
      toRelease: to,
      codename: PROFILE.codename,
      title: PROFILE.title,
      completesBatch: false,
      executionStateChange: "releaseVersion-only",
      acceptance: { path: ARTIFACTS.acceptance, sha256: sha256(read(ARTIFACTS.acceptance)) },
      rollbackRehearsal: this.#rehearsalPlan(writes.length + 1),
      records,
    };
    validator.validate(transition);
    for (const [index, item] of records.entries()) {
      assert.deepEqual(validator.reverse(writes[index].bytes, item), read(item.path));
    }
    writes.push({ relativePath: ARTIFACTS.releaseTransition, bytes: serialize(transition) });
    return { transition, writes };
  }

  #rehearsalPlan(count) {
    return [["after-staging", 0], ...Array.from({ length: count }, (_, index) => ["after-replacement", index + 1]),
      ["after-final-validation", count]]
      .map(([phase, position]) => ({ phase, count: position, outcome: "restored-byte-identical" }));
  }
}

class Stage322ReleasePublisher {
  run(root = PROJECT_ROOT) {
    const projected = new Stage322ReleaseProjection().run(root);
    const runtime = JSON.parse(fs.readFileSync(path.join(root, INPUTS.runtimeContract)));
    const protectedPaths = [INPUTS.manifest, INPUTS.bridgeRegistry, INPUTS.runtimeContract, INPUTS.policy,
      INPUTS.candidatePolicy, ...Object.values(HISTORICAL), ...REVIEW_ARTIFACTS, ARTIFACTS.acceptance,
      runtime.output.directory + runtime.output.runtimeFile,
      ...runtime.activationPositions.map(item => runtime.output.directory + item.shimFile)];
    const protectedBefore = protectedPaths.map(file => ({ file, sha256: sha256(fs.readFileSync(path.join(root, file))) }));
    const validate = () => {
      new Stage322ReleaseCheck().run(root, { transactionComplete: false });
      for (const item of protectedBefore) {
        assert.equal(sha256(fs.readFileSync(path.join(root, item.file))), item.sha256,
          `Release changed protected evidence: ${item.file}`);
      }
      for (const write of projected.writes) {
        assert.deepEqual(fs.readFileSync(path.join(root, write.relativePath)), write.bytes);
      }
    };
    const snapshot = () => projected.writes.map(write => {
      const file = path.join(root, write.relativePath);
      return fs.existsSync(file) ? fs.readFileSync(file) : null;
    });
    const before = snapshot();
    for (const step of projected.transition.rollbackRehearsal) {
      assert.throws(() => new ControlledMetadataTransaction({ projectRoot: root, failureInjector: point => {
        if (point.phase === step.phase && point.count === step.count) throw new Error("injected 3.22 rollback");
      } }).commit(projected.writes, validate), /injected 3\.22 rollback/);
      assert.deepEqual(snapshot(), before, `Rollback rehearsal changed bytes at ${step.phase}:${step.count}`);
    }
    new ControlledMetadataTransaction({ projectRoot: root }).commit(projected.writes, validate);
    new Stage322ReleaseCheck().run(root);
    return projected;
  }
}

if (require.main === module) {
  try {
    if (process.argv.includes("--dry-run")) {
      const result = new Stage322ReleaseProjection().run();
      console.log(`Stage 3.22 release projection PASS: ${result.transition.records.length} exact reversible metadata files; no writes.`);
    } else {
      const result = new Stage322ReleasePublisher().run();
      console.log(`Stage 3.22 release published: v${PROFILE.toRelease}; ${result.transition.rollbackRehearsal.length} ` +
        "rollback rehearsals restored every byte; completed prefix 001–021 and 78/87/139 unchanged.");
    }
  } catch (error) { console.error(error.stack); process.exitCode = 1; }
}

module.exports = { Stage322ReleaseProjection, Stage322ReleasePublisher };
