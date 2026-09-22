"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { Batch009CandidateWorkspace } = require("./domain_batches/stage_three_batch_009_candidate_workspace");
const { Batch009ReleaseProjection } = require("./project-stage-3-batch-009-release");
const { canonicalBytes, fingerprint } = require("./domain_batches/stage_three_pending_target_manifest");
const { TRANSITION } = require("./domain_batches/stage_three_batch_009_release_transition");

class Batch009ReleaseCandidateCheck {
  run(root = path.resolve(__dirname, "../.."), { fresh = false, architecture = false } = {}) {
    const projected = new Batch009ReleaseProjection().run(root);
    const workspace = new Batch009CandidateWorkspace();
    const before = projected.writes.map(item => ({ path: item.path, sha256: item.beforeSha256 }));
    const copy = relative => {
      for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
        assert(!entry.isSymbolicLink(), `Candidate copy contains symlink: ${relative}/${entry.name}`);
        const file = `${relative}/${entry.name}`;
        if (entry.isDirectory()) copy(file);
        else workspace.write(file, fs.readFileSync(path.join(root, file)));
      }
    };
    try {
      for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if ([".git", "node_modules"].includes(entry.name)) continue;
        assert(!entry.isSymbolicLink(), `Candidate root contains symlink: ${entry.name}`);
        if (entry.name === "dist") copy("dist/stage-3-compat-runtime");
        else if (entry.isDirectory()) copy(entry.name);
        else workspace.write(entry.name, fs.readFileSync(path.join(root, entry.name)));
      }
      for (const item of projected.writes) workspace.write(item.path, item.after);
      workspace.write(TRANSITION, canonicalBytes(projected.transition));
      fs.symlinkSync(path.join(root, "node_modules"), path.join(workspace.root, "node_modules"), "junction");
      const checks = [
        "utils/architecture/stage-3-batch-009-release-check.js",
        "utils/architecture/stage-3-batch-009-live-runtime-check.js",
        "utils/architecture/stage-3-batch-009-observation-integration-check.js",
        "utils/architecture/stage-3-batch-009-observation-fixture-check.js",
        "utils/architecture/stage-3-batch-008-release-acceptance-check.js",
      ];
      for (const check of checks) {
        const result = spawnSync(process.execPath, [path.join(workspace.root, check)],
          { cwd: workspace.root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
        assert.equal(result.status, 0, `${check}: ${result.stderr || result.stdout || result.error?.message}`);
      }
      if (architecture) {
        const result = spawnSync(process.execPath, ["utils/run-checks.js", "--suite", "architecture"],
          { cwd: workspace.root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
        assert.equal(result.status, 0, (result.stdout + result.stderr).slice(-12000));
        console.log((result.stdout.match(/Passed \d+ checks in [\d.]+s\./u) || ["Architecture PASS"])[0]);
      }
      if (fresh) {
        const { FreshPackageInstallVerifier } = require("./verify-fresh-package-install");
        const result = new FreshPackageInstallVerifier({ projectRoot: workspace.root }).run();
        assert.equal(result.status, "passed");
        assert.equal(result.lockfileChanged, false);
        const runtime = JSON.parse(fs.readFileSync(path.join(workspace.root,
          "architecture/migration/stage_3_compatibility_runtime.json")));
        assert.equal(result.runtimeOutput.length, 1 + runtime.activationPositions.length);
      }
      for (const item of before) {
        assert.equal(fingerprint(fs.readFileSync(path.join(root, item.path))), item.sha256,
          `Candidate validation changed source: ${item.path}`);
      }
      console.log(`Stage 3.9.9 isolated release candidate PASS: seven metadata deltas, ${checks.length} historical checks, source bytes unchanged${fresh ? ", fresh npm ci + Architecture/Quick/Full PASS" : ""}.`);
    } finally {
      const junction = path.join(workspace.root, "node_modules");
      if (fs.existsSync(junction)) fs.unlinkSync(junction);
      workspace.cleanup();
    }
  }
}

if (require.main === module) new Batch009ReleaseCandidateCheck().run(undefined,
  { fresh: process.argv.includes("--fresh"), architecture: process.argv.includes("--architecture") });
module.exports = { Batch009ReleaseCandidateCheck };
