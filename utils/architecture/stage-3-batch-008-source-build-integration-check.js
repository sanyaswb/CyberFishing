"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreeBatch008SourceBuild, PATHS } = require("./domain_batches/stage_three_batch_008_source_build");
const { canonicalBytes, fingerprint } = require("./domain_batches/stage_three_pending_target_manifest");

const ROOT = path.resolve(__dirname, "../..");

function snapshot() {
  const walk = (relative) => fs.readdirSync(path.join(ROOT, relative), { withFileTypes: true }).flatMap((entry) => {
    const child = `${relative}/${entry.name}`;
    assert(!entry.isSymbolicLink(), "Protected evidence must not be a symlink");
    return entry.isDirectory() ? walk(child) : [child];
  });
  return [...walk("src"), ...walk("architecture"), ...walk("dist"),
    "index.html", "package.json", "package-lock.json", "refactor_Task.txt", "CHANGELOG.md"]
    .sort().map((relative) => ({ path: relative, sha256: fingerprint(fs.readFileSync(path.join(ROOT, relative))) }));
}

class StageThreeBatch008SourceBuildIntegrationCheck {
  async run() {
    const before = snapshot();
    const application = new StageThreeBatch008SourceBuild(ROOT);
    const first = await application.prepare();
    const second = await application.prepare();
    assert.deepEqual(canonicalBytes(first.artifact), canonicalBytes(second.artifact),
      "Candidate bundle/report changed on identical rebuild");
    assert.deepEqual(application.bytes(PATHS.output), canonicalBytes(first.artifact),
      "Persisted source/build evidence differs from a full live candidate rebuild");
    assert.deepEqual(application.bytes(PATHS.manifest), first.nextManifest);
    assert.equal(fs.existsSync(path.join(ROOT, "dist/.stage-3-batch-008-candidate")), false);
    assert.deepEqual(snapshot(), before, "Read-only source/build acceptance changed project bytes");
    console.log(`Stage 3.8.4 integration passed: ${first.artifact.sources.length} exact ESM targets; ` +
      `${first.artifact.candidateBuild.moduleCount}/${first.artifact.candidateBuild.activationCount} candidate topology; ` +
      `${first.artifact.candidateBuild.validation.behaviorCases.length} actual-bundle parity cases; ` +
      "two identical builds, exact class/activation identity, pending Manifest and untouched live runtime.");
  }
}

if (require.main === module) new StageThreeBatch008SourceBuildIntegrationCheck().run()
  .catch((error) => { console.error(error); process.exitCode = 1; });

module.exports = { snapshot };
